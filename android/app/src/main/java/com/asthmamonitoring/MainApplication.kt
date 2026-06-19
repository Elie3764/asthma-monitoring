package com.asthmamonitoring
import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.facebook.react.shell.MainReactPackage
import io.invertase.firebase.app.ReactNativeFirebaseAppPackage
import io.invertase.firebase.auth.ReactNativeFirebaseAuthPackage
import io.invertase.firebase.database.ReactNativeFirebaseDatabasePackage
import io.invertase.firebase.firestore.ReactNativeFirebaseFirestorePackage
import io.invertase.firebase.storage.ReactNativeFirebaseStoragePackage
import com.reactnativecommunity.asyncstorage.AsyncStoragePackage
import com.swmansion.rnscreens.RNScreensPackage
import com.th3rdwave.safeareacontext.SafeAreaContextPackage
import com.bleplx.BlePlxPackage
class MainApplication : Application(), ReactApplication {
  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> = listOf(
          MainReactPackage(),
          ReactNativeFirebaseAppPackage(),
          ReactNativeFirebaseAuthPackage(),
          ReactNativeFirebaseDatabasePackage(),
          ReactNativeFirebaseFirestorePackage(),
          ReactNativeFirebaseStoragePackage(),
          AsyncStoragePackage(),
          RNScreensPackage(),
          SafeAreaContextPackage(),
          BlePlxPackage()
        )
        override fun getJSMainModuleName(): String = "index"
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }
  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)
  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }
}
