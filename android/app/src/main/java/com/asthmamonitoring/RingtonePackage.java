// android/app/src/main/java/com/asthmamonitoring/RingtonePackage.java

package com.asthmamonitoring;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class RingtonePackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext ctx) {
    return Arrays.<NativeModule>asList(new RingtoneModule(ctx));
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext ctx) {
    return Collections.emptyList();
  }
}
