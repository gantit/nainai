// email.js - envío de emails (placeholder)
// Implementa envío mediante una Cloudflare Worker adicional o servicio como Resend.
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
    const adminUrl = `${storeUrl}?admin=${adminCode}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from,
        subject: `Código admin de ${storeName}`,
        text: `Hola!\n\nTu tiendecita '${storeName}' ya está lista.\nCódigo admin: ${adminCode}\nURL directa: ${storeUrl}\nURL de administración: ${adminUrl}\n\nGuárdalo en un lugar seguro.\n\nSi no solicitaste este correo, ignóralo.`,
      }),
    });
    const textClone = res.clone();
    let payload = null;
    try {
      payload = await res.json();
    } catch (_) {
      payload = { raw: await textClone.text() };
    }
    if (!res.ok) {
      console.warn("Fallo enviando email", payload);
      return { ok: false, error: payload };
    }
    console.info("Email worker respuesta:", payload);
    if (payload?.mock) {
      console.warn(
        "Email en modo mock (¿falta RESEND_API_KEY en el Worker?)",
        payload
      );
    }
    return { ok: true, data: payload };
  } catch (e) {
    console.warn("Error enviando email", e);
    return { ok: false, error: e };
  }
}
