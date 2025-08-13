// products.js - gestión de productos (listar, crear, editar, eliminar)
// products.js - gestión de productos (listar, crear, editar, eliminar) LIMPIO
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

export let productsCache = {};
export let productsCollection = null;
export let editingProductId = null;
let existingImageDataUrl = null;

export function initProducts(colRef) {
  productsCollection = colRef;
  fetchProducts();
}

// LISTAR (snapshot tiempo real)
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
      // limpiar estado
      productGrid.innerHTML = "";
      for (const k in productsCache) delete productsCache[k];
      if (snapshot.empty) {
        productGrid.innerHTML = `<p class="py-10 text-center text-gray-500 col-span-full">Aún no hay ningún tesoro a la venta. ¡Añade el primero!</p>`;
        return;
      }
      snapshot.docs.forEach((d) => {
        const product = d.data();
        productsCache[d.id] = product;
        const baseCardClasses =
          "brand-card group relative transition-all duration-300 transform rounded-xl hover:-translate-y-1 shadow-md hover:shadow-lg";
        const adminAttrs = adminMode
          ? `data-id="${d.id}" class="${baseCardClasses} ring-2 ring-transparent hover:ring-amber-400 cursor-pointer overflow-hidden"`
          : `class="${baseCardClasses} overflow-hidden"`;
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
    (error) => {
      console.error("Error al cargar productos:", error);
      if (loadingProducts)
        loadingProducts.innerText = "Error al cargar los productos.";
    }
  );
}

// Limitar tamaño base64 (simplificado)
export async function ensureDataUrlUnderLimit(blob) {
  const dataUrl = await blobToDataURL(blob);
  return { dataUrl, blob };
}

// EVENTOS SOBRE GRID PARA EDITAR / ELIMINAR
export function attachProductGridHandlers() {
  const productGrid = document.getElementById("product-grid");
  if (!productGrid) return;
  productGrid.addEventListener("click", async (e) => {
    const adminMode = window.__ADMIN_MODE === true;
    if (!adminMode) return;
    // eliminar
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
        console.error("Delete error", err);
        alert("No se pudo eliminar");
      }
      return;
    }
    // editar
    const card = e.target.closest("[data-id]");
    if (card) {
      const id = card.getAttribute("data-id");
      if (id) startEditingProduct(id);
    }
  });
}

