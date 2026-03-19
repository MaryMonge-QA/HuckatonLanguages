const GAS_URL = "https://script.google.com/macros/s/AKfycbxotkr2FO1P8f1b4g-dEfbSezW2cMCzpVmXr4dJ6UCtpvCr0U7PD4YfkAA237cQc59j/exec";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { grupo, alumnos } = req.body;
  // Convertir fecha ISO (2026-03-19) a formato d/m/yyyy para el Sheet
  const rawFecha = req.body.fecha || new Date().toISOString().split("T")[0];
  const [y, m, d] = rawFecha.split("-");
  const fecha = `${parseInt(d)}/${parseInt(m)}/${y}`;

  if (!grupo || !alumnos || alumnos.length === 0) {
    return res.status(400).json({ error: "Faltan datos de la sesión" });
  }

  for (const alumno of alumnos) {
    const postRes = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "add",
        sheet: "asistencia",
        data: {
          nombre:  alumno.nombre,
          fecha,
          grupo,
          estatus: alumno.estatus
        }
      })
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      console.error("Error guardando asistencia:", err);
      return res.status(502).json({ error: "Error al guardar la asistencia: " + err });
    }
  }

  return res.status(200).json({ ok: true, sesionGuardada: alumnos.length });
}
