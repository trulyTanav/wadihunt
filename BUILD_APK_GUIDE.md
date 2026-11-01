# WadiHunt — Android APK Build & Deployment Guide

This guide details all the ways you can generate the Android APK for **WadiHunt** and run it smoothly on Android devices.

---

## 🎯 Verified Android Features in this Build
- **High-Accuracy Real-Time GPS Tracking**: Capacitor Geolocation plugin with native hardware GPS watch and zero-delay broadcast.
- **Hardware Compass & Bearing**: Real compass heading orientation tracking with direction cone.
- **Player Codename & Custom Avatar / Camera Photo**:
  - Live photo capture from phone camera (`<input capture="user">` with `CAMERA` permission declared).
  - Gallery upload or tactical operator badges (Wolf, Raven, Viper, Ghost, Skull, Target, Volt, Fox).
  - Auto-compressed on-device via HTML5 canvas to lightweight 96x96 avatars for instant multi-device sync.
- **Screen WakeLock**: Prevents the phone display from dimming or sleeping while running in an outdoor match.
- **Cellular & Wi-Fi Grace Period**: 45-second reconnect grace period so roaming between 4G/5G and Wi-Fi doesn't drop players mid-hunt.
- **Offline Server IP Assistant**: Prompts users to set the server IP if disconnected, ensuring effortless LAN / hotspot multiplayer.

---

## 🚀 Option 1: Build Using Android Studio (Recommended, 1-Click)

Android Studio comes bundled with the required JDK 17/21 and Android SDK tools.

1. **Open the Project in Android Studio**:
   - Open Android Studio.
   - Click **Open** and select the folder:
     ```
     d:\Projects\wadihunt\client\android
     ```
2. **Wait for Gradle Sync**:
   - Android Studio will automatically configure and index the project using its built-in JDK.
3. **Build the APK**:
   - In the top menu bar, click:
     **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
4. **Locate your APK**:
   - When finished, a notification popup will say *"APKs generated successfully"*. Click **locate**.
   - Your installable APK will be at:
     ```
     client\android\app\build\outputs\apk\debug\app-debug.apk
     ```
5. **Install on Phone**:
   - Transfer `app-debug.apk` to your phone via USB cable, Google Drive, WhatsApp, or Telegram.
   - Tap the APK file on your Android phone and select **Install**.

---

## 💻 Option 2: Build from Windows Command Line (Using JDK 17+)

Modern Android Gradle Plugin (8.13+) requires **Java 17 or higher**.

1. **Install OpenJDK 17 or 21** (if not already installed):
   - Run in PowerShell (as Administrator):
     ```powershell
     winget install Microsoft.OpenJDK.17
     ```
2. **Build the Web Bundle & Sync**:
   ```powershell
   cd d:\Projects\wadihunt\client
   npm run build
   npx cap sync android
   ```
3. **Build the Debug APK**:
   ```powershell
   cd android
   .\gradlew.bat assembleDebug
   ```
4. Your APK will be generated at:
   ```
   client\android\app\build\outputs\apk\debug\app-debug.apk
   ```

---

## ☁️ Option 3: Automated Cloud Build (GitHub Actions — No Local Setup)

We have added a GitHub Actions workflow at [`.github/workflows/build-apk.yml`](file:///d:/Projects/wadihunt/.github/workflows/build-apk.yml).

1. Push your repository to GitHub:
   ```powershell
   git add .
   git commit -m "Add avatar photo customization and APK workflow"
   git push origin main
   ```
2. Go to your GitHub repository in your browser:
   - Click on the **Actions** tab.
   - Click **Build Android APK** workflow.
   - When it finishes (~2 minutes), click the completed run.
3. Under **Artifacts** at the bottom of the page, download **`wadihunt-debug-apk`**.
4. Unzip and install `app-debug.apk` directly on any Android device!

---

## 📡 Connecting Android Devices to the Game Server

When running the APK on your phone:
1. **Connect both your phone and PC to the same Wi-Fi network** (or connect your PC to your phone's mobile hotspot).
2. **Find your PC's local IP address**:
   - On your PC, open PowerShell and run: `ipconfig`
   - Look for IPv4 Address (e.g., `192.168.1.5` or `192.168.43.15`).
3. **Open WadiHunt on Android**:
   - If offline, tap the top connection badge or tap the **Gear** icon (Settings).
   - In **GAME SERVER URL (SOCKET.IO)**, enter:
     ```
     http://192.168.X.X:3001
     ```
   - Tap **SAVE SETTINGS**. The status indicator will turn green (`ONLINE`) immediately!
4. **Deploying on a Public VPS / Render / Railway**:
   - If hosting your server online (e.g. `https://my-wadihunt.onrender.com`), enter that HTTPS URL in the app settings, and players can hunt anywhere worldwide over mobile data!
