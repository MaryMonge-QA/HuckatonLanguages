const GAS_URL = "https://script.google.com/macros/s/AKfycbxotkr2FO1P8f1b4g-dEfbSezW2cMCzpVmXr4dJ6UCtpvCr0U7PD4YfkAA237cQc59j/exec";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // 1. Leer todos los inscriptos
  const inscriptosRes = await fetch(`${GAS_URL}?sheet=inscripciones`);
  if (!inscriptosRes.ok) {
    return res.status(502).json({ error: "Error al leer los inscriptos" });
  }
  const inscriptosJson = await inscriptosRes.json();
  console.log("Inscriptos raw:", JSON.stringify(inscriptosJson).slice(0, 500));
  const inscriptos = inscriptosJson.inscripciones || [];

  if (inscriptos.length === 0) {
    return res.status(400).json({ error: "No hay inscriptos todavía" });
  }

  // 2. Armar prompt para que Claude genere TODOS los grupos a la vez
  const lista = inscriptos.map((p, i) =>
    `${i + 1}. ${p.nombre} | Idioma: ${p.idioma} | Nivel: ${p.nivel} | Zona: ${p.zona} | Franja: ${p.franja}`
  ).join("\n");
  console.log("Lista para Claude:", lista);

  const prompt = `
Sos un asistente que organiza clases de idiomas para una empresa.

Lista completa de inscriptos:
${lista}

Formá todos los grupos necesarios respetando estas reglas:
- Grupos de 4 a 6 personas (si hay pocos inscriptos, está bien grupos menores)
- Mismo idioma obligatorio
- Niveles compatibles: A1+A2 juntos, B1+B2 juntos, C1 solo
- Zona horaria: diferencia máxima de 3 horas entre miembros del grupo
- Argentina (UTC-3) y Colombia (UTC-5) son compatibles
- Argentina (UTC-3) y España (UTC+1) NO son compatibles
- México (UTC-6) y Colombia (UTC-5) son compatibles
- Franja horaria: los miembros deben compartir la misma franja o franjas compatibles
- Todos los inscriptos deben quedar asignados a algún grupo

Respondé ÚNICAMENTE con un JSON array válido, sin texto extra, sin bloques de código:
[
  {
    "grupo_numero": 1,
    "idioma": "Inglés",
    "nivel": "A1-A2",
    "horario_sugerido": "10:00 ARG / 09:00 COL",
    "miembros": ["Nombre 1", "Nombre 2", "Nombre 3"]
  },
  {
    "grupo_numero": 2,
    "idioma": "Inglés",
    "nivel": "B1-B2",
    "horario_sugerido": "15:00 ARG / 14:00 COL",
    "miembros": ["Nombre 4", "Nombre 5"]
  }
]
`;

  // 3. Llamar a Claude
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!claudeRes.ok) {
    console.error("Error Claude:", claudeRes.status, await claudeRes.text());
    return res.status(502).json({ error: "Error al contactar la IA" });
  }

  const claudeJson = await claudeRes.json();
  console.log("Claude response:", JSON.stringify(claudeJson).slice(0, 1000));
  const rawText = claudeJson.content[0].text;

  // Extraer el primer array JSON balanceado
  function extractArray(text) {
    const start = text.indexOf("[");
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "[") depth++;
      else if (text[i] === "]") { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
    return null;
  }

  const jsonStr = extractArray(rawText);
  if (!jsonStr) {
    console.error("Claude no devolvió un array JSON. Respuesta:", rawText);
    return res.status(500).json({ error: "La IA devolvió una respuesta inesperada" });
  }

  let grupos;
  try {
    grupos = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Error parseando JSON:", e.message, "\nTexto:", jsonStr);
    return res.status(500).json({ error: "La IA devolvió una respuesta inesperada" });
  }

  // 4. Borrar grupos anteriores del Sheet (uno por uno)
  const gruposActualesRes = await fetch(`${GAS_URL}?sheet=grupos`);
  if (gruposActualesRes.ok) {
    const gruposActuales = (await gruposActualesRes.json()).grupos || [];
    for (const g of gruposActuales) {
      await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", sheet: "grupos", id: g.id })
      }).catch(() => {});
    }
  }

  // 5. Guardar los grupos nuevos en el Sheet (uno por uno para evitar rate limit)
  for (const g of grupos) {
    const postRes = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        sheet: "grupos",
        data: {
          grupoNumero:    g.grupo_numero,
          idioma:          g.idioma,
          nivel:           g.nivel,
          horarioSugerido: g.horario_sugerido,
          miembros:        g.miembros.join(", "),
          estado:          "ok"
        }
      })
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      console.error(`Error guardando grupo ${g.grupo_numero}:`, err);
      return res.status(502).json({ error: `Error al guardar el grupo ${g.grupo_numero}: ${err}` });
    }
  }

  return res.status(200).json({ grupos });
}
