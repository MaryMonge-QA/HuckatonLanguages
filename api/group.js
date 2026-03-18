import { GoogleGenerativeAI } from "@google/generative-ai";

const participantesExistentes = [
  { nombre: "Martín López",   idioma: "Inglés",    nivel: "B1", zona: "Argentina" },
  { nombre: "Sofía Ramírez",  idioma: "Inglés",    nivel: "B2", zona: "México" },
  { nombre: "Diego Herrera",  idioma: "Inglés",    nivel: "B1", zona: "Argentina" },
  { nombre: "Laura Méndez",   idioma: "Portugués", nivel: "A2", zona: "Colombia" },
  { nombre: "Carlos Vega",    idioma: "Francés",   nivel: "A1", zona: "España" }
];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const { nombre, email, idioma, nivel, zona } = req.body;
  if (!nombre || !idioma || !nivel || !zona) return res.status(400).json({ error: "Faltan datos" });

  const todos = [...participantesExistentes, { nombre, idioma, nivel, zona }];
  const lista = todos.map((p, i) => `${i + 1}. ${p.nombre} | ${p.idioma} | ${p.nivel} | ${p.zona}`).join("\n");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" } // Obliga a devolver JSON
  });

  const prompt = `
    Sos un asistente de RRHH organizando clases de idiomas.
    Lista actual:
    ${lista}

    Nuevo inscripto: ${nombre}. Asígnalo al grupo ideal.
    
    Reglas:
    - Mismo idioma obligatorio.
    - Niveles compatibles: A1+A2, B1+B2, C1 solo.
    - Zona horaria: max 3 horas de diferencia (ARG y COL compatibles, ARG y ESP NO).
    
    Devuelve ÚNICAMENTE un JSON válido con este formato:
    {
      "grupo_numero": "A1",
      "idioma": "${idioma}",
      "nivel": "${nivel}",
      "horario_sugerido": "18:00 (Hora local)",
      "companeros": ["Nombre 1", "Nombre 2"],
      "mensaje": "¡Bienvenido a Humanitas!"
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const grupo = JSON.parse(result.response.text());
    return res.status(200).json(grupo);
  } catch (error) {
    console.error("Error en Gemini:", error);
    return res.status(500).json({ error: "Fallo el motor IA" });
  }
}