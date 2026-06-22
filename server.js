import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config({ path: "./config.env" });

const app     = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

app.use(express.json());
app.use(express.static(__dirname));

// ── CORS: permite que el frontend llame a /geo y /enviar ─────
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});


// ── Reset de intentos ────────────────────────────────────────
app.get("/admin/reset", (req, res) => {
    const IP_ADMIN = "192.168.255.3";
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    if (ip !== IP_ADMIN) return res.status(403).send("No autorizado");
    res.send(`<script>localStorage.removeItem("intentos_restantes");document.write("✅ Reseteado. <a href='/'>Volver</a>");</script>`);
});

// ── Resend ───────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ── /geo — IP lookup con 3 APIs encadenadas ──────────────────
// El navegador no puede llamar a ip-api.com (HTTP bloqueado en HTTPS)
// El servidor sí puede. Usamos 3 fuentes con fallback.
app.get("/geo", async (req, res) => {
    // IP real del visitante
    const ipRaw = (req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
                || req.socket.remoteAddress?.replace("::ffff:", "")
                || "").replace("::ffff:", "");

    const esLocal = !ipRaw || ["127.0.0.1","::1"].includes(ipRaw)
        || ipRaw.startsWith("192.168.") || ipRaw.startsWith("10.")
        || /^172\.(1[6-9]|2\d|3[01])\./.test(ipRaw);

    console.log(`[/geo] IP detectada: "${ipRaw}" esLocal=${esLocal}`);

    // ── API 1: ip-api.com (HTTP, gratuito, preciso) ──────────
    async function tryIpApi(ip) {
        const url = esLocal
            ? "http://ip-api.com/json/?fields=status,message,query,country,regionName,city,lat,lon,isp,org"
            : `http://ip-api.com/json/${ip}?fields=status,message,query,country,regionName,city,lat,lon,isp,org`;
        const d = await fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.json());
        if (d.status !== "success") throw new Error(d.message || "ip-api fallo");
        return { ip: d.query, latitud: d.lat, longitud: d.lon,
                 ciudad: d.city, region: d.regionName, pais: d.country, isp: d.org || d.isp };
    }

    // ── API 2: ipwho.is (HTTPS, gratuito) ───────────────────
    async function tryIpWho(ip) {
        const url = esLocal ? "https://ipwho.is/" : `https://ipwho.is/${ip}`;
        const d = await fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.json());
        if (!d.success) throw new Error(d.message || "ipwho fallo");
        return { ip: d.ip, latitud: d.latitude, longitud: d.longitude,
                 ciudad: d.city, region: d.region, pais: d.country, isp: d.connection?.isp || "" };
    }

    // ── API 3: freeipapi.com (HTTPS, gratuito) ──────────────
    async function tryFreeIpApi(ip) {
        const url = esLocal ? "https://freeipapi.com/api/json" : `https://freeipapi.com/api/json/${ip}`;
        const d = await fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.json());
        if (!d.ipAddress) throw new Error("freeipapi fallo");
        return { ip: d.ipAddress, latitud: d.latitude, longitud: d.longitude,
                 ciudad: d.cityName, region: d.regionName, pais: d.countryName, isp: "" };
    }

    const intentos = [tryIpApi, tryIpWho, tryFreeIpApi];
    let ultimo_error = "";

    for (const fn of intentos) {
        try {
            const datos = await fn(ipRaw);
            console.log(`[/geo] OK con ${fn.name}:`, datos);
            return res.json({ ok: true, ...datos });
        } catch (e) {
            ultimo_error = e.message;
            console.warn(`[/geo] ${fn.name} falló: ${e.message}`);
        }
    }

    console.error("[/geo] Todas las APIs fallaron:", ultimo_error);
    res.json({ ok: false, ip: ipRaw || "no disponible",
               latitud: null, longitud: null, ciudad: "", region: "", pais: "", isp: "" });
});

