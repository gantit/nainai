// main.js - punto de entrada
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  collection,
} from "./firebase.js";
import {
  initProducts,
  attachProductGridHandlers,
  setupAddProductForm,
  productsCache,
  fetchProducts,
} from "./products.js";
import { setupOrderModal, setupMarkDelivered } from "./orders.js";
import {
  loadStoreMeta,
  createStore,
  addAdminEmail,
  recoverAdminSecret,
  slugify,
} from "./store.js";
import { sendAdminCredentialsEmail } from "./email.js";
import { setupNavigation } from "./navigation.js";
import { downloadQrPdf } from "./qr.js";
import { applyThemeColor, generatePalette } from "./theme.js";

// Estado simple de userId referenciado por objeto para mutabilidad
const userIdRef = { value: null };
const urlParams = new URLSearchParams(window.location.search);
const storeSlug = urlParams.get("store");
let currentAppId =
  storeSlug || (typeof __app_id !== "undefined" ? __app_id : "default-app-id");
window.__app_id = currentAppId;
let storeMetaLoaded = null;
const adminParam = urlParams.get("admin");
let adminMode = false;

if (!storeSlug) {
  document.addEventListener("DOMContentLoaded", () => {
    const headerBrand = document.querySelector("h1.font-display");
    if (headerBrand) headerBrand.textContent = "Crea tu Tiendecita";
    const taglineEl = document.querySelector("p.-mt-1");
    if (taglineEl) taglineEl.textContent = "En 1 minuto";
    injectStoreWizard();
    injectRecoveryUI();
  });
} else {
  (async () => {
    storeMetaLoaded = await loadStoreMeta(storeSlug);
    if (
      storeMetaLoaded &&
      adminParam &&
      adminParam === storeMetaLoaded.adminSecret
    ) {
      adminMode = true;
    }
    window.__ADMIN_MODE = adminMode;
    applyBranding(storeMetaLoaded);
    injectRecoveryUI();
    setupNavigation(adminMode);
    // Mostrar/ocultar botones según admin
    const shopBtn = document.getElementById("show-shop-btn");
    const qrBtn = document.getElementById("download-qr-btn");
    if (adminMode) {
      shopBtn?.classList.remove("hidden");
      qrBtn?.classList.remove("hidden");
      setupQrButton();
    } else {
      shopBtn?.classList.add("hidden");
      qrBtn?.classList.add("hidden");
    }
    attachProductGridHandlers();
    setupOrderModal(productsCache);
    setupMarkDelivered();
    setupAddProductForm({ userIdRef, adminMode });
    // Si ya hay snapshot pero sin admin, forzar re-render llamando a fetchProducts de nuevo con nuevo flag
    fetchProducts();
  })();
}

function setupQrButton() {
  const btn = document.getElementById("download-qr-btn");
  if (!btn) return;
  btn.addEventListener(
    "click",
    async (e) => {
      e.preventDefault();
      const slug =
        storeSlug || new URLSearchParams(window.location.search).get("store");
      if (!slug) {
        alert("Primero crea la tienda para generar su QR");
        return;
      }
      const meta = storeMetaLoaded || window.__BRAND__ || {};
      btn.disabled = true;
      btn.classList.add("opacity-60", "cursor-wait");
      try {
        await downloadQrPdf({
          slug,
          storeName: meta.name || "Mi Tiendecita",
          childName: meta.childName,
        });
      } catch (err) {
        console.error("QR PDF error", err);
      } finally {
        btn.disabled = false;
        btn.classList.remove("opacity-60", "cursor-wait");
      }
    },
    { once: false }
  );
}

onAuthStateChanged(auth, async (user) => {
  if (!storeSlug) return; // esperar a que haya tienda
  if (user) {
    userIdRef.value = user.uid;
    const productsCollection = collection(
      db,
      "artifacts",
      currentAppId,
      "public",
      "data",
      "products"
    );
    initProducts(productsCollection);
  } else {
    try {
      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    } catch (error) {
      console.error("Error de autenticación:", error);
      const lp = document.getElementById("loading-products");
      if (lp) lp.innerText = "Error al conectar con la base de datos.";
    }
  }
});

// Versión en footer
(function () {
  const el = document.getElementById("app-version");
  if (el) el.textContent = window.__APP_VERSION__ || "desconocida";
})();

