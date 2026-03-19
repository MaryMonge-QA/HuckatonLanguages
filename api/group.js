const participantesExistentes = [
  { nombre: "Martín López",   idioma: "Inglés",    nivel: "B1", zona: "Argentina" },
  { nombre: "Sofía Ramírez",  idioma: "Inglés",    nivel: "B2", zona: "México" },
  { nombre: "Diego Herrera",  idioma: "Inglés",    nivel: "B1", zona: "Argentina" },
  { nombre: "Laura Méndez",   idioma: "Portugués", nivel: "A2", zona: "Colombia" },
  { nombre: "Carlos Vega",    idioma: "Francés",   nivel: "A1", zona: "España" },
  { nombre: "María Castillo", idioma: "Inglés",    nivel: "B2", zona: "Argentina" },
  { nombre: "Pablo Torres",   idioma: "Portugués", nivel: "A1", zona: "Argentina" },
  { nombre: "Valentina Ruiz", idioma: "Francés",   nivel: "A2", zona: "Colombia" },
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { nombre, email, idioma, nivel, zona } = req.body;

  if (!nombre || !idioma || !nivel || !zona) {
    return res.status(400).json({ error: "Faltan datos del formulario" });
  }

  const todos = [
    ...participantesExistentes,
    { nombre, idioma, nivel, zona }
  ];

  const lista = todos.map((p, i) =>
    `${i + 1}. ${p.nombre} | Idioma: ${p.idioma} | Nivel: ${p.nivel} | Zona: ${p.zona}`
  ).join("\n");

  const prompt = `
Sos un asistente que organiza clases de idiomas para una empresa.

Lista de participantes:
${lista}

El último participante (${nombre}) acaba de inscribirse. Asignalo al grupo más adecuado.

Reglas:
- Grupos de 4 a 6 personas (si hay pocos, está bien un grupo menor)
- Mismo idioma obligatorio
- Niveles compatibles: A1+A2 juntos, B1+B2 juntos, C1 solo
- Zona horaria: diferencia máxima de 3 horas entre miembros
- Argentina y Colombia son compatibles (1 hora de diferencia)
- Argentina y España NO son compatibles (4-5 horas de diferencia)
- México y Colombia son compatibles (1 hora de diferencia)

Respondé ÚNICAMENTE con un JSON válido, sin texto extra, sin bloques de código:
{
  "grupo_numero": 1,
  "idioma": "Inglés",
  "nivel": "B1-B2",
  "horario_sugerido": "18:00 ARG / 17:00 COL",
  "companeros": ["Nombre 1", "Nombre 2"],
  "mensaje": "Bienvenida corta y amigable, máximo 20 palabras."
}
`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
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

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Error de la API de Claude:", response.status, errBody);
      return res.status(502).json({ error: "Error al contactar la IA" });
    }

    const data  = await response.json();
    const texto = data.content[0].text.replace(/```json|```/g, "").trim();

    let grupo;
    try {
      grupo = JSON.parse(texto);
    } catch {
      console.error("Respuesta de Claude no es JSON válido:", texto);
      return res.status(500).json({ error: "La IA devolvió una respuesta inesperada" });
    }

    return res.status(200).json(grupo);

  } catch (error) {
    console.error("Error llamando a Claude:", error);
    return res.status(500).json({ error: "Error al procesar la solicitud" });
  }
}