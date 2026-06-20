# ?? ASTHMA MONITORING v3 — SUPPTIC Yaoundé

Application mobile React Native de surveillance de l'asthme en temps réel.

## ?? Installation complète

### 1. Prérequis
- Node.js 18+
- JDK 17
- Android Studio + SDK 34
- React Native CLI : `npm install -g react-native-cli`

### 2. Installer les dépendances
```bash
cd C:\Users\user\AsthmaMonitoring
npm install
```

### 3. Firebase Setup
1. Créer un projet sur https://console.firebase.google.com
2. Activer Authentication (Email/Password)
3. Activer Realtime Database
4. Activer Firestore
5. Activer Storage
6. Télécharger `google-services.json` et le placer dans `android/app/`

### 4. Ajouter les permissions Android
Ouvrir `android/app/src/main/AndroidManifest.xml` et ajouter le contenu de `android_permissions.xml`

### 5. Configurer android/build.gradle
```gradle
// Dans android/build.gradle, ajouter dans dependencies :
classpath 'com.google.gms:google-services:4.4.1'
```

### 6. Configurer android/app/build.gradle
```gradle
// En haut du fichier ajouter :
apply plugin: 'com.google.gms.google-services'

// Dans defaultConfig :
minSdkVersion 23
```

### 7. Lancer l'application
```bash
# Terminal 1 — Metro bundler
npx react-native start

# Terminal 2 — Compiler et installer
npx react-native run-android
```

## ?? Fonctionnalités

| Écran | Description |
|-------|-------------|
| ?? Accueil | Tableau de bord vitaux en temps réel |
| ?? Vitaux | Historique des mesures |
| ? Montre | Connexion BLE / GSM / GPS |
| ?? IA | Analyse Claude AI + chat médical |
| ?? Chat | Messagerie patients & médecins |
| ? Rappels | Gestion médicaments |
| ?? Profil | Paramètres & thèmes |

## ?? Thèmes disponibles
- ?? Clair
- ?? Sombre
- ?? Sarcelle
- ?? Violet

## ?? Contexte
Projet SUPPTIC — École Nationale Supérieure Polytechnique, Yaoundé, Cameroun.

## ?? API Key Claude
Dans `src/screens/AIScreen.js`, la clé API Anthropic doit être configurée côté backend
(ne jamais exposer la clé dans le code client en production).