function applyBranding(meta) {
  if (!meta) return;
  const h1 = document.querySelector("h1.font-display");
  if (h1) {
    h1.textContent = meta.name;
    h1.classList.add("brand-title");
  }
  const tagline = document.querySelector("p.-mt-1");
  if (tagline) {
    tagline.textContent = meta.tagline || meta.childName || "";
    tagline.classList.add("brand-tagline");
  }
  window.__BRAND__ = {
    name: meta.name,
    tagline: meta.tagline,
    childName: meta.childName,
  };
  const themeColor = meta.themeColor || "#0e7490";
  // Aplicar tema dinámico completo
  applyThemeColor(themeColor);
}

function injectStoreWizard() {
  const container = document.getElementById("shop-page");
  if (!container) return;
  container.innerHTML = `
    <div class="max-w-lg mx-auto bg-white/80 backdrop-blur p-6 sm:p-8 rounded-3xl shadow-xl border border-black/5 relative overflow-hidden">
      <div class="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_30%_20%,var(--brand-base,#0e7490)_0%,transparent_70%)]"></div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold tracking-tight brand-title">Crea tu Tiendecita</h2>
        <div id="wizard-progress" class="flex gap-1"></div>
      </div>
      <form id="create-store-form" class="flex flex-col gap-6">
        <div id="wizard-step-wrapper" class="flex flex-col flex-1 justify-center"></div>
        <p class="text-[11px] text-gray-500 leading-snug" id="wizard-hint"></p>
        <div id="live-preview-panel" class="border border-gray-200 rounded-2xl p-4 bg-gray-50">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Previsualización</h3>
          <div id="brand-typography-preview" class="p-4 rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
            <h1 id="preview-title" class="font-display text-2xl mb-1 tracking-tight">Nombre Tienda</h1>
            <p id="preview-tagline" class="text-sm text-gray-600">Eslogan aparecerá aquí</p>
          </div>
          <div id="cards-preview" class="grid grid-cols-2 gap-2"></div>
        </div>
  <div id="wizard-actions" class="flex items-center gap-3 pt-2">
          <button type="button" id="btn-back" class="brand-btn brand-btn-outline px-5 py-2 text-sm hidden">Atrás</button>
          <div class="flex-1"></div>
            <button type="button" id="btn-next" class="brand-btn brand-btn-primary px-6 py-2 text-sm font-semibold">Siguiente</button>
        </div>
        <p class="text-[10px] text-gray-400 leading-snug">Se generará un código admin basado en el nombre del niño/a. Guarda el enlace con ?admin=CODIGO.</p>
      </form>
    </div>`;

  // --- Configuración del wizard paso a paso ---
  const steps = [
    {
      key: "name",
      label: "¿Cómo se llamará la tienda?",
      placeholder: "Ej: Tesoros de Sofía",
      required: true,
      hint: "El nombre aparecerá como título.",
      inputType: "text",
      id: "store-name",
    },
    {
      key: "childName",
      label: "Nombre del niño/a (para el código admin)",
      placeholder: "Sofía",
      required: false,
      hint: "Usado para generar un código fácil.",
      inputType: "text",
      id: "child-name",
    },
    {
      key: "tagline",
      label: "Eslogan (opcional)",
      placeholder: "Pequeños tesoros hechos a mano",
      required: false,
      hint: "Frase corta que acompaña al título.",
      inputType: "text",
      id: "tagline",
    },
    {
      key: "adminEmail",
      label: "Email para recuperar acceso",
      placeholder: "tuemail@ejemplo.com",
      required: true,
      hint: "Necesario para recuperar el código admin.",
      inputType: "email",
      id: "admin-email",
    },
    {
      key: "themeColor",
      label: "Elige un color principal",
      placeholder: "#0e7490",
      required: true,
      hint: "Afecta botones y acentos.",
      inputType: "color",
      id: "theme-color",
      default: "#0e7490",
    },
    {
      key: "summary",
      label: "Resumen",
      isSummary: true,
      hint: "Revisa y crea tu tienda.",
    },
  ];
  const state = {
    name: "",
    childName: "",
    tagline: "",
    adminEmail: "",
    themeColor: "#0e7490",
  };
  let current = 0;
  const wrapper = document.getElementById("wizard-step-wrapper");
  const btnNext = document.getElementById("btn-next");
  const btnBack = document.getElementById("btn-back");
  const hint = document.getElementById("wizard-hint");
  const progressEl = document.getElementById("wizard-progress");

  function renderProgress() {
    progressEl.innerHTML = "";
    steps.forEach((s, i) => {
      const dot = document.createElement("div");
      dot.className = `h-2 w-2 rounded-full transition-all ${
        i === current
          ? "bg-[var(--brand-base,#0e7490)] scale-125"
          : i < current
          ? "bg-[var(--brand-dark,#0e7490)] opacity-70"
          : "bg-gray-300"
      }`;
      progressEl.appendChild(dot);
    });
  }
  function inputMarkup(step) {
    if (step.isSummary) {
      return `<div class="animate-fade">
        <h3 class="text-lg font-semibold mb-4">Confirma los datos</h3>
        <ul class="space-y-2 text-sm">\n<li><span class='font-medium text-gray-600'>Nombre:</span> ${
          state.name || "-"
        }</li>\n<li><span class='font-medium text-gray-600'>Niño/a:</span> ${
        state.childName || "(no indicado)"
      }</li>\n<li><span class='font-medium text-gray-600'>Eslogan:</span> ${
        state.tagline || "(vacío)"
      }</li>\n<li><span class='font-medium text-gray-600'>Email:</span> ${
        state.adminEmail || "-"
      }</li>\n<li><span class='font-medium text-gray-600'>Color:</span> <span style='color:${
        state.themeColor
      }' class='font-mono'>${state.themeColor}</span></li></ul>
        <p class="mt-4 text-xs text-gray-500">Se generará un código admin basado en el nombre del niño/a.</p>
      </div>`;
    }
    if (step.inputType === "color") {
      return `<div class='space-y-4 animate-fade'>
        <label class='block text-lg font-medium leading-tight'>${step.label}</label>
        <input type='color' id='${step.id}' value='${state.themeColor}' class='h-16 w-24 rounded-lg border p-1 shadow-inner' />
      </div>`;
    }
    return `<div class='space-y-4 animate-fade'>
      <label class='block text-lg font-medium leading-tight' for='${step.id}'>${
      step.label
    }</label>
      <input id='${step.id}' type='${step.inputType}' value='${
      state[step.key] || ""
    }' placeholder='${
      step.placeholder || ""
    }' class='w-full px-4 py-3 text-base border rounded-xl focus:ring-2 focus:ring-[var(--brand-base,#0e7490)] focus:outline-none' />
    </div>`;
  }
  function renderStep() {
    const step = steps[current];
    wrapper.innerHTML = inputMarkup(step);
    hint.textContent = step.hint || "";
    btnBack.classList.toggle("hidden", current === 0);
    btnNext.textContent = step.isSummary ? "Crear Tienda" : "Siguiente";
    renderProgress();
    setTimeout(() => {
      const input = wrapper.querySelector("input");
      input?.focus();
    }, 30);
    if (step.key === "themeColor") {
      applyThemeColor(state.themeColor);
      updateLiveBrandPreview(state.themeColor);
      renderCardsPreview(generatePalette(state.themeColor));
    }
    const liveInput = wrapper.querySelector("input");
    if (liveInput && !step.isSummary) {
      liveInput.addEventListener("input", (e) => {
        const val = e.target.value;
        state[step.key] = val;
        if (step.key === "name") {
          document.getElementById("preview-title").textContent =
            val.trim() || "Nombre Tienda";
        } else if (step.key === "tagline") {
          document.getElementById("preview-tagline").textContent =
            val.trim() || "Eslogan aparecerá aquí";
        } else if (step.key === "themeColor") {
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val)) {
            applyThemeColor(val);
            updateLiveBrandPreview(val);
            renderCardsPreview(generatePalette(val));
          }
        }
      });
    }
  }
  function persistCurrent() {
    const step = steps[current];
    if (step.isSummary) return true;
    const input = wrapper.querySelector("input");
    if (!input) return true;
    const val = input.value.trim();
    if (step.required && !val) {
      input.classList.add("ring-2", "ring-red-400");
      input.focus();
      return false;
    }
    state[step.key] = val || state[step.key];
    if (
      step.key === "themeColor" &&
      /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val)
    ) {
      applyThemeColor(val);
      updateLiveBrandPreview(val);
      renderCardsPreview(generatePalette(val));
    }
    if (step.key === "name")
      document.getElementById("preview-title").textContent =
        state.name || "Nombre Tienda";
    if (step.key === "tagline")
      document.getElementById("preview-tagline").textContent =
        state.tagline || "Eslogan aparecerá aquí";
    return true;
  }
  btnNext.addEventListener("click", async () => {
    if (!persistCurrent()) return;
    if (steps[current].isSummary) {
      await submitWizard();
      return;
    }
    current = Math.min(current + 1, steps.length - 1);
    renderStep();
  });
  btnBack.addEventListener("click", () => {
    current = Math.max(current - 1, 0);
    renderStep();
  });
  wrapper.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnNext.click();
    }
  });
  async function submitWizard() {
    btnNext.disabled = true;
    btnNext.textContent = "Creando...";
    try {
      const { name, childName, tagline, adminEmail, themeColor } = state;
      const { slug, adminSecret } = await createStore({
        name,
        childName,
        tagline,
        themeColor,
      });
      if (adminEmail) await addAdminEmail(slug, adminEmail);
      const url = new URL(window.location.href);
      url.searchParams.set("store", slug);
      url.searchParams.set("admin", adminSecret);
      if (adminEmail && window.CONFIG?.endPoints?.email) {
        const emailResult = await sendAdminCredentialsEmail({
          from: "no-reply@joca.dev",
          endpoint: window.CONFIG.endPoints.email,
          to: adminEmail,
          storeName: name,
          adminCode: adminSecret,
          storeUrl: url.toString(),
        });
        if (!emailResult?.ok)
          alert(
            "La tienda se creó, pero el email no pudo enviarse. Código: " +
              adminSecret
          );
      }
      window.location.href = url.toString();
    } catch (err) {
      alert(err.message || "Error creando la tienda");
      btnNext.disabled = false;
      btnNext.textContent = "Crear Tienda";
    }
  }
  function updateLiveBrandPreview(hex) {
    const pal = generatePalette(hex);
    const titleEl = document.getElementById("preview-title");
    const tagEl = document.getElementById("preview-tagline");
    if (titleEl) titleEl.style.color = pal.dark;
    if (tagEl) tagEl.style.color = pal.base;
    const box = document.getElementById("brand-typography-preview");
    if (box) {
      box.style.background = pal.soft;
      box.style.borderColor = pal.base;
    }
  }
  function renderCardsPreview(pal) {
    const wrap = document.getElementById("cards-preview");
    if (!wrap) return;
    wrap.innerHTML = "";
    [
      { name: "Pulsera Arcoíris", price: "3€" },
      { name: "Llavero Estrella", price: "2€" },
    ].forEach((p) => {
      const card = document.createElement("div");
      card.className = "rounded-lg p-2 flex flex-col gap-1 text-[12px] border";
      card.style.background = "#fff";
      card.style.borderColor = pal.base;
      card.innerHTML = `<div class='aspect-square w-full rounded-md mb-1 flex items-center justify-center text-[11px]' style='background:${pal.soft};color:${pal.dark};'>IMG</div>
        <div class='font-semibold leading-tight' style='color:${pal.dark};'>${p.name}</div>
        <div class='flex items-center justify-between mt-auto'>
          <span class='font-bold' style='color:${pal.dark};'>${p.price}</span>
          <button type='button' class='px-2 py-1 rounded text-[11px] font-medium' style='background:${pal.base};color:${pal.fg};'>Añadir</button>
        </div>`;
      wrap.appendChild(card);
    });
  }
  // Inicial
  applyThemeColor(state.themeColor);
  updateLiveBrandPreview(state.themeColor);
  renderCardsPreview(generatePalette(state.themeColor));
  renderStep();
}

