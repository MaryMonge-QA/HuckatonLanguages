const SHEETY_URL = "https://api.sheety.co/782c0e1ef97d36c7932073da8a8a8954/sistemaClasesIdiomas";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { nombre, email, idioma, nivel, zona, franja } = req.body;

  if (!nombre || !idioma || !nivel || !zona || !franja) {
    return res.status(400).json({ error: "Faltan datos del formulario" });
  }

  // 1. Guardar nuevo inscripto en Sheety
  const saveRes = await fetch(`${SHEETY_URL}/formResponses1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formResponses1: {
        timestamp: new Date().toLocaleString("es-AR"),
        nombreCompletoDelParticipante: nombre,
        emailAddress: email,
        "¿quéIdiomaQuieresPracticar?": idioma,
        "¿cuálEsTuNivelActual?": nivel,
        "¿enQuéZonaHorariaEstás?": zona,
        "¿enQuéFranjaHorariaPuedesTomarClases?": franja
      }
    })
  });

  if (!saveRes.ok) {
    console.error("Error guardando en Sheety:", await saveRes.text());
    return res.status(502).json({ error: "Error al guardar el registro" });
  }

  // 2. Leer todos los inscriptos y grupos existentes en paralelo
  const [allRes, gruposRes] = await Promise.all([
    fetch(`${SHEETY_URL}/formResponses1`),
    fetch(`${SHEETY_URL}/grupos`)
  ]);

  if (!allRes.ok) return res.status(502).json({ error: "Error al leer los registros" });

  const todos          = (await allRes.json()).formResponses1 || [];
  const gruposData     = gruposRes.ok ? (await gruposRes.json()).grupos || [] : [];

  // 3. Armar prompt con inscriptos Y grupos ya formados
  const listaInscriptos = todos.map((p, i) =>
    `${i + 1}. ${p.nombreCompletoDelParticipante} | Idioma: ${p["¿quéIdiomaQuieresPracticar?"]} | Nivel: ${p["¿cuálEsTuNivelActual?"]} | Zona: ${p["¿enQuéZonaHorariaEstás?"]} | Franja: ${p["¿enQuéFranjaHorariaPuedesTomarClases?"]}`
  ).join("\n");

  const listaGrupos = gruposData.length > 0
    ? gruposData.map(g =>
        `Grupo ${g.ngrupoNumero}: ${g.idioma} ${g.nivel} | Horario: ${g.horarioSugerido} | Miembros actuales: ${g.miembros}`
      ).join("\n")
    : "Ninguno todavía.";

  const prompt = `
Sos un asistente que organiza clases de idiomas para una empresa.

Inscriptos totales:
${listaInscriptos}

Grupos ya formados:
${listaGrupos}

El último participante de la lista (${nombre}) acaba de inscribirse.
Asignalo al grupo existente más compatible, o creá uno nuevo si ninguno encaja.

Reglas:
- Grupos de 4 a 6 personas (si hay pocos, está bien un grupo menor)
- Mismo idioma obligatorio
- Niveles compatibles: A1+A2 juntos, B1+B2 juntos, C1 solo
- Zona horaria: diferencia máxima de 3 horas entre miembros
- Argentina (UTC-3) y Colombia (UTC-5) son compatibles
- Argentina (UTC-3) y España (UTC+1) NO son compatibles
- México (UTC-6) y Colombia (UTC-5) son compatibles
- Franja horaria: los miembros del grupo deben compartir la misma franja o franjas compatibles
- Si asignás a un grupo existente, el grupo_numero debe ser el mismo que ya tiene ese grupo

Respondé ÚNICAMENTE con un JSON válido, sin texto extra, sin bloques de código:
{
  "grupo_numero": 1,
  "idioma": "Inglés",
  "nivel": "A1-A2",
  "horario_sugerido": "18:00 ARG / 17:00 COL",
  "companeros": ["Nombre 1", "Nombre 2"],
  "mensaje": "Bienvenida corta y amigable, máximo 20 palabras."
}
`;

  // 4. Llamar a Claude
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!claudeRes.ok) {
    console.error("Error Claude:", claudeRes.status, await claudeRes.text());
    return res.status(502).json({ error: "Error al contactar la IA" });
  }

  const texto = (await claudeRes.json()).content[0].text.replace(/```json|```/g, "").trim();

  let grupo;
  try {
    grupo = JSON.parse(texto);
  } catch {
    console.error("Claude no devolvió JSON válido:", texto);
    return res.status(500).json({ error: "La IA devolvió una respuesta inesperada" });
  }

  // 5. Actualizar grupo existente o crear uno nuevo en el Sheet
  const grupoExistente = gruposData.find(g => g.ngrupoNumero === grupo.grupo_numero);

  if (grupoExistente) {
    // Agregar el nuevo miembro a la lista existente (sin duplicados)
    const miembrosActuales = grupoExistente.miembros.split(",").map(m => m.trim());
    const miembrosUnicos   = [...new Set([...miembrosActuales, nombre])];

    await fetch(`${SHEETY_URL}/grupos/${grupoExistente.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grupos: { miembros: miembrosUnicos.join(", ") }
      })
    }).catch(e => console.error("Error actualizando grupo:", e));

  } else {
    // Crear fila nueva para el grupo
    const todosMiembros = [nombre, ...grupo.companeros].join(", ");

    await fetch(`${SHEETY_URL}/grupos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grupos: {
          ngrupoNumero:    grupo.grupo_numero,
          idioma:          grupo.idioma,
          nivel:           grupo.nivel,
          horarioSugerido: grupo.horario_sugerido,
          miembros:        todosMiembros,
          estado:          "ok"
        }
      })
    }).catch(e => console.error("Error creando grupo:", e));
  }

  return res.status(200).json(grupo);
}
