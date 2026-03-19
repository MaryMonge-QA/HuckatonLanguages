const GAS_URL = "https://script.google.com/macros/s/AKfycbzatCJ2avezijxtbG2hj4-eFFxVyYAjlGIMG83z4eVr0TB_lSrYxZ7OnqGBAsybsBWM/exec";

export default async function handler(req, res) {
  const { sheet } = req.query;
  if (!sheet) return res.status(400).json({ error: "Falta parámetro 'sheet'" });

  const r = await fetch(`${GAS_URL}?sheet=${sheet}`);
  if (!r.ok) return res.status(502).json({ error: "Error al leer datos" });

  const data = await r.json();
  return res.status(200).json(data);
}
