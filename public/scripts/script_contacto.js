// ============================================================
// scripts/script_contacto.js
// ============================================================

const MAX_INTENTOS  = 5;
const STORAGE_KEY   = "intentos_data"; // { restantes, resetEpoch }



// ── Reset diario a medianoche hora Ecuador (America/Guayaquil) ──────────────
// Devuelve el epoch (ms) de la próxima medianoche en Guayaquil desde ahora
function proximaMedianocheEC() {
  const ahora    = new Date();
  // Obtener fecha actual en zona Guayaquil
  const partes   = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(ahora);
  const year  = partes.find(p => p.type === "year").value;
  const month = partes.find(p => p.type === "month").value;
  const day   = partes.find(p => p.type === "day").value;
  // Medianoche del día siguiente en Guayaquil
  const manana = `${year}-${month}-${day}T00:00:00`;
  // Convertir "medianoche de mañana en Guayaquil" a epoch UTC
  // Guayaquil es UTC-5 (sin horario de verano)
  const epochLocal = new Date(manana).getTime() + 24 * 60 * 60 * 1000;
  // epochLocal es en UTC mal, necesitamos recalcular
  // Usamos el truco: construimos la fecha en UTC sabiendo que GYE = UTC-5
  const medianoche = new Date(`${year}-${month}-${day}T05:00:00Z`); // 00:00 GYE = 05:00 UTC
  if (medianoche <= ahora) {
    // ya pasó la medianoche de hoy → siguiente es mañana
    medianoche.setUTCDate(medianoche.getUTCDate() + 1);
  }
  return medianoche.getTime();
}

// Lee el estado y aplica reset si ya llegó la medianoche
function leerEstado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { restantes: MAX_INTENTOS, resetEpoch: proximaMedianocheEC() };
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.resetEpoch !== "number") {
      return { restantes: MAX_INTENTOS, resetEpoch: proximaMedianocheEC() };
    }
    // Si ya pasó la medianoche programada → reset
    if (Date.now() >= obj.resetEpoch) {
      const nuevoEstado = { restantes: MAX_INTENTOS, resetEpoch: proximaMedianocheEC() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevoEstado));
      return nuevoEstado;
    }
    const restantes = typeof obj.restantes === "number"
      ? Math.min(Math.max(obj.restantes, 0), MAX_INTENTOS)
      : MAX_INTENTOS;
    return { restantes, resetEpoch: obj.resetEpoch };
  } catch {
    return { restantes: MAX_INTENTOS, resetEpoch: proximaMedianocheEC() };
  }
}

function guardarEstado(restantes, resetEpoch) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ restantes, resetEpoch }));
}

// ── Filtro de insultos ────────────────────────────────────────────────────────
// Lista amplia: incluye abreviaciones, leetspeak y variantes comunes
const INSULTOS_RAW = [
  // Abreviaciones directas (más prioritarias)
  "mmv","ctm","ptm","hdp","hp","stfu","wtf",

  //partes del cuerpo 
  "pene", "p3n3", "pen3", "p.e.n.e", "p_en_e",
  "penes", "p3n35", "pen35",
  "vagina", "v4g1n4", "vag1na", "v@g1n@", "v.a.g.i.n.a",
  "vaginas", "v4g1n45", "vag1n45",
  "culo", "cu10", "ku1o", "c.u.l.o", "c_ul_o",
  "culos", "cu105", "ku1o5",

  // Español Ecuador / Latino
  "mierda","mierd4","mi3rda","mrd","mrda",
  "puta","put4","pta","pts",
  "chucha",
  "puto","put0","pto",
  "pendejo","pend3jo","pendej0","pndj","pdj",
  "estupido","estupida","stpd",
  "idiota","idiot4",
  "imbecil","imb3cil",
  "cabron","cabr0n","cbr","kbr",
  "verga","v3rga","vrg",
  "concha","cnch",
  "culo","cul0","kulo",
  "marica","mar1ca","mrk","mrc",
  "marico","mar1co",
  "malparido","malparid0","mlprd",
  "hijueputa","hjpt","hjputa",
  "hijuemadre","hjmdr",
  "gonorrea","gnrr",
  "hdeputa","hdepta",
  "reverenda","rvrnda",
  "careculo","crculo",
  "bastardo","bstrd",
  "perra","perr4","prr",
  "zorra","zorr4","zrr",
  "subnormal",
  "retrasado","retrasada","rtrsd",
  "mongolo",
  "carajo","caraj0","crj","krj","craj",
  "joto","jot0",
  "chinga","chingada",
  "cono","coño","c0no","koño","kono",
  "malcriado","malcriada","mlkrd",
  "desgraciado","desgraciada","dsgrd",
  "maldito","maldita","mldt",
  "pito","pit0",
  "pija","pij4",
  "webon","huevon","gvn","guevon","hvn",
  "culero","kulero",
  "cagate","cágate",
  "ojete",
  "pinche","pnch",
  "forro","frr",
  "cagada","cgd",
  "pelotudo","plt",
  "tarado","trd",
  "bobo","b0b0",
  
  // Inglés ofensivo básico
  "fuck","fck","fuk","fck","fvck",
  "shit","sh1t","sht",
  "bitch","b1tch","btch",
  "asshole","a55hole","ahole",
  "bastard",
  "damn","dammit",
  "cunt","cnt",
  "dick","dck",
  "cock","c0ck",
  "whore","wh0re",
  "slut","sl0t",
  "nigga","n1gga",
  "idiot","moron","stupid","dumbass","loser"
];

