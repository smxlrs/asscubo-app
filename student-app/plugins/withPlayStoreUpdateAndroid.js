const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLAY_UPDATE_DEPENDENCY = 'implementation("com.google.android.play:app-update:2.1.0")';

const MODULE_SOURCE = `package __PACKAGE__

import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.content.Intent
import android.net.Uri
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.facebook.react.uimanager.ViewManager
import com.google.android.play.core.install.model.UpdateAvailability

class PlayStoreUpdateModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "PlayStoreUpdate"

  @ReactMethod
  fun checkForUpdate(promise: Promise) {
    AppUpdateManagerFactory.create(reactApplicationContext).appUpdateInfo
      .addOnSuccessListener { appUpdateInfo ->
        when (appUpdateInfo.updateAvailability()) {
          UpdateAvailability.UPDATE_AVAILABLE -> promise.resolve("available")
          UpdateAvailability.UPDATE_NOT_AVAILABLE -> promise.resolve("up_to_date")
          else -> promise.resolve("unavailable")
        }
      }
      .addOnFailureListener {
        // This commonly means that the installed app was not obtained from Google Play.
        promise.resolve("unavailable")
      }
  }

  @ReactMethod
  fun openGooglePlay(promise: Promise) {
    val playIntent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("market://details?id=" + reactApplicationContext.packageName)
    ).apply {
      // Do not let OEM app stores handle the generic market:// scheme.
      setPackage("com.android.vending")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    try {
      reactApplicationContext.startActivity(playIntent)
      promise.resolve(true)
    } catch (_: Exception) {
      // Google Play is unavailable or disabled on this device.
      promise.resolve(false)
    }
  }
}

class PlayStoreUpdatePackage : com.facebook.react.ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(PlayStoreUpdateModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

module.exports = function withPlayStoreUpdateAndroid(config) {
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(PLAY_UPDATE_DEPENDENCY)) {
      config.modResults.contents = config.modResults.contents.replace(
        'dependencies {',
        `dependencies {\n    ${PLAY_UPDATE_DEPENDENCY}`
      );
    }
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const packageName = config.android?.package;
    if (!packageName) {
      throw new Error('withPlayStoreUpdateAndroid requires android.package in app config.');
    }

    const packagePath = packageName.replace(/\./g, path.sep);
    const javaDir = path.join(
      config.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'java',
      packagePath
    );
    const modulePath = path.join(javaDir, 'PlayStoreUpdateModule.kt');
    const applicationPath = path.join(javaDir, 'MainApplication.kt');

    fs.mkdirSync(javaDir, { recursive: true });
    fs.writeFileSync(modulePath, MODULE_SOURCE.replace('__PACKAGE__', packageName));

    const application = fs.readFileSync(applicationPath, 'utf8');
    if (!application.includes('add(PlayStoreUpdatePackage())')) {
      const updatedApplication = application.includes('add(LiquidGlassPackage())')
        ? application.replace(
          'add(LiquidGlassPackage())',
          'add(LiquidGlassPackage())\n          add(PlayStoreUpdatePackage())'
        )
        : application.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.apply {\n          add(PlayStoreUpdatePackage())'
        );
      fs.writeFileSync(applicationPath, updatedApplication);
    }

    return config;
  }]);
};
