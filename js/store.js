// store.js - gestión multi-tienda (creación y metadatos)
import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "./firebase.js";

export function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .substring(0, 40);
}

export async function loadStoreMeta(slug) {
  if (!slug) return null;
  const ref = doc(db, "stores", slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  window.__BRAND__ = {
    name: data.name || "Mi Tienda",
    tagline: data.tagline || "",
    childName: data.childName || "",
    themeColor: data.themeColor || "#0e7490",
  };
  return data;
}

export async function createStore({ name, childName, tagline, themeColor }) {
  const slug = slugify(name);
  const ref = doc(db, "stores", slug);
  const snap = await getDoc(ref);
  if (snap.exists())
    throw new Error("Ya existe una tienda con ese nombre (slug). Elige otro.");
  const adminSecret = generateChildBasedAdminCode(childName || name);
  await setDoc(ref, {
    name,
    childName,
    tagline,
    themeColor: themeColor || "#0e7490",
    adminSecret,
    createdAt: new Date(),
  });
  return { slug, adminSecret };
}

// --- NUEVO: código admin basado en el nombre del niño + número (ej: luis10) ---
export function generateChildBasedAdminCode(base) {
  let b = slugify(base || "tienda");
  b = b.replace(/[^a-z0-9]/g, "");
  if (b.length < 3) b = (b + "kids").substring(0, 5);
  if (b.length > 8) b = b.substring(0, 8); // mantenerlo corto
  const num = Math.floor(10 + Math.random() * 90); // 10-99
  return `${b}${num}`;
}

export async function addAdminEmail(slug, email) {
  if (!slug || !email) return;
  const ref = doc(db, "stores", slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (!data.adminEmail) {
    await setDoc(ref, { adminEmail: email }, { merge: true });
  }
}

export async function recoverAdminSecret(slug, email) {
  if (!slug || !email) throw new Error("Datos incompletos");
  const ref = doc(db, "stores", slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Tienda no encontrada");
  const data = snap.data();
  if (!data.adminEmail)
    throw new Error("No hay email registrado para recuperación");
  if (data.adminEmail.toLowerCase().trim() !== email.toLowerCase().trim())
    throw new Error("Email no coincide");
  return data.adminSecret;
}
