// Configuración temporal para producción - CON API KEYS FALSAS PARA TESTING
// ESTO ES SOLO PARA PROBAR EL DESPLIEGUE - NO FUNCIONARÁ REALMENTE
const CONFIG = {
  firebase: {
    apiKey: "AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "test-project.firebaseapp.com",
    projectId: "test-project",
    storageBucket: "test-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdefghijklmnop",
    measurementId: "G-XXXXXXXXXX"
  },
  gemini: {
    apiKey: "AIzaSyBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  }
};
window.CONFIG = CONFIG;
