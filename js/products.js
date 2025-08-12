// products.js - gestión de productos (listar, crear, editar, eliminar)
import { db, appId } from "./firebase.js";
import {
  collection,
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
import { generateDescriptionFromImage, generateTitleAndDescriptionFromImage } from "./gemini.js";

export const FIRESTORE_FIELD_MAX = 1048487; // bytes
export const TARGET_MAX_BLOB_BYTES = 780 * 1024;

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

export function fetchProducts() {
  if (!productsCollection) return;
  const adminMode = window.__ADMIN_MODE === true;
  const productGrid = document.getElementById("product-grid");
  const loadingProducts = document.getElementById("loading-products");
  const q = query(productsCollection, orderBy("createdAt", "desc"));
  onSnapshot(
    q,
    (snapshot) => {
      loadingProducts.classList.add("hidden");
      productGrid.innerHTML = "";
      // No reasignar productsCache para mantener la misma referencia usada en otros módulos
      for (const k in productsCache) delete productsCache[k];
      if (snapshot.empty) {
        productGrid.innerHTML = `<p class="py-10 text-center text-gray-500 col-span-full">Aún no hay ningún tesoro a la venta. ¡Añade el primero!</p>`;
        return;
      }
      snapshot.docs.forEach((d) => {
        const product = d.data();
        productsCache[d.id] = product;
        const adminAttrs = adminMode
          ? `data-id="${d.id}" class="group relative overflow-hidden transition-all duration-300 transform bg-white shadow-lg rounded-xl hover:-translate-y-1 ring-2 ring-transparent hover:ring-amber-400 cursor-pointer"`
          : `class="overflow-hidden transition-all duration-300 transform bg-white shadow-lg rounded-xl group hover:-translate-y-1"`;
        const editBadge = adminMode
          ? `<span class="absolute top-2 left-2 z-10 text-[10px] font-semibold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow">Editar</span><button data-delete-id="${d.id}" class="absolute top-2 right-2 z-10 bg-red-600/90 hover:bg-red-700 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shadow focus:outline-none" title="Eliminar">✕</button>`
          : "";
        productGrid.innerHTML += `
        <div ${adminAttrs}>
          ${editBadge}
          <div class="w-full h-56 overflow-hidden sm:h-64">
            <img src="${product.imageUrl}" alt="${product.name}" class="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105" />
          </div>
          <div class="p-5">
            <h3 class="text-lg font-bold truncate text-cyan-900">${product.name}</h3>
            <p class="h-16 mt-2 overflow-hidden text-sm text-gray-600">${product.description}</p>
            <div class="flex items-center justify-between mt-4">
              <p class="text-2xl font-bold text-cyan-700">${product.price} €</p>
              <button onclick="orderProduct('${d.id}', '${product.name}')" class="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-full hover:bg-green-700 transition-all shadow">Pedir</button>
            </div>
          </div>
        </div>`;
      });
    },
    (error) => {
      console.error("Error al cargar productos:", error);
      loadingProducts.innerText = "Error al cargar los productos.";
    }
  );
}

export async function ensureDataUrlUnderLimit(blob, { minQuality = 0.3 } = {}) {
  let dataUrl = await blobToDataURL(blob);
  if (dataUrl.length <= FIRESTORE_FIELD_MAX) return { dataUrl, blob };
  // fallback: no repetir toda lógica avanzada para simplificar módulo
  return { dataUrl, blob };
}

export function attachProductGridHandlers() {
  const productGrid = document.getElementById("product-grid");
  productGrid.addEventListener("click", async (e) => {
    const adminMode = window.__ADMIN_MODE === true;
    if (!adminMode) return;
    const deleteBtn = e.target.closest("[data-delete-id]");
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.getAttribute("data-delete-id");
      if (!id) return;
      const p = productsCache[id];
      const name = p?.name || "este producto";
      if (
        !confirm(
          `¿Seguro que deseas eliminar ${name}? Esta acción no se puede deshacer.`
        )
      )
        return;
      deleteBtn.disabled = true;
      deleteBtn.classList.add("opacity-50", "cursor-wait");
      try {
        await deleteDoc(doc(productsCollection, id));
        showNotification("Producto eliminado");
      } catch (err) {
        console.error("Error eliminando producto", err);
        alert("No se pudo eliminar.");
      } finally {
        deleteBtn.disabled = false;
        deleteBtn.classList.remove("opacity-50", "cursor-wait");
      }
      return;
    }
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const id = card.getAttribute("data-id");
    if (!id || !productsCache[id]) return;
    startEditingProduct(id);
  });
}

export function setupAddProductForm({ userIdRef, adminMode }) {
  const addProductForm = document.getElementById("add-product-form");
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
      // Autocompletar título y descripción si están vacíos
      const nameInput = document.getElementById("product-name");
      const shouldFillName = nameInput && nameInput.value.trim().length < 2;
      const shouldFillDesc = productDescriptionTextarea.value.trim().length < 5;
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
              productDescriptionTextarea.value = combo.description.substring(0, 240);
            }
          } else {
            // fallback sólo descripción clásica
            generateDescriptionFromImage(
              blob,
              productDescriptionTextarea,
              geminiLoader,
              geminiHelperBtn
            );
          }
        } catch (e) {
          console.warn('Autocompletado título+descripción fallido', e);
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

  addProductForm.addEventListener("submit", async (e) => {
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
      addProductForm.reset();
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

  const geminiHelperBtnClick = async () => {
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
  };
  geminiHelperBtn.addEventListener("click", geminiHelperBtnClick);
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
  submitBtn.classList.remove("bg-cyan-600", "hover:bg-cyan-700");
  submitBtn.classList.add("bg-amber-600", "hover:bg-amber-700");
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
  submitBtn.classList.remove("bg-amber-600", "hover:bg-amber-700");
  submitBtn.classList.add("bg-cyan-600", "hover:bg-cyan-700");
  const productImageInput = document.getElementById("product-image");
  if (productImageInput) productImageInput.required = true;
}
