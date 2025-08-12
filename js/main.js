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
  setupQrButton();
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
  setupQrButton();
    }
    window.__ADMIN_MODE = adminMode;
    applyBranding(storeMetaLoaded);
    injectRecoveryUI();
    setupNavigation(adminMode);
    attachProductGridHandlers();
    setupOrderModal(productsCache);
    setupMarkDelivered();
    setupAddProductForm({ userIdRef, adminMode });
    // Si ya hay snapshot pero sin admin, forzar re-render llamando a fetchProducts de nuevo con nuevo flag
    fetchProducts();
  })();
}

function setupQrButton() {
  const btn = document.getElementById('download-qr-btn');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const slug = storeSlug || new URLSearchParams(window.location.search).get('store');
    if (!slug) {
      alert('Primero crea la tienda para generar su QR');
      return;
    }
    const meta = storeMetaLoaded || window.__BRAND__ || {};
    btn.disabled = true;
    btn.classList.add('opacity-60','cursor-wait');
    try {
      await downloadQrPdf({ slug, storeName: meta.name || 'Mi Tiendecita', childName: meta.childName });
    } catch (err) {
      console.error('QR PDF error', err);
    } finally {
      btn.disabled = false;
      btn.classList.remove('opacity-60','cursor-wait');
    }
  }, { once: false });
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
  if (h1) h1.textContent = meta.name;
  const tagline = document.querySelector("p.-mt-1");
  if (tagline) tagline.textContent = meta.tagline || meta.childName || "";
  window.__BRAND__ = {
    name: meta.name,
    tagline: meta.tagline,
    childName: meta.childName,
  };
  const themeColor = meta.themeColor || "#0e7490";
  document.documentElement.style.setProperty("--brand-color", themeColor);
}

function injectStoreWizard() {
  const container = document.getElementById("shop-page");
  if (!container) return;
  container.innerHTML = `
    <div class="max-w-xl mx-auto bg-white p-6 rounded-2xl shadow-lg">
      <h2 class="text-2xl font-bold text-cyan-800 mb-4">Crea la Tiendecita de tu Hijo/a</h2>
      <form id="create-store-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Nombre de la Tienda</label>
          <input type="text" id="store-name" required class="w-full px-3 py-2 border rounded-lg" placeholder="Ej: Tesoros de Sofía" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Nombre del Niño/a</label>
          <input type="text" id="child-name" class="w-full px-3 py-2 border rounded-lg" placeholder="Sofía" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Eslogan (opcional)</label>
          <input type="text" id="tagline" class="w-full px-3 py-2 border rounded-lg" placeholder="Pequeños tesoros hechos a mano" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Email del Padre/Madre (para recuperar código)</label>
          <input type="email" id="admin-email" required class="w-full px-3 py-2 border rounded-lg" placeholder="tuemail@ejemplo.com" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Color principal</label>
          <input type="color" id="theme-color" value="#0e7490" class="w-16 h-10 p-0 border rounded" />
        </div>
        <button type="submit" class="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg">Crear Tienda</button>
  <p class="text-xs text-gray-500">Se generará un código admin fácil de recordar basado en el nombre del niño/a, ej: luis10. Guarda el enlace con ?admin=CODIGO o recupéralo con tu email.</p>
      </form>
    </div>`;
  const form = document.getElementById("create-store-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("store-name").value.trim();
    const childName = document.getElementById("child-name").value.trim();
    const tagline = document.getElementById("tagline").value.trim();
    const adminEmail = document.getElementById("admin-email").value.trim();
    const themeColor = document.getElementById("theme-color").value;
    form.querySelector("button").disabled = true;
    try {
      const { slug, adminSecret } = await createStore({
        name,
        childName,
        tagline,
        themeColor,
      });
      if (adminEmail) {
        await addAdminEmail(slug, adminEmail);
      }
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
        if (!emailResult?.ok) {
          console.warn("Fallo en envío email admin", emailResult?.error);
          // No bloquea, pero avisa
          alert(
            "La tienda se creó, pero el email no pudo enviarse. Copia el código: " +
              adminSecret
          );
        }
      }
      window.location.href = url.toString();
    } catch (err) {
      alert(err.message || "Error creando la tienda");
    } finally {
      form.querySelector("button").disabled = false;
    }
  });
}

function injectRecoveryUI() {
  const nav = document.querySelector("nav");
  if (!nav) return;
  if (document.getElementById("recover-admin-link")) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("store");
  const hasAdminParam = params.has("admin");
  const adminValue = params.get("admin");
  // Mostrar recuperación si:
  // 1) Hay store pero no admin o admin vacío
  // 2) No hay store pero el usuario añadió ?admin= vacío esperando ver opción
  if (slug) {
    if (adminValue) return; // ya hay un admin code no vacío
  } else if (!slug) {
    if (!hasAdminParam) return; // no intentó recuperar aún
  }
  const btn = document.createElement("button");
  btn.id = "recover-admin-link";
  btn.type = "button";
  btn.className =
    "px-5 py-2.5 text-xs font-semibold bg-amber-200 text-amber-800 rounded-full shadow hover:bg-amber-300 transition-all";
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
