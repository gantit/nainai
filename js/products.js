// products.js - gestión de productos (listar, crear, editar, eliminar)
import {
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
} from "./firebase.js";
import {
  blobToDataURL,
  blobToObjectURL,
  revokeObjectURL,
  ensureStandardImage,
  compressImage,
  showNotification,
} from "./utils.js";
import {
  generateDescriptionFromImage,
  generateTitleAndDescriptionFromImage,
} from "./gemini.js";

export const FIRESTORE_FIELD_MAX = 1048487; // bytes (~1MB string)
export const TARGET_MAX_BLOB_BYTES = 780 * 1024; // ~780KB antes de base64

let compressedImageBlob = null;
let compressedMeta = null;
let originalFileInfo = null;
let lastObjectUrl = null; // para revocar

export let productsCache = {};
export let productsCollection = null;
export let editingProductId = null;
let existingImageDataUrl = null; // para edición si no se cambia imagen

// ================= LISTADO =================
export function initProducts(colRef) {
  productsCollection = colRef;
  fetchProducts();
}

export function fetchProducts() {
  if (!productsCollection) return;
  const adminMode = window.__ADMIN_MODE === true;
  const productGrid = document.getElementById("product-grid");
  const loadingProducts = document.getElementById("loading-products");
  if (!productGrid) return;
  const q = query(productsCollection, orderBy("createdAt", "desc"));
  onSnapshot(
    q,
    (snapshot) => {
      if (loadingProducts) loadingProducts.classList.add("hidden");
      productGrid.innerHTML = "";
      for (const k in productsCache) delete productsCache[k];
      if (snapshot.empty) {
        productGrid.innerHTML = `<p class=\"py-10 text-center text-gray-500 col-span-full\">Aún no hay ningún tesoro a la venta. ¡Añade el primero!</p>`;
        return;
      }
      snapshot.docs.forEach((d) => {
        const product = d.data();
        productsCache[d.id] = product;
        const baseCardClasses =
          "brand-card group relative transition-all duration-300 transform rounded-xl hover:-translate-y-1 shadow-md hover:shadow-lg";
        const adminAttrs = adminMode
          ? `data-id=\"${d.id}\" class=\"${baseCardClasses} ring-2 ring-transparent hover:ring-amber-400 cursor-pointer overflow-hidden\"`
          : `class=\"${baseCardClasses} overflow-hidden\"`;
        const editBadge = adminMode
          ? `<span class=\"absolute top-2 left-2 z-10 text-[10px] font-semibold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow\">Editar</span><button data-delete-id=\"${d.id}\" class=\"absolute top-2 right-2 z-10 bg-red-600/90 hover:bg-red-700 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shadow focus:outline-none\" title=\"Eliminar\">✕</button>`
          : "";
        productGrid.innerHTML += `
        <div ${adminAttrs}>
          ${editBadge}
          <div class=\"w-full aspect-square overflow-hidden bg-gray-100\">
            <img src=\"${product.imageUrl}\" alt=\"${product.name}\" class=\"object-cover w-full h-full transition-transform duration-300 group-hover:scale-105\" />
          </div>
          <div class=\"p-3 flex flex-col gap-2\">
            <h3 class=\"brand-card-title text-base font-semibold leading-snug line-clamp-2\">${product.name}</h3>
            <p class=\"text-[13px] leading-snug text-gray-600 line-clamp-3 min-h-[48px]\">${product.description}</p>
            <div class=\"flex items-center justify-between mt-auto pt-1\">
              <span class=\"brand-card-price font-bold text-base\">${product.price} €</span>
              <button onclick=\"orderProduct('${d.id}', '${product.name}')\" class=\"brand-btn-primary px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors\">Pedir</button>
            </div>
          </div>
        </div>`;
      });
    },
    (err) => {
      console.error("Error al cargar productos", err);
      if (loadingProducts)
        loadingProducts.innerText = "Error al cargar los productos.";
    }
  );
}

export async function ensureDataUrlUnderLimit(blob) {
  const dataUrl = await blobToDataURL(blob);
  return { dataUrl, blob };
}

