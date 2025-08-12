// gemini.js - interacción con el proxy Gemini
import { blobToBase64Raw } from "./utils.js";

function resolveGeminiEndpoint() {
  const ep = window.CONFIG?.endPoints?.gemini;
  if (!ep) {
    console.warn("[Gemini] Endpoint no configurado en CONFIG.endPoints.gemini");
  }
  return ep;
}

export async function generateDescriptionFromImage(
  blob,
  productDescriptionTextarea,
  geminiLoader,
  geminiHelperBtn
) {
  try {
    if (!blob) return;
    if (productDescriptionTextarea.value.trim().length > 5) return;
    geminiLoader.classList.remove("hidden");
    geminiHelperBtn.disabled = true;
    const base64 = await blobToBase64Raw(blob);
    const brand =
      (window.__BRAND__ && window.__BRAND__.name) || "Nuestra Marca";
    const promptText = `Analiza la foto de un collar artesanal (marca '${brand}') y escribe una descripción de marketing breve y evocadora en español.\nReglas:\n- 2 frases (máx 230 caracteres).\n- Tono poético, evocador del mar y sensorial.\n- Resalta belleza, materiales naturales y conexión con la naturaleza.\n- Sin detalles técnicos ni proceso.\n- Sin comillas, listas u opciones.\nDevuelve solo la descripción.`;
    const endpoint = resolveGeminiEndpoint();
    if (!endpoint) return; // sin endpoint no hacemos request
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: promptText,
        imageBase64: base64,
        mimeType: blob.type || "image/jpeg",
      }),
    });
    if (!resp.ok) throw new Error("Proxy error " + resp.status);
    const json = await resp.json();
    if (json.text) productDescriptionTextarea.value = json.text.trim();
  } catch (e) {
    console.warn("Auto descripción fallida", e);
  } finally {
    geminiLoader.classList.add("hidden");
    geminiHelperBtn.disabled = false;
  }
}

export async function generateTitleAndDescriptionFromImage(blob) {
  const endpoint = resolveGeminiEndpoint();
  if (!endpoint) return null;
  const base64 = await blobToBase64Raw(blob);
  const brand = (window.__BRAND__ && window.__BRAND__.name) || "Nuestra Marca";
  const prompt = `Analiza la foto de una pieza de joyería artesanal (marca '${brand}'). Devuelve JSON minificado con las claves: {"title":"<nombre breve evocador sin comillas extras ni marca, 2-4 palabras en español>","description":"<texto marketing 1-2 frases evocadoras sin comillas>"}. Solo el JSON.`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      imageBase64: base64,
      mimeType: blob.type || "image/jpeg",
    }),
  });
  if (!resp.ok) throw new Error("Gemini title/desc error " + resp.status);
  const json = await resp.json();
  const raw = json?.text || "";
  try {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1)
      throw new Error("JSON no encontrado");
    const parsed = JSON.parse(raw.substring(firstBrace, lastBrace + 1));
    return parsed;
  } catch (e) {
    console.warn("Parse JSON título+descripción fallido", e, raw);
    return null;
  }
}

export async function generateTextWithGemini(prompt) {
  const payload = { prompt };
  let resultText = null;
  let retries = 3;
  let delay = 1000;
  for (let i = 0; i < retries; i++) {
    try {
      const endpoint = resolveGeminiEndpoint();
      if (!endpoint) throw new Error("Endpoint Gemini no configurado");
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const json = await resp.json();
        resultText = json.text;
        break;
      }
    } catch (e) {
      console.warn(`Intento ${i + 1} fallo proxy`, e);
    }
    await new Promise((r) => setTimeout(r, delay));
    delay *= 2;
  }
  if (!resultText) throw new Error("Proxy sin respuesta válida");
  return resultText;
}
