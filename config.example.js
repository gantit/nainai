// Archivo de configuración de ejemplo - NO contiene keys reales
// Copia este archivo como 'config.js' y completa con tus keys reales

const CONFIG = {
  // Configuración de Firebase
  firebase: {
    apiKey: "TU_FIREBASE_API_KEY_AQUI",
    authDomain: "TU_PROJECT_ID.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROJECT_ID.appspot.com",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID",
    measurementId: "TU_MEASUREMENT_ID",
  },

  // API Key de Gemini
  gemini: {
    apiKey: "TU_GEMINI_API_KEY_AQUI",
  },
};

// Exportar la configuración para uso en el HTML
window.CONFIG = CONFIG;
