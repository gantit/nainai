// landing.js - selección aleatoria de productos de todas las tiendas
// Estructura real: artifacts/{storeSlug}/public/data/products
import { db, collection, getDocs } from "./firebase.js";

const randomGrid = document.getElementById("random-products");
const loadingBlock = document.getElementById("random-loading");
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

async function fetchAllProducts(maxProducts = 200) {
  const results = [];
  try {
    // Obtener todos los slugs de tiendas
    const storesSnap = await getDocs(collection(db, "stores"));
    const storeIds = storesSnap.docs.map((d) => d.id);
    // Limitar número de tiendas a recorrer si son muchísimas
    const shuffled = shuffleArray(storeIds).slice(0, 50);
    for (const slug of shuffled) {
      if (results.length >= maxProducts) break;
      try {
        const colRef = collection(
          db,
          "artifacts",
          slug,
          "public",
          "data",
          "products"
        );
        const prodSnap = await getDocs(colRef);
        prodSnap.forEach((p) => {
          if (results.length < maxProducts) {
            results.push({ id: p.id, store: slug, ...p.data() });
          }
        });
      } catch (e) {
        /* continuar */
      }
    }
  } catch (err) {
    console.warn("Error obteniendo productos", err);
  }
  return results;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickRandom(list, n) {
  return shuffleArray(list).slice(0, n);
}

function renderRandomGrid(list) {
  if (!randomGrid) return;
  randomGrid.innerHTML = "";
  if (!list.length) {
    randomGrid.innerHTML = `
      <div class='col-span-full flex flex-col items-center text-center py-16 gap-6'>
        <div class='w-28 h-28 rounded-full bg-gradient-to-br from-cyan-100 to-emerald-100 flex items-center justify-center shadow-inner'>
          <span class='text-4xl'>🛍️</span>
        </div>
        <div class='max-w-md space-y-3'>
          <h4 class='text-xl font-semibold text-cyan-700'>Aún no hay tesoros publicados</h4>
          <p class='text-sm text-gray-600'>Sé de los primeros en crear una tiendecita y mostrar tus productos artesanales aquí.</p>
        </div>
  <a href='./app.html#admin' class='px-6 py-3 rounded-full bg-cyan-600 text-white font-semibold shadow hover:bg-cyan-700 transition'>Crear mi tienda</a>
      </div>`;
    return;
  }
  list.forEach((p) => {
    const card = document.createElement("a");
    const hrefBase = p.store
      ? `./app?store=${encodeURIComponent(p.store)}`
      : "#";
    const href = p.id
      ? `${hrefBase}&product=${encodeURIComponent(p.id)}`
      : hrefBase;
    card.href = href;
    card.className =
      "group rounded-2xl overflow-hidden bg-white border border-cyan-100 shadow-sm hover:shadow transition flex md:flex-col focus:outline-none focus:ring-2 focus:ring-cyan-300";
    card.setAttribute("aria-label", `Ver tienda ${p.store || ""}`.trim());
    card.innerHTML = `
      <div class='flex md:flex-col gap-3 md:gap-0 p-3 md:p-0 w-full'>
        <div class='flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100 md:w-full md:aspect-square md:rounded-none'>
          ${
            p.imageUrl
              ? `<img src="${p.imageUrl}" alt="${
                  p.name || ""
                }" class="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy"/>`
              : ""
          }
        </div>
        <div class='flex flex-col justify-between flex-1 md:p-4 md:pt-3'>
          <div class='flex flex-col md:gap-2'>
            <h4 class='font-semibold text-[13px] md:text-sm line-clamp-2'>${
              p.name || "Producto"
            }</h4>
            <p class='hidden md:block text-[12px] text-gray-600 line-clamp-3'>${
              p.description || ""
            }</p>
            <p class='md:hidden text-[11px] text-gray-600 line-clamp-2'>${
              p.description || ""
            }</p>
          </div>
          <div class='mt-2 md:mt-auto flex items-center justify-start md:justify-between'>
            <span class='text-gray-300 text-lg leading-none md:hidden'>&rsaquo;</span>
            <div class='text-sm font-bold text-cyan-700 md:ml-auto'>${
              p.price ? p.price + " €" : ""
            }</div>
          </div>
        </div>
      </div>`;
    randomGrid.appendChild(card);
  });
}

async function loadRandomProducts() {
  loadingBlock?.classList.remove("hidden");
  try {
    const all = await fetchAllProducts(250);
    const picked = pickRandom(all, 12);
    renderRandomGrid(picked);
  } catch (e) {
    console.warn(e);
    if (randomGrid)
      randomGrid.innerHTML = `<p class='col-span-full text-center text-red-500 py-10'>No se pudieron cargar los productos.</p>`;
  } finally {
    loadingBlock?.classList.add("hidden");
  }
}

loadRandomProducts();
