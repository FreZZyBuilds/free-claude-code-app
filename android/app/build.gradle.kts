plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "dev.fcc.studio"
    compileSdk = 36

    defaultConfig {
        applicationId = "dev.fcc.studio"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        // Release signing comes from env vars in CI; local release builds fall back to the debug key.
        create("release") {
            val store = System.getenv("FCC_KEYSTORE")
            if (!store.isNullOrBlank()) {
                storeFile = file(store)
                storePassword = System.getenv("FCC_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("FCC_KEY_ALIAS")
                keyPassword = System.getenv("FCC_KEY_PASSWORD")
            } else {
                initWith(getByName("debug"))
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }

    packaging {
        resources {
            excludes += setOf("META-INF/INDEX.LIST", "META-INF/io.netty.versions.properties", "META-INF/*.kotlin_module", "META-INF/DEPENDENCIES")
        }
    }

    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/studio-assets"))
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

/** Bundle the built FCC Studio web app (../../app/dist) into the APK as assets/studio. */
val syncStudio by tasks.registering(Sync::class) {
    val dist = rootProject.file("../app/dist")
    doFirst {
        check(File(dist, "index.html").isFile) {
            "FCC Studio is not built. Run `npm ci && npm run build` in ../app first."
        }
    }
    from(dist) { exclude("sw.js", "workbox-*.js", "registerSW.js") }
    into(layout.buildDirectory.dir("generated/studio-assets/studio"))
}
tasks.named("preBuild") { dependsOn(syncStudio) }

dependencies {
    implementation(project(":core"))
    val composeBom = platform("androidx.compose:compose-bom:2026.06.01")
    implementation(composeBom)
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.12.4")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.webkit:webkit:1.17.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
}
