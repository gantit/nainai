// Configuración real - Este archivo NO debe subirse a Git
const CONFIG = {
  // Configuración de Firebase
  firebase: {
    apiKey: "AIzaSyD7x7Dvd5T1C2GcJHeMwQreesoYlrf8dp8",
    authDomain: "nainai-cbbd7.firebaseapp.com",
    projectId: "nainai-cbbd7",
    storageBucket: "nainai-cbbd7.appspot.com",
    messagingSenderId: "562014512385",
    appId: "1:562014512385:web:7f7b106c68c8d4131f2700",
    measurementId: "G-GV9M7MB5F5",
  },
  endPoints: {
    // Cloudflare workers
    gemini: "https://nai-gemini-proxy.joca.workers.dev",
    email: "https://nai-email-worker.joca.workers.dev",
  },
};

// Exportar la configuración para uso en el HTML
window.CONFIG = CONFIG;
