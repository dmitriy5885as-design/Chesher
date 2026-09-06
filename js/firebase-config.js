/**
 * ЧЕШЕР — Firebase конфигурация
 * Замени ключи на свои из Firebase Console
 */
"use strict";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAx5WTpq-0dWpU9-7XdexigJy1xYpMGJZA",
  authDomain: "chesher-chess.firebaseapp.com",
  projectId: "chesher-chess",
  storageBucket: "chesher-chess.firebasestorage.app",
  messagingSenderId: "976397952704",
  appId: "1:976397952704:web:89123386be9a14a2336f25",
  databaseURL: "https://chesher-chess-default-rtdb.firebaseio.com"
};

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let firebaseRtdb = null;

function initFirebase() {
  try {
    if(typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded');
      return false;
    }
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebase.auth();
    firebaseDB = firebase.firestore();
    firebaseRtdb = firebase.database();
    console.log('Firebase initialized');
    return true;
  } catch(e) {
    console.error('Firebase init error:', e);
    return false;
  }
}
