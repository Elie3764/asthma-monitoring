/**
 * index.js
 * ---------------------------------------------------------------
 * Cloud Function Firebase (Realtime Database trigger).
 *
 * À CHAQUE FOIS que le firmware ESP32 écrit une nouvelle mesure dans
 *   /patients/{uid}/vitals
 * cette fonction se déclenche automatiquement, calcule le niveau
 * d'alerte (normal / avertissement / critique) pour chaque paramètre
 * en fonction de l'âge du patient, puis écrit le résultat dans :
 *   /patients/{uid}/alerts        (Realtime Database, lu par l'app/dashboard en temps réel)
 *   /patients/{uid}/alertsHistory (Firestore, historique horodaté)
 *
 * Déploiement : firebase deploy --only functions
 * ---------------------------------------------------------------
 */

const { onValueWritten } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");
const { evaluateAllVitals } = require("./thresholds");

// Initialise le SDK Admin (une seule fois par instance de fonction)
initializeApp();
const db = getDatabase();
const firestore = getFirestore();

/**
 * Déclencheur : écoute toute écriture sous /patients/{uid}/vitals
 * (le firmware pousse ici {spo2, fc, fr, tempAmbiante, timestamp})
 */
exports.evaluerSeuilsVitaux = onValueWritten(
  // Le SDK Admin utilisé ici ignore database.rules.json (accès total) —
  // les règles ne s'appliquent qu'aux lectures/écritures client (firmware, app, dashboard)
  "/patients/{uid}/vitals",
  async (event) => {
    const uid = event.params.uid;

    // Nouvelle valeur écrite par le firmware (null si suppression)
    const vitals = event.data.after.val();
    if (!vitals) {
      console.log(`Aucune donnée vitale pour ${uid}, on ignore.`);
      return null;
    }

    // 1. Récupérer l'âge du patient (stocké au moment de l'inscription)
    const profileSnap = await db.ref(`/patients/${uid}/profile/age`).get();
    const age = profileSnap.exists() ? profileSnap.val() : 30; // valeur par défaut si âge manquant

    // 2. Calculer le niveau d'alerte de chaque paramètre + le niveau global
    const alertes = evaluateAllVitals(
      {
        spo2: vitals.spo2,
        fc: vitals.fc,
        fr: vitals.fr,
        tempAmbiante: vitals.tempAmbiante,
      },
      age
    );

    const maintenant = Date.now();

    // 3. Écrire le résultat dans Realtime Database (lecture temps réel
    //    par l'app mobile et le dashboard web)
    await db.ref(`/patients/${uid}/alerts`).set({
      ...alertes,
      derniereMiseAJour: maintenant,
    });

    // 4. Si le niveau global n'est pas "normal", on archive l'événement
    //    dans Firestore pour garder un historique consultable par le médecin
    if (alertes.global !== "normal") {
      await firestore.collection("patients").doc(uid).collection("alertsHistory").add({
        ...alertes,
        vitals,
        timestamp: maintenant,
      });
      console.log(`Alerte ${alertes.global} enregistrée pour le patient ${uid}`);
    }

    return null;
  }
);
