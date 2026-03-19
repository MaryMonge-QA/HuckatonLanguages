const GAS_URL = "https://script.google.com/macros/s/AKfycbxotkr2FO1P8f1b4g-dEfbSezW2cMCzpVmXr4dJ6UCtpvCr0U7PD4YfkAA237cQc59j/exec";

async function deleteAll(sheet) {
  const res = await fetch(`${GAS_URL}?sheet=${sheet}`);
  if (!res.ok) return;
  const rows = (await res.json())[sheet] || [];
  for (const row of rows) {
    await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", sheet, id: row.id })
    }).catch(() => {});
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  await deleteAll("grupos");
  await deleteAll("asistencia");

  return res.status(200).json({ ok: true });
}
