const GAS_URL = "https://script.google.com/macros/s/AKfycbxotkr2FO1P8f1b4g-dEfbSezW2cMCzpVmXr4dJ6UCtpvCr0U7PD4YfkAA237cQc59j/exec";

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
    redirect: "follow",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "add",
      sheet: "inscripciones",
      data: {
        timestamp: new Date().toLocaleString("es-AR"),
        nombre,
        email,
        idioma,
        nivel,
        zona,
        franja
      }
    })
  });

  const responseText = await saveRes.text();
  console.log("Apps Script status:", saveRes.status, "body:", responseText);

  if (!saveRes.ok) {
    return res.status(502).json({ error: "Error al guardar el registro", detail: responseText });
  }

  return res.status(200).json({ ok: true });
}
