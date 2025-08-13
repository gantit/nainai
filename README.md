# Nai Nai | Tesoros del Mar 🌊

Pequeñas tiendas online generadas al vuelo (multi‑tienda) para vender collares / artesanía infantil con ayuda de IA, theming dinámico y panel simple.

## 🚀 Configuración Rápida

### 1. Clonar el repositorio

```bash
git clone https://github.com/gantit/nainai.git
cd nainai
```

### 2. Configurar `config.js`

1. Copia la plantilla (si existe):
   ```bash
   cp config.example.js config.js
   ```
2. Edita `config.js` y rellena:
   - Credenciales Firebase (Firestore habilitado)
   - API Key Gemini (Google AI Studio)
   - (Opcional) `geminiEndpoint` si usas el worker proxy (recomendado)
   - (Opcional) `emailEndpoint` si activas envío de código admin por email

### 3. Abrir la aplicación

Abre `index.html` en el navegador (no requiere build). Para dominios personalizados / hosting estático, solo sube la carpeta.

## 🔑 Requisitos / Servicios

- **Firebase** (Firestore). Colecciones empleadas:
  - `stores/{slug}` metadatos de cada tienda
  - `artifacts/{appId}/public/data/products` productos de la tienda
  - `orders/` (según módulo pedidos) bajo mismo `appId` anidado
- **Gemini** (Google AI). Usado para:
  - Autocompletar título + descripción a partir de imagen
  - Re‑escritura creativa de descripción (botón ✨)
- **(Opcional) Resend** para emails de recuperación
- **Cloudflare Workers** (para proxy Gemini y/o email worker)

## 📝 Seguridad

- `config.js` no debe commitearse (añadir a `.gitignore`).
- No expongas claves de Resend ni Gemini directamente en HTML público: usa los workers como proxy.
- Firestore Rules: restringe escritura anónima en producción (el prototipo permite añadir productos solo con código admin en UI, pero implementa reglas lado servidor antes de abrirlo públicamente).

## 🌐 Multi‑Tienda y Acceso Admin

1. Sin parámetro `store` la app muestra un asistente (wizard) para crear una nueva tienda:
   - Nombre de la tienda
   - Nombre del niño/a (influye en el código admin)
   - Eslogan
   - Color principal (genera paleta y vista previa en vivo)
   - Email de padre/madre (para recuperación)
2. Al crear se guarda en `stores/{slug}` y genera `adminSecret` corto basado en el nombre del niño (ej: `sofia42`).
3. URL pública de una tienda: `/?store=<slug>`
4. Modo administrador: `/?store=<slug>&admin=<adminSecret>`
5. Botón de recuperación del código aparece solo con `&admin=` (valor vacío) para no exponerlo siempre.
6. Si se registró email, puede enviarse el código al correo (requiere email worker configurado).

Ejemplo:

```
https://tu-dominio.com/?store=tesoros-de-sofia&admin=sofia42
```

Recuperación (mostrar botón):

```
https://tu-dominio.com/?store=tesoros-de-sofia&admin=
```

## 🎨 Funcionalidades Principales

- 🏪 Multi‑tienda con slug automático y metadatos en Firestore
- 🔐 Código admin fácil (nombre niño + número) y recuperación por email
- 🧪 Wizard con previsualización de paleta y tarjetas (theming dinámico CSS variables)
- 🎨 Sistema de botones y cards brand (`brand-btn-*`, `brand-card-*`) ajustado al color elegido
- 🤖 IA (Gemini) para: título+descripción desde imagen + re‑escritura creativa
- 📸 Compresión de imágenes (HEIC → JPEG si aplica, límite ~1MB base64)
- 🛒 Gestión de productos en tiempo real (onSnapshot)
- 📦 Pedidos con modal y estado (entregado / pendiente) [ver módulo orders]
- 📄 Generación de PDF con QR (enlaza a la tienda) para imprimir
- ✉️ Envío opcional de código admin a email (Resend Worker)
- � Tipografía y legibilidad móvil mejoradas (títulos y precios más grandes)
- ⚡ Carga instantánea (Vanilla JS + Tailwind CDN)

## 🎯 Theming Dinámico

Archivo `js/theme.js` genera una paleta a partir de `themeColor`:

```
base, light, lighter, dark, darker, soft, fg, focus
```

Expone variables CSS `--brand-*` y sobreescribe utilidades Tailwind comunes (bg-cyan, text-cyan, etc.) cuando `body` tiene `theme-active`. Componentes usan clases:

- `brand-btn-primary|secondary|outline|accent`
- `brand-card`, `brand-card-title`, `brand-card-price`
- `brand-title`, `brand-tagline`

## 🤖 IA (Gemini)

1. Al subir imagen: si título/descr. están vacíos genera ambos (fallback solo descripción).
2. Botón ✨ re‑escribe la descripción con un prompt poético.
3. Proxy Worker (opcional) evita exponer la API Key del cliente.

### Worker Proxy Gemini

Directorio: `gemini-proxy-worker/`

1. Añade clave:
   ```bash
   wrangler secret put GEMINI_API_KEY
   ```
2. Despliega:
   ```bash
   wrangler deploy
   ```
3. Configura en `config.js`:
   ```js
   geminiEndpoint: "https://tu-worker-gemini.workers.dev",
   ```

## ✉️ Email Worker (Resend) Opcional

1. Entra en `email-worker/` y añade clave:
   ```bash
   wrangler secret put RESEND_API_KEY
   ```
2. Despliega:
   ```bash
   wrangler deploy
   ```
3. Copia URL y en `config.js`:
   ```js
   emailEndpoint: "https://nai-email-worker.tu-subdominio.workers.dev",
   ```
4. Configura remitente verificado en Resend (panel) para mejor entregabilidad.

Si no se define `emailEndpoint`, simplemente no se envían emails (la app sigue funcionando).

## 🧩 Estructura Simplificada

```
index.html
config.js (no commit)
version.js
js/
  main.js (entrada)
  products.js (CRUD + IA imagen)
  orders.js (pedidos)
  store.js (multi-tienda + adminSecret)
  theme.js (paleta dinámica)
  gemini.js (helpers fetch -> worker/API)
  email.js (envío opcional)
  qr.js (PDF + QR)
gemini-proxy-worker/
email-worker/ (si existe)
```

## � Parámetros URL Clave

| Parámetro | Uso                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------- |
| `store`   | Slug de la tienda creada                                                                       |
| `admin`   | Código admin (si coincide activa modo admin). Vacío (`admin=`) solo muestra botón recuperación |

## 📦 Flujo de Creación de Producto

1. Admin abre panel (`?store=...&admin=code`).
2. Sube imagen (se comprime, se normaliza HEIC, genera título+descr opcionalmente).
3. Ajusta texto / precio y guarda.
4. Producto aparece instantáneamente (snapshot) para clientes.

## 🧪 Siguientes Mejoras (Ideas)

- Reglas Firestore estrictas (roles, claims)
- Historial de pedidos exportable (CSV)
- Stock / cantidad disponible
- Ratings o comentarios moderados
- Modo offline (IndexedDB cache)

---

¡Listo! Cualquier contribución o issue es bienvenida.
