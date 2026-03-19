const SHEETY_URL = "https://api.sheety.co/782c0e1ef97d36c7932073da8a8a8954/sistemaClasesIdiomas";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { nombre, email, idioma, nivel, zona, franja } = req.body;

  if (!nombre || !idioma || !nivel || !zona || !franja) {
    return res.status(400).json({ error: "Faltan datos del formulario" });
  }

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

  return res.status(200).json({ ok: true });
}
