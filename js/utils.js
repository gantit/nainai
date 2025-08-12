// utils.js - utilidades generales (imágenes, blobs, notificaciones)
export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function blobToObjectURL(blob) {
  const URL_ = window.URL || window.webkitURL;
  return URL_.createObjectURL(blob);
}

export function revokeObjectURL(url) {
  if (!url) return;
  const URL_ = window.URL || window.webkitURL;
  try {
    URL_.revokeObjectURL(url);
  } catch (e) {
    /* ignore */
  }
}

export async function blobToBase64Raw(blob) {
  const dataUrl = await blobToDataURL(blob);
  return dataUrl.split(",")[1];
}

export function showNotification(message) {
  const notification = document.getElementById("notification");
  if (!notification) return;
  notification.textContent = message;
  notification.classList.remove("hidden");
  setTimeout(() => {
    notification.classList.remove("translate-y-16");
  }, 10);
  setTimeout(() => {
    notification.classList.add("translate-y-16");
    setTimeout(() => notification.classList.add("hidden"), 300);
  }, 3000);
}

// Imagen / compresión
export async function loadHeicConverter() {
  if (window.heic2any) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar heic2any"));
    document.head.appendChild(s);
  });
}

export async function ensureStandardImage(file) {
  const isHeic = /\.heic$/i.test(file.name) || /heic$/i.test(file.type);
  if (!isHeic) return { file, converted: false };
  try {
    await loadHeicConverter();
    const convertedBlob = await window.heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.95,
    });
    const newFile = new File(
      [convertedBlob],
      file.name.replace(/\.heic$/i, ".jpg"),
      { type: "image/jpeg" }
    );
    return { file: newFile, converted: true };
  } catch (e) {
    console.warn("Fallo conversión HEIC", e);
    return { file, converted: false, error: e.message };
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), type, quality)
  );
}

async function fileToImageBitmap(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch (e) {
      /* fallback */
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImage(
  file,
  {
    maxWidth = 1200,
    maxHeight = 1200,
    qualityStart = 0.85,
    minQuality = 0.35,
    mimeType = "image/jpeg",
    maxBytes = 850 * 1024,
    maxPasses = 8,
  } = {}
) {
  const bitmap = await fileToImageBitmap(file);
  let { width, height } = bitmap;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  let pass = 0;
  let q = qualityStart;
  let blob;
  do {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    blob = await canvasToBlob(canvas, mimeType, q);
    if (blob.size <= maxBytes || pass >= maxPasses) break;
    if (q > minQuality) {
      q = Math.max(minQuality, q - 0.1);
    } else {
      width = Math.round(width * 0.9);
      height = Math.round(height * 0.9);
    }
    pass++;
  } while (true);
  return {
    blob,
    meta: { width, height, quality: q, size: blob.size, passes: pass },
  };
}
