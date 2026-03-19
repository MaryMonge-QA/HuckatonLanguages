const GAS_URL = "https://script.google.com/a/macros/humand.co/s/AKfycbxotkr2FO1P8f1b4g-dEfbSezW2cMCzpVmXr4dJ6UCtpvCr0U7PD4YfkAA237cQc59j/exec";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { nombre, email, idioma, nivel, zona, franja } = req.body;

  if (!nombre || !idioma || !nivel || !zona || !franja) {
    return res.status(400).json({ error: "Faltan datos del formulario" });
  }

  const saveRes = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "add",
      sheet: "formResponses1",
      data: {
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
    console.error("Error guardando en Apps Script:", await saveRes.text());
    return res.status(502).json({ error: "Error al guardar el registro" });
  }

  return res.status(200).json({ ok: true });
}
