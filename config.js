// Runtime configuration for online multiplayer.
// Set window.WS_URL to your WebSocket endpoint (e.g., wss://your-app.onrender.com).
// On Netlify, set env var WS_URL and generate this file in a build step, or
// override via query param ?ws=wss://your-app.onrender.com.

// If Netlify injects a build-time value, place it here; otherwise this stays null.
// You can also define window.WS_URL in a <script> before game.js to override.
window.WS_URL = window.WS_URL || null;

// Firebase config for WebRTC signaling (public, client-side)
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
    apiKey: "AIzaSyCP7LUpmixHccsyfou0kDDlY7n8m7k6isQ",
    authDomain: "my-football-signal.firebaseapp.com",
    databaseURL: "https://my-football-signal-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "my-football-signal",
    appId: "1:987756099718:web:588af99158826ffd67f907",
    // measurementId not required for signaling
};

