import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val signingProperties = Properties()
val signingPropertiesFile = rootProject.file("key.properties")
if (signingPropertiesFile.exists()) {
    FileInputStream(signingPropertiesFile).use(signingProperties::load)
}

fun signingValue(propertyName: String, environmentName: String): String? =
    System.getenv(environmentName) ?: signingProperties.getProperty(propertyName)

val releaseStoreFile = signingValue("storeFile", "RIFT_RELEASE_STORE_FILE")
val releaseStorePassword = signingValue("storePassword", "RIFT_RELEASE_STORE_PASSWORD")
val releaseKeyAlias = signingValue("keyAlias", "RIFT_RELEASE_KEY_ALIAS")
val releaseKeyPassword = signingValue("keyPassword", "RIFT_RELEASE_KEY_PASSWORD")
val hasReleaseSigning = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() }

android {
    namespace = "id.pascadigital.riftbound_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "id.pascadigital.riftbound"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (hasReleaseSigning) {
                storeFile = rootProject.file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            if (!hasReleaseSigning) {
                throw GradleException("Release signing is not configured. Provide mobile/android/key.properties locally or RIFT_RELEASE_STORE_FILE, RIFT_RELEASE_STORE_PASSWORD, RIFT_RELEASE_KEY_ALIAS, and RIFT_RELEASE_KEY_PASSWORD in the build environment.")
            }
            if (releaseStoreFile?.endsWith(".jks") == false && releaseStoreFile?.endsWith(".keystore") == false) {
                throw GradleException("Release signing keystore is missing or invalid. Verify RIFT_RELEASE_STORE_FILE/key.properties storeFile.")
            }
            if (!file(releaseStoreFile!!).exists()) {
                throw GradleException("Release signing keystore not found at configured storeFile.")
            }
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
