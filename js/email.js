// email.js - envío de emails (placeholder)
// Implementa envío mediante una Cloudflare Worker adicional o servicio como Resend.
// Aquí preparamos una función genérica que llama a un endpoint /email/send de tu worker.

/**
 * Envía el email con las credenciales admin usando el Worker (POST JSON {to, subject, text, from}).
 * Usa CONFIG.endPoints.email como endpoint sugerido.
 * Si no hay endpoint configurado se ignora silenciosamente.
 */
export async function sendAdminCredentialsEmail({
  endpoint,
  to,
  storeName,
  adminCode,
  storeUrl,
  from,
}) {
  if (!endpoint) return;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from,
        subject: `Código admin de ${storeName}`,
        text: `Hola!\n\nTu tiendecita '${storeName}' ya está lista.\nCódigo admin: ${adminCode}\nURL directa: ${storeUrl}\n\nGuárdalo en un lugar seguro.\n\nSi no solicitaste este correo, ignóralo.`,
      }),
    });
    const textClone = res.clone();
    let payload = null;
    try { payload = await res.json(); } catch(_) { payload = { raw: await textClone.text() }; }
    if (!res.ok) {
      console.warn("Fallo enviando email", payload);
      return { ok: false, error: payload };
    }
    console.info("Email worker respuesta:", payload);
    if (payload?.mock) {
      console.warn("Email en modo mock (¿falta RESEND_API_KEY en el Worker?)", payload);
    }
    return { ok: true, data: payload };
  } catch (e) {
    console.warn("Error enviando email", e);
    return { ok: false, error: e };
  }
}