// ── /enviar — recibe datos y manda correo ────────────────────
app.post("/enviar", async (req, res) => {
    try {
        const { nombre, mensaje, ip, latitud, longitud, fuenteGeo, ciudad, region, pais } = req.body;

        const ipStr     = ip     || "no disponible";
        // Mantener los decimales exactos que vienen del GPS del navegador — sin toFixed
        const latNum    = (latitud  != null && latitud  !== "no disponible") ? parseFloat(latitud)  : null;
        const lonNum    = (longitud != null && longitud !== "no disponible") ? parseFloat(longitud) : null;
        const latStr    = latNum !== null ? String(latNum) : "no disponible";
        const lonStr    = lonNum !== null ? String(lonNum) : "no disponible";
        const fuente    = fuenteGeo  || "desconocida";
        const ciudadStr = ciudad || "";
        const regionStr = region || "";
        const paisStr   = pais   || "";

        const tieneCoords = latNum !== null && lonNum !== null;
        const mapsLink    = tieneCoords ? `https://www.google.com/maps?q=${latStr},${lonStr}` : null;

        console.log("[/enviar] datos recibidos:", { nombre, ip: ipStr, latStr, lonStr, fuente, ciudadStr, paisStr });

        const data = await resend.emails.send({
            from: "onboarding@resend.dev",
            to:   process.env.TO_EMAIL,
            subject: `📩 Nuevo mensaje desde UNEDOL — ${nombre}`,
            html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">
    📩 Nuevo mensaje desde UNEDOL
  </h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr><td style="padding:8px 0;font-weight:bold;color:#475569;width:120px;">Nombre</td>
        <td style="padding:8px 0;color:#0f172a;">${escapeHtml(nombre)}</td></tr>
    <tr style="background:#f8fafc;">
        <td style="padding:8px;font-weight:bold;color:#475569;">Mensaje</td>
        <td style="padding:8px;color:#0f172a;white-space:pre-wrap;">${escapeHtml(mensaje)}</td></tr>
  </table>

  <h3 style="color:#1e293b;margin-top:24px;">📍 Datos de ubicación</h3>
  <table style="width:100%;border-collapse:collapse;background:#f1f5f9;padding:4px;">
    <tr><td style="padding:6px 10px;font-weight:bold;color:#475569;width:130px;">IP</td>
        <td style="padding:6px 10px;color:#0f172a;font-family:monospace;">${escapeHtml(ipStr)}</td></tr>
    ${ciudadStr ? `<tr><td style="padding:6px 10px;font-weight:bold;color:#475569;">Ubicación</td>
        <td style="padding:6px 10px;color:#0f172a;">${escapeHtml(ciudadStr)}${regionStr ? ", " + escapeHtml(regionStr) : ""}${paisStr ? " — " + escapeHtml(paisStr) : ""}</td></tr>` : ""}
    <tr><td style="padding:6px 10px;font-weight:bold;color:#475569;">Latitud</td>
        <td style="padding:6px 10px;color:#0f172a;font-family:monospace;">${latStr}</td></tr>
    <tr><td style="padding:6px 10px;font-weight:bold;color:#475569;">Longitud</td>
        <td style="padding:6px 10px;color:#0f172a;font-family:monospace;">${lonStr}</td></tr>
    <tr><td style="padding:6px 10px;font-weight:bold;color:#475569;">Fuente geo</td>
        <td style="padding:6px 10px;color:#64748b;">${escapeHtml(fuente)}</td></tr>
  </table>

  ${mapsLink ? `<div style="margin-top:16px;">
    <a href="${mapsLink}" style="display:inline-block;background:#2563eb;color:#fff;
       padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
      🗺 Ver en Google Maps
    </a>
  </div>` : ""}

  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
    Enviado el ${new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}
  </p>
</div>`
        });

        console.log("[/enviar] Resend OK:", data.data?.id);
        res.json({ ok: true });

    } catch (error) {
        console.error("[/enviar] Error:", error.message);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ── Anti-XSS ─────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

// ── Proxy imágenes ───────────────────────────────────────────
app.get("/proxy-img", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("Falta url");
    try {
        const r = await fetch(url, { headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://www.instagram.com/",
            "Accept": "image/*,*/*;q=0.8"
        }});
        if (!r.ok) return res.status(r.status).send("Error");
        res.set("Content-Type", r.headers.get("content-type") || "image/jpeg");
        res.set("Cache-Control", "public, max-age=86400");
        res.send(Buffer.from(await r.arrayBuffer()));
    } catch(e) { res.status(500).send("Error interno"); }
});

// ── Servidor ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en http://localhost:${PORT}`));