// FORMULARIO AÑADIR / EDITAR
export function setupAddProductForm({ userIdRef, adminMode }) {
  const form = document.getElementById("add-product-form");
  if (!form) return;
  // ocultar si no admin
  if (!adminMode) form.classList.add("hidden");

  const productImageInput = document.getElementById("product-image");
  const submitBtn = document.getElementById("submit-product-btn");
  const submitBtnText = document.getElementById("submit-btn-text");
  const submitLoader = document.getElementById("submit-loader");
  const imagePreview = document.getElementById("image-preview");
  const imageLoader = document.getElementById("image-loader");
  const productDescriptionTextarea = document.getElementById(
    "product-description"
  );
  const geminiHelperBtn = document.getElementById("gemini-helper-btn");
  const geminiLoader = document.getElementById("gemini-loader");

  if (productImageInput) {
    productImageInput.addEventListener("change", async () => {
      if (imageLoader) imageLoader.classList.remove("hidden");
      if (imagePreview) imagePreview.classList.add("hidden");
      if (imagePreview?.dataset?.objectUrl) {
        revokeObjectURL(imagePreview.dataset.objectUrl);
        delete imagePreview.dataset.objectUrl;
      }
      compressedImageBlob = null;
      compressedMeta = null;
      originalFileInfo = null;
      const f = productImageInput.files[0];
      if (!f) {
        if (imageLoader) imageLoader.classList.add("hidden");
        return;
      }
      let workFile = f;
      const heicResult = await ensureStandardImage(workFile);
      workFile = heicResult.file;
      originalFileInfo = {
        originalName: f.name,
        originalSize: f.size,
        convertedFromHeic: heicResult.converted,
      };
      const infoEl = document.getElementById("image-info");
      if (infoEl) {
        infoEl.classList.add("hidden");
        infoEl.textContent = "";
      }
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
        imagePreview.dataset.objectUrl = objUrl;
        imagePreview.src = objUrl;
        imagePreview.alt = `Previsualización (${meta.width}x${meta.height})`;
        imagePreview.classList.remove("hidden");
        if (infoEl) {
          const base64 = await blobToDataURL(blob);
          const encodedKB = (base64.length / 1024).toFixed(0);
          const origKB = (f.size / 1024).toFixed(0);
          const compKB = (blob.size / 1024).toFixed(0);
          const pct = ((blob.size / f.size) * 100).toFixed(1);
          const within = base64.length <= FIRESTORE_FIELD_MAX;
          infoEl.textContent = `Original: ${origKB}KB | Comprimido: ${compKB}KB (${pct}%) | ${
            meta.width
          }x${meta.height} | Base64: ${encodedKB}KB ${
            within ? "OK" : "⚠ supera límite"
          }`;
          infoEl.classList.remove("hidden");
        }
        // Autocompletar
        const nameInput = document.getElementById("product-name");
        const shouldFillName = nameInput && nameInput.value.trim().length < 2;
        const shouldFillDesc =
          productDescriptionTextarea.value.trim().length < 5;
        if (shouldFillName || shouldFillDesc) {
          geminiLoader.classList.remove("hidden");
          geminiHelperBtn.disabled = true;
          try {
            const combo = await generateTitleAndDescriptionFromImage(blob);
            if (combo) {
              if (shouldFillName && combo.title) {
                nameInput.value = combo.title.substring(0, 60);
              }
              if (shouldFillDesc && combo.description) {
                productDescriptionTextarea.value = combo.description.substring(
                  0,
                  240
                );
              }
            } else {
              generateDescriptionFromImage(
                blob,
                productDescriptionTextarea,
                geminiLoader,
                geminiHelperBtn
              );
            }
          } catch (e) {
            console.warn("Autocompletado título+descripción fallido", e);
            generateDescriptionFromImage(
              blob,
              productDescriptionTextarea,
              geminiLoader,
              geminiHelperBtn
            );
          } finally {
            geminiLoader.classList.add("hidden");
            geminiHelperBtn.disabled = false;
          }
        }
      } catch (err) {
        console.warn("Fallo compresión/preview", err);
        const objUrlFallback = blobToObjectURL(workFile);
        imagePreview.dataset.objectUrl = objUrlFallback;
        imagePreview.src = objUrlFallback;
        imagePreview.alt = "Previsualización (sin comprimir)";
        imagePreview.classList.remove("hidden");
      } finally {
        if (imageLoader) imageLoader.classList.add("hidden");
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!userIdRef.value) {
      alert("Debes estar autenticado para añadir productos.");
      return;
    }
    const imageFile = document.getElementById("product-image").files[0];
    submitBtn.disabled = true;
    submitBtnText.classList.add("hidden");
    submitLoader.classList.remove("hidden");
    const name = document.getElementById("product-name").value;
    const description = productDescriptionTextarea.value;
    const price = document.getElementById("product-price").value;
    try {
      if (editingProductId) {
        let imageUrlToSave = existingImageDataUrl;
        if (imageFile) {
          compressedImageBlob = null;
          let workFile = imageFile;
          const heicResult = await ensureStandardImage(workFile);
          workFile = heicResult.file;
          const { blob } = await compressImage(workFile, {
            maxWidth: 1400,
            maxHeight: 1400,
            qualityStart: 0.85,
            maxBytes: TARGET_MAX_BLOB_BYTES,
          });
          compressedImageBlob = blob;
          const { dataUrl } = await ensureDataUrlUnderLimit(
            compressedImageBlob
          );
          if (dataUrl.length > FIRESTORE_FIELD_MAX) {
            alert(
              "No se pudo reducir la imagen por debajo del límite de Firestore."
            );
            throw new Error("DataURL excede límite en edición");
          }
          imageUrlToSave = dataUrl;
        }
        await updateDoc(doc(productsCollection, editingProductId), {
          name,
          description,
          price: parseFloat(price).toFixed(2),
          ...(imageUrlToSave ? { imageUrl: imageUrlToSave } : {}),
          updatedAt: new Date(),
        });
        showNotification("¡Producto actualizado!");
        resetEditState();
        return;
      }
      if (!imageFile) {
        alert("Selecciona una imagen");
        throw new Error("Sin imagen");
      }
      if (!compressedImageBlob) {
        let workFile = imageFile;
        const heicResult = await ensureStandardImage(workFile);
        workFile = heicResult.file;
        const { blob, meta } = await compressImage(workFile, {
          maxWidth: 1400,
          maxHeight: 1400,
          qualityStart: 0.85,
          maxBytes: TARGET_MAX_BLOB_BYTES,
        });
        compressedImageBlob = blob;
        compressedMeta = { ...meta, convertedFromHeic: heicResult.converted };
      }
      const { dataUrl, meta } = await ensureDataUrlUnderLimit(
        compressedImageBlob
      );
      if (dataUrl.length > FIRESTORE_FIELD_MAX) {
        alert("No se pudo reducir la imagen por debajo del límite.");
        throw new Error("DataURL sigue excediendo límite");
      }
      await addDoc(productsCollection, {
        name,
        description,
        price: parseFloat(price).toFixed(2),
        imageUrl: dataUrl,
        createdAt: new Date(),
        ownerId: userIdRef.value,
        meta: {
          compressed: true,
          ...compressedMeta,
          adjusted: !!meta,
          originalFileInfo,
        },
      });
      form.reset();
      imagePreview.classList.add("hidden");
      if (imagePreview?.dataset?.objectUrl) {
        revokeObjectURL(imagePreview.dataset.objectUrl);
        delete imagePreview.dataset.objectUrl;
      }
      compressedImageBlob = null;
      compressedMeta = null;
      originalFileInfo = null;
      showNotification("¡Tesoro añadido con éxito!");
    } catch (error) {
      console.error("Error al guardar el producto:", error);
    } finally {
      submitBtn.disabled = false;
      submitBtnText.classList.remove("hidden");
      submitLoader.classList.add("hidden");
    }
  });

  if (geminiHelperBtn) {
    geminiHelperBtn.addEventListener("click", async () => {
      const currentDescription = productDescriptionTextarea.value;
      if (currentDescription.trim().length < 10) {
        alert("Escribe primero una idea (al menos 10 caracteres).");
        return;
      }
      geminiLoader.classList.remove("hidden");
      geminiHelperBtn.disabled = true;
      const brand =
        (window.__BRAND__ && window.__BRAND__.name) || "nuestra marca";
      const prompt = `Re-escribe la siguiente descripción para un collar de conchas hecho a mano de la marca '${brand}'. Hazla corta (2 frases), atractiva y enfocada en vender, usando un tono poético y evocador del mar. Descripción original: "${currentDescription}"\nNormas:\n- Usa un tono poético y evocador del mar.\n- Mantén la descripción breve (2 frases).\n- Enfócate en vender el collar, resaltando su belleza y conexión con la naturaleza.\n- Evita tecnicismos o descripciones largas.\n- Usa un lenguaje atractivo y emocional.\n- No incluyas detalles técnicos o de fabricación.\n- No des opciones. Devuelve solo el texto final sin comillas.`;
      try {
        const { generateTextWithGemini } = await import("./gemini.js");
        const text = await generateTextWithGemini(prompt);
        productDescriptionTextarea.value = text;
      } catch (error) {
        console.error("Error con Gemini:", error);
        alert("No se pudo generar la descripción.");
      } finally {
        geminiLoader.classList.add("hidden");
        geminiHelperBtn.disabled = false;
      }
    });
  }
}

