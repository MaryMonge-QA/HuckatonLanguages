const SHEETY_URL = "https://api.sheety.co/782c0e1ef97d36c7932073da8a8a8954/sistemaClasesIdiomas";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { nombre, email, idioma, nivel, zona, franja } = req.body;

  if (!nombre || !idioma || !nivel || !zona || !franja) {
    return res.status(400).json({ error: "Faltan datos del formulario" });
  }

  // 1. Guardar nuevo registro en Sheety
  const saveRes = await fetch(`${SHEETY_URL}/formResponses1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formResponse1: {
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

  // 2. Leer todos los registros del Sheet
  const allRes = await fetch(`${SHEETY_URL}/formResponses1`);
  if (!allRes.ok) {
    return res.status(502).json({ error: "Error al leer los registros" });
  }
  const allData = await allRes.json();
  const todos = allData.formResponses1 || [];

  // 3. Armar prompt para Claude con todos los inscriptos
  const lista = todos.map((p, i) =>
    `${i + 1}. ${p.nombreCompletoDelParticipante} | Idioma: ${p["¿quéIdiomaQuieresPracticar?"]} | Nivel: ${p["¿cuálEsTuNivelActual?"]} | Zona: ${p["¿enQuéZonaHorariaEstás?"]} | Franja: ${p["¿enQuéFranjaHorariaPuedesTomarClases?"]}`
  ).join("\n");

  const prompt = `
Sos un asistente que organiza clases de idiomas para una empresa.

Lista de participantes inscriptos:
${lista}

El último participante (${nombre}) acaba de inscribirse. Asignalo al grupo más adecuado.

Reglas:
- Grupos de 4 a 6 personas (si hay pocos, está bien un grupo menor)
- Mismo idioma obligatorio
- Niveles compatibles: A1+A2 juntos, B1+B2 juntos, C1 solo
- Zona horaria: diferencia máxima de 3 horas entre miembros
- Argentina (UTC-3) y Colombia (UTC-5) son compatibles
- Argentina (UTC-3) y España (UTC+1) NO son compatibles
- México (UTC-6) y Colombia (UTC-5) son compatibles
- Franja horaria: los miembros del grupo deben compartir la misma franja o franjas compatibles

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
    const errBody = await claudeRes.text();
    console.error("Error de la API de Claude:", claudeRes.status, errBody);
    return res.status(502).json({ error: "Error al contactar la IA" });
  }

  const claudeData = await claudeRes.json();
  const texto = claudeData.content[0].text.replace(/```json|```/g, "").trim();

  let grupo;
  try {
    grupo = JSON.parse(texto);
  } catch {
    console.error("Respuesta de Claude no es JSON válido:", texto);
    return res.status(500).json({ error: "La IA devolvió una respuesta inesperada" });
  }

  // 5. Guardar grupo en Sheety (todos los miembros en una sola fila)
  const todosMiembros = [nombre, ...grupo.companeros].join(", ");
  await fetch(`${SHEETY_URL}/grupos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grupo: {
        grupoNumero:     grupo.grupo_numero,
        idioma:          grupo.idioma,
        nivel:           grupo.nivel,
        horarioSugerido: grupo.horario_sugerido,
        miembros:        todosMiembros,
        estado:          "ok"
      }
    })
  }).catch(e => console.error("Error guardando grupo en Sheety (no crítico):", e));

  return res.status(200).json(grupo);
}
