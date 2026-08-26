/**
 * thresholds.js
 * ---------------------------------------------------------------
 * Contient toutes les valeurs seuils vitales (SpO2, FC, FR, température
 * ambiante) par tranche d'âge, ainsi que les fonctions pour déterminer
 * automatiquement le niveau d'alerte (normal / avertissement / critique)
 * d'une mesure donnée.
 *
 * Ce module est indépendant de Firebase : il peut être importé aussi bien
 * dans une Cloud Function que dans le dashboard web ou l'app mobile.
 * ---------------------------------------------------------------
 */

// -----------------------------------------------------------------
// 1. Définition des tranches d'âge (bornes en années)
// -----------------------------------------------------------------
const AGE_GROUPS = [
  { id: "nourrisson", min: 0,  max: 1  },
  { id: "enfant_1_3", min: 1,  max: 3  },
  { id: "enfant_4_12", min: 4,  max: 12 },
  { id: "adolescent", min: 13, max: 17 },
  { id: "adulte",     min: 18, max: 64 },
  { id: "senior",     min: 65, max: 999 },
];

/**
 * Retourne l'identifiant de la tranche d'âge correspondant à un âge donné.
 * @param {number} age - âge du patient en années
 * @returns {string} identifiant de la tranche (ex: "adulte")
 */
function getAgeGroup(age) {
  const group = AGE_GROUPS.find((g) => age >= g.min && age <= g.max);
  return group ? group.id : "adulte"; // valeur par défaut de sécurité
}

// -----------------------------------------------------------------
// 2. Seuils SpO2 (%) par tranche d'âge
//    normal: valeur minimale pour être "normal"
//    avertissement: [min, max] de la plage d'avertissement
//    critique: valeur en dessous de laquelle c'est critique
// -----------------------------------------------------------------
const SPO2_THRESHOLDS = {
  nourrisson:  { normalMin: 95, avertMin: 92, avertMax: 94, critiqueMax: 92 },
  enfant_1_3:  { normalMin: 95, avertMin: 92, avertMax: 94, critiqueMax: 92 },
  enfant_4_12: { normalMin: 95, avertMin: 92, avertMax: 94, critiqueMax: 92 },
  adolescent:  { normalMin: 95, avertMin: 92, avertMax: 94, critiqueMax: 92 },
  adulte:      { normalMin: 95, avertMin: 92, avertMax: 94, critiqueMax: 88 },
  senior:      { normalMin: 94, avertMin: 90, avertMax: 93, critiqueMax: 88 },
};

// -----------------------------------------------------------------
// 3. Seuils Fréquence cardiaque (bpm) par tranche d'âge
// -----------------------------------------------------------------
const FC_THRESHOLDS = {
  nourrisson:  { bradyMax: 80, normalMin: 80,  normalMax: 160, avertMax: 180 },
  enfant_1_3:  { bradyMax: 70, normalMin: 70,  normalMax: 150, avertMax: 170 },
  enfant_4_12: { bradyMax: 60, normalMin: 60,  normalMax: 130, avertMax: 150 },
  adolescent:  { bradyMax: 55, normalMin: 55,  normalMax: 110, avertMax: 130 },
  adulte:      { bradyMax: 50, normalMin: 50,  normalMax: 100, avertMax: 120 },
  senior:      { bradyMax: 45, normalMin: 45,  normalMax: 100, avertMax: 120 },
};

// -----------------------------------------------------------------
// 4. Seuils Fréquence respiratoire (cycles/min) par tranche d'âge
//    ⚠️ Valeurs non vérifiées par recherche web — à confirmer avant
//    utilisation clinique définitive.
// -----------------------------------------------------------------
const FR_THRESHOLDS = {
  nourrisson:  { bradyMax: 30, normalMin: 30, normalMax: 53, avertMax: 60 },
  enfant_1_3:  { bradyMax: 22, normalMin: 22, normalMax: 37, avertMax: 45 },
  enfant_4_12: { bradyMax: 18, normalMin: 18, normalMax: 30, avertMax: 40 },
  adolescent:  { bradyMax: 12, normalMin: 12, normalMax: 20, avertMax: 25 },
  adulte:      { bradyMax: 12, normalMin: 12, normalMax: 20, avertMax: 24 },
  senior:      { bradyMax: 12, normalMin: 12, normalMax: 24, avertMax: 30 },
};

// -----------------------------------------------------------------
// 5. Seuils Température ambiante (°C) — indépendants de l'âge
// -----------------------------------------------------------------
const TEMP_AMBIANTE_THRESHOLDS = {
  critiqueFroidMax: 12,
  avertFroidMax: 18,
  normalMax: 24,
  avertChaudMax: 30,
  // au-dessus de 30°C => critique chaud
};

// -----------------------------------------------------------------
// 6. Fonctions d'évaluation — retournent "normal" | "avertissement" | "critique"
// -----------------------------------------------------------------

function evaluateSpo2(value, ageGroup) {
  const t = SPO2_THRESHOLDS[ageGroup];
  if (value < t.critiqueMax) return "critique";
  if (value >= t.normalMin) return "normal";
  return "avertissement"; // entre critiqueMax et normalMin
}

function evaluateFc(value, ageGroup) {
  const t = FC_THRESHOLDS[ageGroup];
  if (value < t.bradyMax) return "critique";      // bradycardie = critique
  if (value > t.avertMax) return "critique";      // tachycardie sévère
  if (value > t.normalMax) return "avertissement"; // tachycardie modérée
  return "normal";
}

function evaluateFr(value, ageGroup) {
  const t = FR_THRESHOLDS[ageGroup];
  if (value < t.bradyMax) return "critique";
  if (value > t.avertMax) return "critique";
  if (value > t.normalMax) return "avertissement";
  return "normal";
}

function evaluateTempAmbiante(value) {
  const t = TEMP_AMBIANTE_THRESHOLDS;
  if (value < t.critiqueFroidMax) return "critique";
  if (value > t.avertChaudMax) return "critique";
  if (value < t.avertFroidMax) return "avertissement";
  if (value > t.normalMax) return "avertissement";
  return "normal";
}

/**
 * Évalue l'ensemble des constantes vitales d'un patient et retourne
 * un objet { spo2, fc, fr, tempAmbiante, global } avec le niveau
 * d'alerte de chaque paramètre + le niveau global (le pire des quatre).
 *
 * @param {object} vitals - { spo2, fc, fr, tempAmbiante }
 * @param {number} age - âge du patient en années
 */
function evaluateAllVitals(vitals, age) {
  const ageGroup = getAgeGroup(age);

  const result = {
    spo2: evaluateSpo2(vitals.spo2, ageGroup),
    fc: evaluateFc(vitals.fc, ageGroup),
    fr: evaluateFr(vitals.fr, ageGroup),
    tempAmbiante: evaluateTempAmbiante(vitals.tempAmbiante),
  };

  // Le niveau global = le plus sévère parmi les 4 paramètres
  const order = { normal: 0, avertissement: 1, critique: 2 };
  result.global = Object.values(result).reduce(
    (worst, level) => (order[level] > order[worst] ? level : worst),
    "normal"
  );

  return result;
}

module.exports = {
  AGE_GROUPS,
  getAgeGroup,
  SPO2_THRESHOLDS,
  FC_THRESHOLDS,
  FR_THRESHOLDS,
  TEMP_AMBIANTE_THRESHOLDS,
  evaluateSpo2,
  evaluateFc,
  evaluateFr,
  evaluateTempAmbiante,
  evaluateAllVitals,
};