export function startEditingProduct(id) {
  const p = productsCache[id];
  if (!p) return;
  editingProductId = id;
  existingImageDataUrl = p.imageUrl;
  document.getElementById("show-admin-btn").click();
  document.getElementById("product-name").value = p.name || "";
  document.getElementById("product-description").value = p.description || "";
  document.getElementById("product-price").value = parseFloat(p.price) || "";
  const imagePreview = document.getElementById("image-preview");
  const productImageInput = document.getElementById("product-image");
  if (productImageInput) productImageInput.required = false;
  if (existingImageDataUrl) {
    imagePreview.src = existingImageDataUrl;
    imagePreview.alt = "Imagen actual";
    imagePreview.classList.remove("hidden");
  }
  const submitBtnText = document.getElementById("submit-btn-text");
  const submitBtn = document.getElementById("submit-product-btn");
  submitBtnText.textContent = "Guardar Cambios";
  // Adaptar al tema: pasar de primaria a variante acento para diferenciar modo edición
  submitBtn.classList.remove(
    "bg-cyan-600",
    "hover:bg-cyan-700",
    "bg-amber-600",
    "hover:bg-amber-700",
    "brand-btn-primary"
  );
  if (!submitBtn.classList.contains("brand-btn"))
    submitBtn.classList.add("brand-btn");
  submitBtn.classList.add("brand-btn-accent");
}

export function resetEditState() {
  editingProductId = null;
  existingImageDataUrl = null;
  const addProductForm = document.getElementById("add-product-form");
  addProductForm.reset();
  document.getElementById("image-preview").classList.add("hidden");
  const submitBtnText = document.getElementById("submit-btn-text");
  const submitBtn = document.getElementById("submit-product-btn");
  submitBtnText.textContent = "Añadir Producto a la Tienda";
  submitBtn.classList.remove(
    "bg-amber-600",
    "hover:bg-amber-700",
    "bg-cyan-600",
    "hover:bg-cyan-700",
    "brand-btn-accent"
  );
  if (!submitBtn.classList.contains("brand-btn"))
    submitBtn.classList.add("brand-btn");
  submitBtn.classList.add("brand-btn-primary");
  const productImageInput = document.getElementById("product-image");
  if (productImageInput) productImageInput.required = true;
}
