/**
 * SoundManager.js — Sans dependances externes
 * Compatible React Native 0.73+
 * Utilise Vibration native + sonneries systeme Android
 */

import { Vibration, Platform, NativeModules } from "react-native";

// =============================================
// SON SYSTEME ANDROID via RingtoneModule natif
// =============================================
function playSystemSound(type = "notification") {
  if (Platform.OS !== "android") return;
  try {
    if (NativeModules.RingtoneModule) {
      NativeModules.RingtoneModule.playRingtone(type);
    }
  } catch (e) {
    // Silencieux si indisponible
  }
}

function stopSystemSound() {
  if (Platform.OS !== "android") return;
  try {
    if (NativeModules.RingtoneModule) {
      NativeModules.RingtoneModule.stopRingtone();
    }
  } catch (e) {}
}

// =============================================
// FONCTIONS EXPORTEES
// =============================================

/** Initialisation — rien a faire sans react-native-sound */
export function initSounds() {
  console.log("SoundManager pret (mode natif)");
}

/** Notification simple */
export function playNotif() {
  try {
    playSystemSound("notification");
    Vibration.vibrate(200);
  } catch (e) {
    Vibration.vibrate(200);
  }
}

/** Avertissement — SpO2 basse, FC elevee */
export function playWarning() {
  try {
    playSystemSound("notification");
    // 3 vibrations courtes
    Vibration.vibrate([0, 300, 150, 300, 150, 300]);
  } catch (e) {
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);
  }
}

/** Alerte critique — SpO2 < 88%, crise asthme */
export function playCritique() {
  try {
    playSystemSound("alarm");
    // 5 vibrations longues
    Vibration.vibrate([0, 500, 100, 500, 100, 500, 100, 500, 100, 500]);
  } catch (e) {
    Vibration.vibrate([0, 600, 150, 600, 150, 600, 150, 600]);
  }
}

/** Retour a la normale */
export function playRetourNormal() {
  try {
    playSystemSound("notification");
    Vibration.vibrate([0, 100, 80, 100]);
  } catch (e) {
    Vibration.vibrate(150);
  }
}

/** Arrete tout */
export function stopAll() {
  try {
    Vibration.cancel();
    stopSystemSound();
  } catch (e) {}
}

/** Libere les ressources — rien a faire ici */
export function releaseSounds() {}
