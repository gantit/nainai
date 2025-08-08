// Configuración para producción en GitHub Pages
// Este archivo usa variables que se configuran en el entorno de GitHub Actions

const CONFIG = {
  // Configuración de Firebase
  firebase: {
    apiKey: "{{FIREBASE_API_KEY}}",
    authDomain: "{{FIREBASE_AUTH_DOMAIN}}",
    projectId: "{{FIREBASE_PROJECT_ID}}",
    storageBucket: "{{FIREBASE_STORAGE_BUCKET}}",
    messagingSenderId: "{{FIREBASE_MESSAGING_SENDER_ID}}",
    appId: "{{FIREBASE_APP_ID}}",
    measurementId: "{{FIREBASE_MEASUREMENT_ID}}"
  },
  
  // API Key de Gemini
  gemini: {
    apiKey: "{{GEMINI_API_KEY}}"
  }
};

// Exportar la configuración para uso en el HTML
window.CONFIG = CONFIG;