// Normaliza: minúsculas, sin tildes, reemplaza leetspeak, quita no-letras
function normalizar(txt) {
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/4/g, "a")
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/\$/g, "s")
    .replace(/[^a-z]/g, "");
}

const INSULTOS_NORM = INSULTOS_RAW.map(w => normalizar(w));

// Devuelve la palabra original que disparó el filtro, o null si está limpio
function detectarInsulto(texto) {
  const norm = normalizar(texto);
  for (let i = 0; i < INSULTOS_NORM.length; i++) {
    if (norm.includes(INSULTOS_NORM[i])) return INSULTOS_RAW[i];
  }
  return null;
}

// ── Helpers UI ───────────────────────────────────────────────
function renderDots(n) {
  document.querySelectorAll("#dots .dot").forEach((d, i) => d.classList.toggle("used", i >= n));
}
function setStatus(msg, color = "#aaa") {
  const el = document.getElementById("statusMsg");
  if (el) { el.textContent = msg; el.style.color = color; }
}
function showNotif(title, body) {
  const notif = document.getElementById("notif");
  const t     = document.getElementById("notifTitle");
  const b     = document.getElementById("notifBody");
  if (!notif) return;
  if (t) t.textContent = title;
  if (b) b.textContent = body;
  notif.classList.add("show");
  setTimeout(() => notif.classList.remove("show"), 4000);
}

// ── Reloj ────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById("clockTime");
  if (el) el.textContent = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
}
updateClock();
setInterval(updateClock, 1000);

// ── Formatear coord ──────────────────────────────────────────
function fmtCoord(val) {
  if (val === null || val === undefined) return null;
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return null;
  return n.toFixed(6);
}

// ── GPS del navegador ────────────────────────────────────────
function pedirGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitud:  pos.coords.latitude.toFixed(6),
          longitud: pos.coords.longitude.toFixed(6),
          precision: pos.coords.accuracy
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

// ── ipapi.co desde el navegador ──────────────────────────────
function pedirIpapi() {
  return fetch("https://ipapi.co/json/")
    .then(r => r.json())
    .catch(() => null);
}

// ── Geo principal ────────────────────────────────────────────
async function obtenerGeo() {
  const [gps, ipapi] = await Promise.all([pedirGPS(), pedirIpapi()]);

  const ip     = ipapi?.ip           ?? "no disponible";
  const ciudad = ipapi?.city         ?? "";
  const region = ipapi?.region       ?? "";
  const pais   = ipapi?.country_name ?? "";

  if (gps) {
    return { ip, ciudad, region, pais,
             latitud: gps.latitud, longitud: gps.longitud,
             fuenteGeo: "GPS/navegador" };
  }

  return { ip, ciudad, region, pais,
           latitud:  fmtCoord(ipapi?.latitude),
           longitud: fmtCoord(ipapi?.longitude),
           fuenteGeo: "IP/ipapi.co" };
}



// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  let estado = leerEstado();
  renderDots(estado.restantes);

  const sendBtn   = document.getElementById("sendBtn");
  const fieldName = document.getElementById("fieldName");
  const fieldMsg  = document.getElementById("fieldMsg");

  if (!sendBtn) return;

  if (estado.restantes <= 0) {
    sendBtn.disabled = true;
    // Mostrar cuándo se restauran
    const resetDate = new Date(estado.resetEpoch);
    const horaReset = resetDate.toLocaleTimeString("es-EC", {
      timeZone: "America/Guayaquil",
      hour: "2-digit", minute: "2-digit"
    });
    setStatus(`🚫 Sin intentos. Se restauran a las ${horaReset} (hora Ecuador).`, "#ef4444");
  }

  sendBtn.addEventListener("click", async () => {
    const nombre  = fieldName?.value.trim() || "";
    const mensaje = fieldMsg?.value.trim()  || "";

    if (!nombre)  { setStatus("⚠ Por favor escribe tu nombre.", "#f97316"); return; }
    if (!mensaje) { setStatus("⚠ El mensaje no puede estar vacío.", "#f97316"); return; }

    // ── Verificar estado actualizado (por si ya pasó la medianoche mientras estaba abierta la página)
    estado = leerEstado();
    renderDots(estado.restantes);

    if (estado.restantes <= 0) {
      sendBtn.disabled = true;
      const resetDate = new Date(estado.resetEpoch);
      const horaReset = resetDate.toLocaleTimeString("es-EC", {
        timeZone: "America/Guayaquil",
        hour: "2-digit", minute: "2-digit"
      });
      setStatus(`🚫 Sin intentos. Se restauran a las ${horaReset} (hora Ecuador).`, "#ef4444");
      return;
    }

    // ── Filtro de insultos ──────────────────────────────────
    const insultoNombre  = detectarInsulto(nombre);
    const insultoMensaje = detectarInsulto(mensaje);
    if (insultoNombre || insultoMensaje) {
      setStatus("⛔ Tu mensaje contiene lenguaje inapropiado. Por favor, sé respetuoso.", "#ef4444");
      return;
    }

    sendBtn.disabled = true;
    setStatus("📡 Obteniendo ubicación…", "#60a5fa");

    try {
      const geo = await obtenerGeo();

      setStatus("📨 Enviando mensaje…", "#60a5fa");

      const resp = await fetch("/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre, mensaje,
          ip:        geo.ip,
          latitud:   geo.latitud,
          longitud:  geo.longitud,
          fuenteGeo: geo.fuenteGeo,
          ciudad:    geo.ciudad,
          region:    geo.region,
          pais:      geo.pais
        })
      });

      const result = await resp.json();

      if (result.ok) {
        estado.restantes--;
        guardarEstado(estado.restantes, estado.resetEpoch);
        renderDots(estado.restantes);
        setStatus("✅ Mensaje enviado.", "#4ade80");
        showNotif(nombre, mensaje.length > 40 ? mensaje.slice(0, 40) + "…" : mensaje);
        if (fieldName) fieldName.value = "";
        if (fieldMsg)  fieldMsg.value  = "";

        if (estado.restantes <= 0) {
          sendBtn.disabled = true;
          const resetDate = new Date(estado.resetEpoch);
          const horaReset = resetDate.toLocaleTimeString("es-EC", {
            timeZone: "America/Guayaquil",
            hour: "2-digit", minute: "2-digit"
          });
          setStatus(`🚫 Sin intentos. Se restauran a las ${horaReset} (hora Ecuador).`, "#ef4444");
        } else {
          sendBtn.disabled = false;
        }
      } else {
        setStatus("❌ Error al enviar. Intenta de nuevo.", "#ef4444");
        sendBtn.disabled = false;
      }
    } catch (err) {
      console.error("[contacto] Error:", err);
      setStatus("❌ Error de conexión.", "#ef4444");
      sendBtn.disabled = false;
    }
  });
});