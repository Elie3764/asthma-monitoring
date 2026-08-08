// android/app/src/main/java/com/asthmamonitoring/RingtoneModule.java
// Module natif Android pour jouer les sonneries systeme

package com.asthmamonitoring;

import android.content.Context;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class RingtoneModule extends ReactContextBaseJavaModule {
  private ReactApplicationContext ctx;
  private Ringtone currentRingtone;

  public RingtoneModule(ReactApplicationContext context) {
    super(context);
    this.ctx = context;
  }

  @Override
  public String getName() { return "RingtoneModule"; }

  @ReactMethod
  public void playRingtone(String type) {
    try {
      Uri uri;
      switch (type) {
        case "alarm":
          uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
          break;
        case "ringtone":
          uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
          break;
        default: // notification
          uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
      }
      if (uri == null) return;
      if (currentRingtone != null && currentRingtone.isPlaying()) {
        currentRingtone.stop();
      }
      currentRingtone = RingtoneManager.getRingtone(ctx, uri);
      if (currentRingtone != null) {
        currentRingtone.play();
      }
    } catch (Exception e) {
      // Silencieux si erreur
    }
  }

  @ReactMethod
  public void stopRingtone() {
    try {
      if (currentRingtone != null && currentRingtone.isPlaying()) {
        currentRingtone.stop();
      }
    } catch (Exception e) {}
  }
}