function injectRecoveryUI() {
  const nav = document.querySelector("nav");
  if (!nav) return;
  if (document.getElementById("recover-admin-link")) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("store");
  const hasAdminParam = params.has("admin");
  const adminValue = params.get("admin");
  // Nuevo criterio: mostrar SOLO si el query param admin existe y está vacío (admin=)
  if (!(hasAdminParam && adminValue === "")) return;
  const btn = document.createElement("button");
  btn.id = "recover-admin-link";
  btn.type = "button";
  btn.className = "px-4 py-2 text-xs brand-btn brand-btn-secondary";
  btn.textContent = "Recuperar Admin";
  btn.addEventListener("click", async () => {
    let targetSlug = slug;
    if (!targetSlug) {
      const nameOrSlug = prompt(
        "Introduce el slug o nombre de la tienda (ej: tesoros-de-sofia):"
      );
      if (!nameOrSlug) return;
      // Intentar slugificar si contiene espacios
      targetSlug = nameOrSlug.includes(" ")
        ? slugify(nameOrSlug)
        : nameOrSlug.trim().toLowerCase();
    }
    const email = prompt(
      "Introduce el email con el que registraste la tienda:"
    );
    if (!email) return;
    try {
      const secret = await recoverAdminSecret(targetSlug, email.trim());
      alert("Tu código admin es: " + secret + "\nSe añadirá a la URL.");
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("store", targetSlug);
      newUrl.searchParams.set("admin", secret);
      window.location.href = newUrl.toString();
    } catch (err) {
      alert(err.message || "No se pudo recuperar");
    }
  });
  nav.appendChild(btn);
}
