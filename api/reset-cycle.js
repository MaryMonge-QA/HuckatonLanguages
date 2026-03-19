const SHEETY_URL = "https://api.sheety.co/782c0e1ef97d36c7932073da8a8a8954/sistemaClasesIdiomas";

async function deleteAll(sheet) {
  const res = await fetch(`${SHEETY_URL}/${sheet}`);
  if (!res.ok) return;
  const rows = (await res.json())[sheet] || [];
  for (const row of rows) {
    await fetch(`${SHEETY_URL}/${sheet}/${row.id}`, { method: "DELETE" }).catch(() => {});
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
