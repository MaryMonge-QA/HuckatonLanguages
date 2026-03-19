const GAS_URL = "https://script.google.com/macros/s/AKfycbzatCJ2avezijxtbG2hj4-eFFxVyYAjlGIMG83z4eVr0TB_lSrYxZ7OnqGBAsybsBWM/exec";

async function clearSheet(sheet) {
  await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "clearSheet", sheet })
  }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  await clearSheet("grupos");
  await clearSheet("asistencia");
  await clearSheet("inscripciones");

  return res.status(200).json({ ok: true });
}
