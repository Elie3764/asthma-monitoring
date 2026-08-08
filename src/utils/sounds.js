/**
 * sounds.js — Sons de notification
 * Compatible React Native 0.73+
 */
import { Vibration, Platform, NativeModules } from "react-native";

function playSystemSound(type = "notification") {
  if (Platform.OS !== "android") return;
  try {
    if (NativeModules.RingtoneModule) {
      NativeModules.RingtoneModule.playRingtone(type);
    }
  } catch (e) {}
}

export function playNotificationSound() {
  try {
    playSystemSound("notification");
    Vibration.vibrate(200);
  } catch (e) {
    Vibration.vibrate(200);
  }
}

export function playWarningSound() {
  try {
    playSystemSound("notification");
    Vibration.vibrate([0, 300, 150, 300, 150, 300]);
  } catch (e) {
    Vibration.vibrate([0, 400, 200, 400]);
  }
}

export function playCritiqueSound() {
  try {
    playSystemSound("alarm");
    Vibration.vibrate([0, 500, 100, 500, 100, 500, 100, 500, 100, 500]);
  } catch (e) {
    Vibration.vibrate([0, 600, 150, 600]);
  }
}

export function stopAllSounds() {
  try { Vibration.cancel(); } catch (e) {}
}