export function attachProductGridHandlers() {
  const productGrid = document.getElementById("product-grid");
  if (!productGrid) return;
  productGrid.addEventListener("click", async (e) => {
    const adminMode = window.__ADMIN_MODE === true;
    if (!adminMode) return;
    const delBtn = e.target.closest("[data-delete-id]");
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.getAttribute("data-delete-id");
      if (!id) return;
      const prod = productsCache[id];
      const name = prod?.name || "este producto";
      if (!confirm(`¿Eliminar ${name}?`)) return;
      try {
        await deleteDoc(doc(productsCollection, id));
        showNotification("Producto eliminado");
      } catch (err) {
        console.error(err);
        alert("No se pudo eliminar");
      }
      return;
    }
    const card = e.target.closest("[data-id]");
    if (card) {
      const id = card.getAttribute("data-id");
      if (id) startEditingProduct(id);
    }
  });
}

// ================= WIZARD CREAR / EDITAR =================
export function setupAddProductForm({ userIdRef, adminMode }) {
  const form = document.getElementById("add-product-form");
  if (!form) return;
  if (!adminMode) form.classList.add("hidden");
  form.innerHTML = `
    <div id=\"product-wizard-root\" class=\"flex flex-col gap-6\">
      <div class=\"flex items-center justify-between\">
        <h3 class=\"text-xl font-bold brand-title\">${
          editingProductId ? "Editar Tesoro" : "Añadir Tesoro"
        }</h3>
        <div id=\"product-wizard-progress\" class=\"flex gap-1\"></div>
      </div>
      <div id=\"product-wizard-step\" class=\"flex flex-col gap-4\"></div>
      <p id=\"product-wizard-hint\" class=\"text-[11px] text-gray-500 leading-snug\"></p>
      <div id=\"product-preview-panel\" class=\"border border-gray-200 rounded-xl p-4 bg-gray-50\">
        <h4 class=\"text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2\">Vista previa</h4>
        <div class=\"flex gap-4\">
          <div class=\"w-32 h-32 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-gray-400 text-xs\" id=\"preview-image-box\">IMG</div>
          <div class=\"flex-1 flex flex-col gap-2\">
            <h5 id=\"preview-product-name\" class=\"font-semibold text-base text-gray-700 line-clamp-2\">${
              editingProductId
                ? productsCache[editingProductId]?.name || "Nombre"
                : "Nombre sugerido"
            }</h5>
            <p id=\"preview-product-desc\" class=\"text-[12px] leading-snug text-gray-600 line-clamp-4\">${
              editingProductId
                ? productsCache[editingProductId]?.description || "Descripción"
                : "Descripción aparecerá aquí."
            }</p>
            <span id=\"preview-product-price\" class=\"text-sm font-bold text-gray-800\">${
              editingProductId
                ? productsCache[editingProductId]?.price + " €"
                : "-- €"
            }</span>
          </div>
        </div>
      </div>
      <div id=\"product-wizard-actions\" class=\"flex items-center gap-3 pt-2\">
        <button type=\"button\" id=\"product-btn-back\" class=\"brand-btn brand-btn-outline px-5 py-2 text-sm hidden\">Atrás</button>
        <div class=\"flex-1\"></div>
        <button type=\"button\" id=\"product-btn-next\" class=\"brand-btn brand-btn-primary px-6 py-2 text-sm font-semibold\">Siguiente</button>
      </div>
    </div>`;

  const steps = [
    {
      key: "image",
      label: "Sube la foto del producto",
      hint: "A partir de la imagen generaremos título y descripción.",
      render: renderImageStep,
      required: true,
    },
    {
      key: "name",
      label: "Nombre del producto",
      hint: "Puedes ajustar el nombre sugerido.",
      render: renderNameStep,
      required: true,
    },
    {
      key: "description",
      label: "Descripción",
      hint: "Haz pequeños ajustes o deja la generada.",
      render: renderDescriptionStep,
      required: true,
    },
    {
      key: "price",
      label: "Precio (€)",
      hint: "Introduce el precio en euros.",
      render: renderPriceStep,
      required: true,
    },
    {
      key: "summary",
      label: "Resumen",
      hint: "Confirma y guarda el tesoro.",
      render: renderSummaryStep,
      required: false,
      isSummary: true,
    },
  ];

  const initial = productsCache[editingProductId] || {};
  const state = {
    imageFile: null,
    imageDataUrl: editingProductId ? initial.imageUrl || null : null,
    name: editingProductId ? initial.name || "" : "",
    description: editingProductId ? initial.description || "" : "",
    price: editingProductId ? initial.price || "" : "",
  };
  if (editingProductId) existingImageDataUrl = initial.imageUrl;

  let current = 0;
  const stepHost = document.getElementById("product-wizard-step");
  const hintEl = document.getElementById("product-wizard-hint");
  const progressEl = document.getElementById("product-wizard-progress");
  const btnNext = document.getElementById("product-btn-next");
  const btnBack = document.getElementById("product-btn-back");
  const preview = {
    imgBox: document.getElementById("preview-image-box"),
    name: document.getElementById("preview-product-name"),
    desc: document.getElementById("preview-product-desc"),
    price: document.getElementById("preview-product-price"),
  };

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
  function updatePreview() {
    if (preview.name)
      preview.name.textContent = state.name || "Nombre sugerido";
    if (preview.desc)
      preview.desc.textContent =
        state.description || "Descripción aparecerá aquí.";
    if (preview.price)
      preview.price.textContent = state.price ? `${state.price} €` : "-- €";
    if (preview.imgBox) {
      if (state.imageDataUrl) {
        preview.imgBox.innerHTML = `<img src='${state.imageDataUrl}' class='object-cover w-full h-full' alt='preview'/>`;
      } else if (editingProductId && existingImageDataUrl) {
        preview.imgBox.innerHTML = `<img src='${existingImageDataUrl}' class='object-cover w-full h-full' alt='preview'/>`;
      }
    }
  }
  function renderStep() {
    const step = steps[current];
    stepHost.innerHTML = "";
    step.render(stepHost, step, state);
    hintEl.textContent = step.hint || "";
    btnBack.classList.toggle("hidden", current === 0);
    btnNext.textContent = step.isSummary
      ? editingProductId
        ? "Guardar Cambios"
        : "Guardar Tesoro"
      : "Siguiente";
    renderProgress();
    updatePreview();
  }
  function validateCurrent() {
    const step = steps[current];
    if (!step.required) return true;
    switch (step.key) {
      case "image":
        return !!(state.imageDataUrl || existingImageDataUrl);
      case "name":
        return state.name.trim().length > 1;
      case "description":
        return state.description.trim().length > 10;
      case "price":
        return !!state.price && !isNaN(parseFloat(state.price));
      default:
        return true;
    }
  }
  btnNext.addEventListener("click", async () => {
    if (!validateCurrent()) {
      alert("Completa este paso antes de continuar.");
      return;
    }
    const step = steps[current];
    if (step.isSummary) {
      await submitProduct();
      return;
    }
    current = Math.min(current + 1, steps.length - 1);
    renderStep();
  });
  btnBack.addEventListener("click", () => {
    current = Math.max(current - 1, 0);
    renderStep();
  });

  async function submitProduct() {
    if (!userIdRef.value) {
      alert("Debes estar autenticado.");
      return;
    }
    btnNext.disabled = true;
    btnNext.textContent = editingProductId ? "Guardando..." : "Creando...";
    try {
      if (editingProductId) {
        let imageUrlToSave = existingImageDataUrl;
        if (state.imageFile && compressedImageBlob) {
          const { dataUrl } = await ensureDataUrlUnderLimit(
            compressedImageBlob
          );
          if (dataUrl.length > FIRESTORE_FIELD_MAX)
            throw new Error("Imagen excede límite");
          imageUrlToSave = dataUrl;
        }
        await updateDoc(doc(productsCollection, editingProductId), {
          name: state.name,
          description: state.description,
          price: parseFloat(state.price).toFixed(2),
          ...(imageUrlToSave ? { imageUrl: imageUrlToSave } : {}),
          updatedAt: new Date(),
        });
        showNotification("¡Producto actualizado!");
        resetEditState();
        return;
      }
      if (!compressedImageBlob) throw new Error("Falta imagen");
      const { dataUrl, meta } = await ensureDataUrlUnderLimit(
        compressedImageBlob
      );
      if (dataUrl.length > FIRESTORE_FIELD_MAX)
        throw new Error("Imagen excede límite");
      await addDoc(productsCollection, {
        name: state.name,
        description: state.description,
        price: parseFloat(state.price).toFixed(2),
        imageUrl: dataUrl,
        createdAt: new Date(),
        ownerId: userIdRef.value,
        meta: {
          compressed: true,
          ...compressedMeta,
          originalFileInfo,
          adjusted: !!meta,
        },
      });
      showNotification("¡Tesoro añadido con éxito!");
      // reset
      state.imageFile = null;
      state.imageDataUrl = null;
      state.name = "";
      state.description = "";
      state.price = "";
      compressedImageBlob = null;
      compressedMeta = null;
      originalFileInfo = null;
      existingImageDataUrl = null;
      editingProductId = null;
      if (lastObjectUrl) {
        revokeObjectURL(lastObjectUrl);
        lastObjectUrl = null;
      }
      current = 0;
      renderStep();
    } catch (err) {
      console.error("Guardar producto error", err);
      alert(err.message || "Error guardando producto");
    } finally {
      btnNext.disabled = false;
      btnNext.textContent = editingProductId
        ? "Guardar Cambios"
        : "Guardar Tesoro";
    }
  }

  // ============ RENDERERS ============
  function renderImageStep(host, step, stateRef) {
    host.innerHTML = `<div class='space-y-4 animate-fade'>
      <label class='block text-lg font-medium leading-tight'>${step.label}</label>
      <input type='file' id='product-image' accept='image/*' class='w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--brand-soft,#f0f8fa)] file:text-[var(--brand-dark,#0e7490)] hover:file:bg-[var(--brand-light,#cffafe)]' />
      <div id='image-process-panel' class='hidden rounded-lg bg-gray-100/70 px-4 py-3 text-[11px] leading-relaxed text-gray-600 space-y-2'>
        <div class='flex items-center gap-2 font-medium text-gray-700'>
          <div id='global-process-spinner' class='loader !w-4 !h-4 !border-2 !border-t-[var(--brand-base,#0e7490)]'></div>
          <span id='global-process-title'>Procesando imagen...</span>
        </div>
        <ul class='space-y-1'>
          <li id='step-compress' class='flex items-center gap-2'><span class='w-3 h-3 rounded-full bg-[var(--brand-base,#0e7490)] animate-pulse'></span><span>Comprimiendo imagen</span></li>
          <li id='step-ai' class='flex items-center gap-2 opacity-50'><span class='w-3 h-3 rounded-full bg-gray-300'></span><span>Generando título y descripción</span></li>
        </ul>
        <p class='text-[10px] text-gray-500 italic'>Esto puede tardar unos segundos según el tamaño de la foto.</p>
      </div>
    </div>`;
    const input = host.querySelector("#product-image");
    const panel = host.querySelector("#image-process-panel");
    const globalSpinner = host.querySelector("#global-process-spinner");
    const globalTitle = host.querySelector("#global-process-title");
    const stepCompress = host.querySelector("#step-compress");
    const stepAi = host.querySelector("#step-ai");
    // Eliminamos infoEl de la UI, solo se logueará a consola

    input.addEventListener("change", async () => {
      if (!input.files.length) return;
      panel.classList.remove("hidden");
      if (btnNext) {
        btnNext.disabled = true;
        btnNext.dataset.label = btnNext.textContent;
        btnNext.textContent = "Procesando...";
      }
      globalSpinner.classList.remove("hidden");
      globalTitle.textContent = "Procesando imagen...";
      stepCompress.innerHTML = `<span class='w-3 h-3 rounded-full bg-[var(--brand-base,#0e7490)] animate-pulse'></span><span>Comprimiendo imagen</span>`;
      stepAi.innerHTML = `<span class='w-3 h-3 rounded-full bg-gray-300'></span><span>Generando título y descripción</span>`;
      stepAi.classList.add("opacity-50");

      if (lastObjectUrl) {
        revokeObjectURL(lastObjectUrl);
        lastObjectUrl = null;
      }
      compressedImageBlob = null;
      compressedMeta = null;
      originalFileInfo = null;
      stateRef.imageDataUrl = null;

      const f = input.files[0];
      stateRef.imageFile = f;
      let workFile = f;
      const heicResult = await ensureStandardImage(workFile);
      workFile = heicResult.file;
      originalFileInfo = {
        originalName: f.name,
        originalSize: f.size,
        convertedFromHeic: heicResult.converted,
      };

      try {
        const { blob, meta } = await compressImage(workFile, {
          maxWidth: 1400,
          maxHeight: 1400,
          qualityStart: 0.85,
          maxBytes: TARGET_MAX_BLOB_BYTES,
        });
        compressedImageBlob = blob;
        compressedMeta = meta;
        const objUrl = blobToObjectURL(blob);
        lastObjectUrl = objUrl;
        stateRef.imageDataUrl = objUrl;
        updatePreview();
        // Log solo en consola (no UI)
        const base64 = await blobToDataURL(blob);
        const encodedKB = (base64.length / 1024).toFixed(0);
        const origKB = (f.size / 1024).toFixed(0);
        const compKB = (blob.size / 1024).toFixed(0);
        const pct = ((blob.size / f.size) * 100).toFixed(1);
        console.log(
          `[Imagen] Original: ${origKB}KB | Comprimido: ${compKB}KB (${pct}%) | ${
            meta.width
          }x${meta.height} | Base64: ${encodedKB}KB ${
            base64.length <= FIRESTORE_FIELD_MAX ? "OK" : "⚠"
          }`
        );
        stepCompress.innerHTML = `<span class='w-3 h-3 rounded-full bg-emerald-500'></span><span>Imagen comprimida</span>`;
        globalTitle.textContent = "Generando título y descripción...";
        stepAi.innerHTML = `<span class='w-3 h-3 rounded-full bg-[var(--brand-base,#0e7490)] animate-pulse'></span><span>Generando título y descripción</span>`;
        stepAi.classList.remove("opacity-50");

        const needName = !stateRef.name || stateRef.name.length < 2;
        const needDesc =
          !stateRef.description || stateRef.description.length < 10;
        if (needName || needDesc) {
          hintEl.textContent = "Generando título y descripción...";
          try {
            const combo = await generateTitleAndDescriptionFromImage(blob);
            if (combo) {
              if (needName && combo.title)
                stateRef.name = combo.title.substring(0, 60);
              if (needDesc && combo.description)
                stateRef.description = combo.description.substring(0, 240);
              stepAi.innerHTML = `<span class='w-3 h-3 rounded-full bg-emerald-500'></span><span>Título y descripción generados</span>`;
            } else if (needDesc) {
              await generateDescriptionFromImage(
                blob,
                {
                  value: stateRef.description,
                  set value(v) {
                    stateRef.description = v;
                  },
                },
                null,
                { disabled: false }
              );
              stepAi.innerHTML = `<span class='w-3 h-3 rounded-full bg-emerald-500'></span><span>Descripción generada</span>`;
            }
          } catch (e) {
            console.warn("AI auto relleno falló", e);
            stepAi.innerHTML = `<span class='w-3 h-3 rounded-full bg-red-500'></span><span>Error al generar automáticamente. Completa manualmente.</span>`;
          } finally {
            hintEl.textContent = steps[current].hint || "";
            updatePreview();
          }
        } else {
          stepAi.innerHTML = `<span class='w-3 h-3 rounded-full bg-emerald-500'></span><span>Datos existentes</span>`;
        }
        updatePreview();
      } catch (err) {
        console.warn("Error procesando imagen", err);
        const fallback = blobToObjectURL(workFile);
        lastObjectUrl = fallback;
        stateRef.imageDataUrl = fallback;
        updatePreview();
        stepCompress.innerHTML = `<span class='w-3 h-3 rounded-full bg-red-500'></span><span>No se pudo comprimir. Prueba otra imagen.</span>`;
        globalTitle.textContent = "Problema con la imagen";
      } finally {
        globalSpinner.classList.add("hidden");
        if (btnNext) {
          btnNext.disabled = false;
          btnNext.textContent = btnNext.dataset.label || "Siguiente";
        }
      }
    });
  }

  function renderNameStep(host, step, stateRef) {
    host.innerHTML = `<div class='space-y-4 animate-fade'>
      <label class='block text-lg font-medium leading-tight'>${
        step.label
      }</label>
      <input id='product-name' type='text' value='${
        stateRef.name || ""
      }' class='w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[var(--brand-base,#0e7490)] outline-none' placeholder='Collar Oceánico' />
    </div>`;
    const input = host.querySelector("#product-name");
    input.addEventListener("input", () => {
      stateRef.name = input.value;
      updatePreview();
    });
  }
  function renderDescriptionStep(host, step, stateRef) {
    host.innerHTML = `<div class='space-y-3 animate-fade'>
      <label for='product-description' class='block text-lg font-medium leading-tight'>${
        step.label
      }</label>
      <textarea id='product-description' rows='3' class='w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[var(--brand-base,#0e7490)] outline-none resize-none overflow-hidden' placeholder='Describe brevemente el producto...'>${
        stateRef.description || ""
      }</textarea>
      <p class='text-[10px] text-gray-400'>La descripción se generó automáticamente a partir de la imagen. Ajusta si lo ves necesario.</p>
    </div>`;
    const area = host.querySelector("#product-description");
    const autoResize = () => {
      area.style.height = "auto";
      area.style.height = area.scrollHeight + "px";
    };
    area.addEventListener("input", () => {
      stateRef.description = area.value;
      autoResize();
      updatePreview();
    });
    // Ajuste inicial según contenido existente/generado
    requestAnimationFrame(autoResize);
  }
  function renderPriceStep(host, step, stateRef) {
    host.innerHTML = `<div class='space-y-4 animate-fade'>
      <label class='block text-lg font-medium leading-tight'>${
        step.label
      }</label>
      <input id='product-price' type='number' step='0.01' value='${
        stateRef.price || ""
      }' class='w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[var(--brand-base,#0e7490)] outline-none' placeholder='15.50' />
    </div>`;
    const input = host.querySelector("#product-price");
    input.addEventListener("input", () => {
      stateRef.price = input.value;
      updatePreview();
    });
  }
  function renderSummaryStep(host, step, stateRef) {
    host.innerHTML = `<div class='space-y-4 animate-fade'>
      <h4 class='text-lg font-semibold'>Revisa los datos</h4>
      <ul class='text-sm space-y-1'>
        <li><span class='font-medium text-gray-600'>Nombre:</span> ${
          stateRef.name || "-"
        }</li>
        <li><span class='font-medium text-gray-600'>Descripción:</span> ${
          stateRef.description || "-"
        }</li>
        <li><span class='font-medium text-gray-600'>Precio:</span> ${
          stateRef.price ? stateRef.price + " €" : "-"
        }</li>
        <li><span class='font-medium text-gray-600'>Imagen:</span> ${
          stateRef.imageDataUrl || existingImageDataUrl ? "Sí" : "No"
        }</li>
      </ul>
      <p class='text-[11px] text-gray-500'>Pulsa ${
        editingProductId ? "Guardar Cambios" : "Guardar Tesoro"
      } para finalizar.</p>
    </div>`;
  }

  renderStep();
}

export function startEditingProduct(id) {
  const p = productsCache[id];
  if (!p) return;
  editingProductId = id;
  existingImageDataUrl = p.imageUrl;
  document.getElementById("show-admin-btn")?.click();
  setupAddProductForm({
    userIdRef: { value: window.__USER_ID__ },
    adminMode: true,
  });
}

export function resetEditState() {
  editingProductId = null;
  existingImageDataUrl = null;
}
