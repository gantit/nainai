## Email Worker (Resend)

Para activar envío automático del código admin:

1. Entra en `email-worker/` y añade la clave:
```
wrangler secret put RESEND_API_KEY
```
2. Publica el worker:
```
wrangler deploy
```
3. Copia la URL resultante y en `config.js` descomenta y ajusta:
```js
   // emailEndpoint: "https://nai-email-worker.tu-subdominio.workers.dev",
```
4. (Opcional) Configura un dominio/ remitente verificado en Resend y usa `from` personalizado en la llamada si quieres.

Si no configuras el endpoint, la app simplemente omite el envío.

# Nai Nai | Tesoros del Mar 🌊

Una hermosa tienda online para collares de conchas hechos a mano.

## 🚀 Configuración Local

### 1. Clonar el repositorio

```bash
git clone https://github.com/gantit/nainai.git
cd nainai
```

### 2. Configurar las API Keys

1. Copia el archivo de ejemplo: `cp config.example.js config.js`
2. Edita `config.js` y completa con tus keys reales:
   - Firebase API Key
   - Gemini API Key

### 3. Abrir la aplicación

Simplemente abre `index.html` en tu navegador.

## 🔑 Variables de Entorno Necesarias

- **Firebase**: Necesitas configurar un proyecto Firebase con Firestore
- **Gemini**: Necesitas una API Key de Google AI Studio

## 📝 Notas de Seguridad

- El archivo `config.js` está en `.gitignore` y NO se sube al repositorio
- Solo `config.example.js` se incluye como plantilla
- Para producción, las keys se configuran como variables de entorno en el hosting

## 🌐 Acceso de Administrador

Para acceder al panel de administración, añade `?admin=nai` a la URL:

```
https://tu-dominio.com/?admin=nai
```

## 🎨 Características

- ✨ Diseño responsive mobile-first
- 🔒 Panel de administración protegido
- 🤖 Integración con Gemini AI para descripciones
- 📱 Optimizado para dispositivos móviles
- 🎨 Diseño elegante con Tailwind CSS
