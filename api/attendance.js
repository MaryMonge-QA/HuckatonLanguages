const SHEETY_URL     = "https://api.sheety.co/782c0e1ef97d36c7932073da8a8a8954/sistemaClasesIdiomas";
const EMAILJS_URL    = "https://api.emailjs.com/api/v1.0/email/send";
const EMAILJS_SERVICE  = "service_9n8jsmc";
const EMAILJS_TEMPLATE = "template_1vdttpi";
const EMAILJS_PUBLIC_KEY = "ZPdDDpCz3TRIZf-qj";

function parseFecha(fecha) {
  // Soporta "19/3/2026" y "2026-03-19"
  if (!fecha) return new Date(0);
  if (fecha.includes("-")) return new Date(fecha);
  const [d, m, y] = fecha.split("/");
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const r = await fetch(`${SHEETY_URL}/asistencia`);
  if (!r.ok) return res.status(502).json({ error: "Error al leer la asistencia" });

  const registros = (await r.json()).asistencia || [];
  if (registros.length === 0) return res.status(200).json({ alertas: [], enviados: [] });

  // Agrupar por nombre
  const porPersona = {};
  for (const reg of registros) {
    const key = reg.nombre;
    if (!key) continue;
    if (!porPersona[key]) porPersona[key] = [];
    porPersona[key].push(reg);
  }

  // Detectar 4+ ausencias consecutivas
  const alertas = [];
  for (const nombre in porPersona) {
    const historial = porPersona[nombre].sort((a, b) => parseFecha(a.fecha) - parseFecha(b.fecha));

    let consecutivas = 0;
    let maxConsecutivas = 0;

    for (const reg of historial) {
      if (reg.estatus === "Ausente") {
        consecutivas++;
        maxConsecutivas = Math.max(maxConsecutivas, consecutivas);
      } else {
        consecutivas = 0;
      }
    }

    if (maxConsecutivas >= 4) {
      const ultimo = historial[historial.length - 1];
      alertas.push({
        nombre,
        grupo:               ultimo.grupo,
        ausenciasConsecutivas: maxConsecutivas
      });
    }
  }

  // Mandar email por cada alerta
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
            grupo:    `Grupo ${alerta.grupo}`,
            ausencias: alerta.ausenciasConsecutivas
          }
        })
      });
      enviados.push({ nombre: alerta.nombre, ok: emailRes.ok });
    } catch (e) {
      enviados.push({ nombre: alerta.nombre, ok: false, error: e.message });
    }
  }

  return res.status(200).json({ alertas, enviados });
}
