// qr.js - generación dinámica de PDF con QR
// Usa QuickChart para generar un PNG QR y jsPDF (cargado dinámicamente) para crear el PDF.

async function loadJSPDF() {
  if (window.jspdf) return window.jspdf.jsPDF;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
    document.head.appendChild(s);
  });
  return window.jspdf.jsPDF;
}

function buildStoreUrl(slug) {
  const base = window.location.origin + window.location.pathname.replace(/index\.html?$/,'');
  return `${base}?store=${encodeURIComponent(slug)}`;
}

async function fetchQrDataUrl(text) {
  const url = `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=600&margin=2&format=png`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('QR fetch error');
  const blob = await resp.blob();
  return await blobToDataURL(blob);
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function generateQrPdf({ slug, storeName, childName }) {
  if (!slug) throw new Error('Falta slug');
  const targetUrl = buildStoreUrl(slug);
  const jsPDF = await loadJSPDF();
  const qrDataUrl = await fetchQrDataUrl(targetUrl);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'A4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const topMargin = 20;

  const title = storeName || 'Mi Tiendecita';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(title, pageWidth / 2, topMargin, { align: 'center' });

  if (childName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.text(`Hecho con cariño por ${childName}`, pageWidth / 2, topMargin + 12, { align: 'center' });
  }

  const qrSizeMm = 100;
  const qrX = (pageWidth - qrSizeMm) / 2;
  const qrY = topMargin + 25;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSizeMm, qrSizeMm);

  doc.setFontSize(12);
  doc.setTextColor(60,60,60);
  doc.text(targetUrl, pageWidth / 2, qrY + qrSizeMm + 12, { align: 'center' });

  doc.setFontSize(11);
  doc.text('Escanéame para ver la tienda y hacer pedidos', pageWidth / 2, qrY + qrSizeMm + 22, { align: 'center' });

  return doc.output('blob');
}

export async function downloadQrPdf({ slug, storeName, childName }) {
  try {
    const blob = await generateQrPdf({ slug, storeName, childName });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-${slug}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  } catch (e) {
    alert('No se pudo generar el PDF del QR');
    console.error(e);
  }
}
