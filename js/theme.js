// theme.js - generación y aplicación de paleta a partir de un color base
// Objetivo: tomar themeColor (hex) y producir variables CSS reutilizables + overrides de utilidades tailwind usadas en la app.

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function hexToRgb(hex) {
  if (!hex) return { r: 0, g: 0, b: 0 };
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(hex, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex(r, g, b) {
  const toHex = (x) => x.toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function mix(hex, percent, to) {
  // percent 0-100 toward white or black
  const { r, g, b } = hexToRgb(hex);
  let tr, tg, tb;
  if (to === "white") {
    tr = 255;
    tg = 255;
    tb = 255;
  } else {
    tr = 0;
    tg = 0;
    tb = 0;
  }
  const p = clamp(percent, 0, 100) / 100;
  return rgbToHex(
    Math.round(r + (tr - r) * p),
    Math.round(g + (tg - g) * p),
    Math.round(b + (tb - b) * p)
  );
}

function relativeLuminance({ r, g, b }) {
  const sr = r / 255;
  const sg = g / 255;
  const sb = b / 255;
  const lin = (c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const R = lin(sr),
    G = lin(sg),
    B = lin(sb);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function foregroundFor(bgHex) {
  const lum = relativeLuminance(hexToRgb(bgHex));
  // Simple threshold
  return lum > 0.5 ? "#111111" : "#ffffff";
}

export function generatePalette(base) {
  // A few tints & shades
  return {
    base,
    light: mix(base, 65, "white"),
    lighter: mix(base, 85, "white"),
    dark: mix(base, 25, "black"),
    darker: mix(base, 45, "black"),
    soft: mix(base, 92, "white"),
    fg: foregroundFor(base),
    focus: mix(base, 30, "white"),
    // Fondo general: un tono muy suave basado en base + white
    bg: mix(base, 94, "white"),
  };
}

export function applyThemeColor(base) {
  if (!base || !/^#?[0-9a-fA-F]{3,6}$/.test(base)) return;
  if (base[0] !== "#") base = "#" + base;
  const palette = generatePalette(base);
  const root = document.documentElement;
  Object.entries(palette).forEach(([k, v]) => {
    root.style.setProperty(`--brand-${k}`, v);
  });
  // Alias legacy variable
  root.style.setProperty("--brand-color", palette.base);
  document.body.classList.add("theme-active");
  // Aplicar fondo dinámico
  document.body.style.backgroundColor = palette.bg;
  injectDynamicOverrides();
}

function injectDynamicOverrides() {
  if (document.getElementById("dynamic-theme-overrides")) return;
  const style = document.createElement("style");
  style.id = "dynamic-theme-overrides";
  style.textContent = `:root {
  --brand-gradient: linear-gradient(135deg,var(--brand-base),var(--brand-dark));
}
body.theme-active .bg-cyan-600,
body.theme-active .bg-cyan-700,
body.theme-active .bg-cyan-500 { background-color: var(--brand-base)!important; }
body.theme-active .hover\\:bg-cyan-700:hover { background-color: var(--brand-dark)!important; }
body.theme-active .text-cyan-800 { color: var(--brand-dark)!important; }
body.theme-active .border-cyan-600 { border-color: var(--brand-base)!important; }
body.theme-active .focus\\:ring-cyan-600:focus { box-shadow: 0 0 0 3px var(--brand-focus); }
body.theme-active button, body.theme-active .btn-primary { color: var(--brand-fg); }
/* Soft background sections */
body.theme-active .bg-gray-50 { background-color: var(--brand-soft)!important; }
/* Primary gradient utility */
body.theme-active .brand-gradient { background: var(--brand-gradient); color: var(--brand-fg); }
/* Brand component helpers */
body.theme-active .brand-card { border:1px solid var(--brand-base); background:#ffffff; }
body.theme-active .brand-card-title { color: var(--brand-dark); }
body.theme-active .brand-card-price { color: var(--brand-dark); }
body.theme-active .brand-btn-primary { background: var(--brand-base); color: var(--brand-fg); }
body.theme-active .brand-btn-primary:hover { background: var(--brand-dark); }
body.theme-active .brand-tagline { color: var(--brand-base)!important; }
body.theme-active .brand-title { color: var(--brand-dark)!important; }
/* Button system */
body.theme-active .brand-btn { font-weight:600; border-radius:9999px; transition:background .2s, box-shadow .2s, transform .2s; box-shadow:0 2px 4px rgba(0,0,0,0.08); }
body.theme-active .brand-btn:active { transform:translateY(1px); box-shadow:0 1px 2px rgba(0,0,0,0.12); }
body.theme-active .brand-btn-primary { background:var(--brand-base); color:var(--brand-fg); }
body.theme-active .brand-btn-primary:hover { background:var(--brand-dark); }
body.theme-active .brand-btn-secondary { background:var(--brand-soft); color:var(--brand-dark); }
body.theme-active .brand-btn-secondary:hover { background:var(--brand-light); }
body.theme-active .brand-btn-secondary { border:1px solid var(--brand-base); }
body.theme-active .brand-btn-outline { background:#ffffff; color:var(--brand-dark); border:1px solid var(--brand-base); }
body.theme-active .brand-btn-outline:hover { background:var(--brand-light); }
body.theme-active .brand-btn-accent { background:var(--brand-dark); color:var(--brand-fg); }
body.theme-active .brand-btn-accent:hover { background:var(--brand-darker); }
/* Botón activo navegación (refuerzo visual) */
body.theme-active .active-nav { box-shadow:0 0 0 2px var(--brand-light),0 4px 10px -2px rgba(0,0,0,0.18); }
/* Inputs temáticos */
body.theme-active .brand-input { border:1px solid var(--brand-base); background:#fff; color:#111; box-shadow:0 1px 2px rgba(0,0,0,0.04); }
body.theme-active .brand-input:focus { outline:none; box-shadow:0 0 0 2px var(--brand-focus); border-color:var(--brand-dark); }
/* Modal pedidos tonos ligeros */
body.theme-active .brand-order-modal { border-color: var(--brand-base); }
body.theme-active .brand-order-intro { color: var(--brand-dark)!important; }
/* Fondo dinámico body fallback */
body.theme-active { background: var(--brand-bg); }
`;
  document.head.appendChild(style);
}
