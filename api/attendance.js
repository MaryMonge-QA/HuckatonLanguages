const SHEETY_URL = "https://api.sheety.co/782c0e1ef97d36c7932073da8a8a8954/sistemaClasesIdiomas";

const EMAILJS_URL   = "https://api.emailjs.com/api/v1.0/email/send";
const EMAILJS_SERVICE  = "service_9n8jsmc";
const EMAILJS_TEMPLATE = "template_1vdttpi";
const EMAILJS_PUBLIC_KEY = "ZPdDDpCz3TRIZf-qj";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // 1. Leer registros de asistencia desde Sheety
  const r = await fetch(`${SHEETY_URL}/asistencia`);
  if (!r.ok) {
    return res.status(502).json({ error: "Error al leer la asistencia" });
  }
  const data = await r.json();
  const registros = data.asistencia || [];

  if (registros.length === 0) {
    return res.status(200).json({ alertas: [], enviados: [] });
  }

  // 2. Agrupar historial por persona (por email)
  const porPersona = {};
  for (const r of registros) {
    const key = r.email || r.nombre;
    if (!porPersona[key]) porPersona[key] = [];
    porPersona[key].push(r);
  }

  // 3. Detectar 3+ ausencias consecutivas
  const alertas = [];
  for (const key in porPersona) {
    const historial = porPersona[key].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    let consecutivas = 0;
    let maxConsecutivas = 0;

    for (const registro of historial) {
      const ausente =
        registro.asistio === false ||
        registro.asistio === "FALSE" ||
        registro.asistio === "false" ||
        registro.asistio === "No" ||
        registro.asistio === "no" ||
        registro.asistio === "0";

      if (ausente) {
        consecutivas++;
        maxConsecutivas = Math.max(maxConsecutivas, consecutivas);
      } else {
        consecutivas = 0;
      }
    }

    if (maxConsecutivas >= 3) {
      const ultimo = historial[historial.length - 1];
      alertas.push({
        nombre: ultimo.nombre,
        email: ultimo.email || key,
        grupoNumero: ultimo.grupoNumero,
        ausenciasConsecutivas: maxConsecutivas
      });
    }
  }

  // 4. Mandar email de alerta por cada persona con 3+ ausencias
  const enviados = [];
  for (const alerta of alertas) {
    try {
      const emailRes = await fetch(EMAILJS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id:  EMAILJS_SERVICE,
          template_id: EMAILJS_TEMPLATE,
          user_id:     EMAILJS_PUBLIC_KEY,
          template_params: {
            to_name:  alerta.nombre,
            to_email: alerta.email,
            grupo:    `Grupo ${alerta.grupoNumero}`,
            ausencias: alerta.ausenciasConsecutivas
          }
        })
      });

      enviados.push({ nombre: alerta.nombre, ok: emailRes.ok, status: emailRes.status });
    } catch (e) {
      console.error(`Error enviando email a ${alerta.nombre}:`, e);
      enviados.push({ nombre: alerta.nombre, ok: false, error: e.message });
    }
  }

  return res.status(200).json({ alertas, enviados });
}
