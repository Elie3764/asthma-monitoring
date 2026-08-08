import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, ActivityIndicator
} from "react-native";
import { useStore } from "../store/useStore";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const { width } = Dimensions.get("window");

export default function VitauxScreen({ navigation }) {
  const { theme, vitals } = useStore();
  const isLight = theme === "light";
  const bg    = isLight ? "#f4f7fb" : "#0d1829";
  const card  = isLight ? "#ffffff" : "#111f35";
  const text  = isLight ? "#16242f" : "#e8f4ff";
  const text2 = isLight ? "#50657a" : "#8ba8c4";
  const border= isLight ? "#eef2f7" : "#1e3050";

  const [historique, setHistorique] = useState([]);
  const [onglet, setOnglet]         = useState("temps_reel");
  const [loading, setLoading]       = useState(false);
  const [erreur, setErreur]         = useState(null);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    // BUG 1 CORRIGE : si uid null, on sortait mais sans cleanup -> fuite memoire
    // BUG 2 CORRIGE : snap peut etre null si Firestore n'a pas encore repondu
    if (!uid) {
      setErreur("Utilisateur non connecte");
      return;
    }

    setLoading(true);
    setErreur(null);

    const unsub = firestore()
      .collection("patients")
      .doc(uid)
      .collection("vitaux")
      .orderBy("createdAt", "desc")
      .limit(20)
      .onSnapshot(
        snap => {
          // CORRECTION PRINCIPALE : snap peut etre null
          if (!snap || !snap.docs) {
            setHistorique([]);
            setLoading(false);
            return;
          }
          setHistorique(
            snap.docs.map(d => ({ id: d.id, ...d.data() }))
          );
          setLoading(false);
          setErreur(null);
        },
        err => {
          // CORRECTION : capturer l'erreur au lieu de crasher
          console.error("[VitauxScreen] Firestore erreur:", err.message);
          if (err.message.includes("requires an index")) {
            setErreur("Index Firestore manquant — voir console pour le lien");
          } else {
            setErreur(err.message);
          }
          setLoading(false);
        }
      );

    // Cleanup correct : toujours retourner la fonction d'unsubscribe
    return () => unsub();
  }, []);

  const vitauxListe = [
    { label: "SpO2",         value: vitals?.spo2,  unit: "%",    color: "#00c896",
      icon: "O2", min: 88, max: 100,
      status: vitals?.spo2 != null
        ? (vitals.spo2 < 88 ? "Critique" : vitals.spo2 < 92 ? "Bas" : "Normal")
        : "--" },
    { label: "Frequence FC", value: vitals?.hr,    unit: "bpm",  color: "#ff5252",
      icon: "FC", min: 40, max: 160,
      status: vitals?.hr != null
        ? (vitals.hr > 120 ? "Eleve" : vitals.hr > 100 ? "Haut" : "Normal")
        : "--" },
    { label: "Temperature",  value: vitals?.temp,  unit: "°C",   color: "#b88a00",
      icon: "T°", min: 35, max: 42,
      status: vitals?.temp != null
        ? (vitals.temp >= 39.5 ? "Critique" : vitals.temp >= 38 ? "Fievre" : "Normal")
        : "--" },
    { label: "Humidite",     value: vitals?.hum,   unit: "%",    color: "#7c3aed",
      icon: "HU", min: 0, max: 100,
      status: vitals?.hum != null
        ? (vitals.hum > 80 ? "Eleve" : "Normal")
        : "--" },
    { label: "Respiration",  value: vitals?.resp,  unit: "/min", color: "#0ea5e9",
      icon: "RR", min: 8, max: 30,
      status: vitals?.resp != null
        ? (vitals.resp > 25 ? "Critique" : vitals.resp > 20 ? "Rapide" : "Normal")
        : "--" },
  ];

  const statusColor = (s) =>
    s === "Critique"
      ? "#d6304a"
      : ["Fievre", "Eleve", "Haut", "Rapide", "Bas"].includes(s)
      ? "#d96a1f"
      : s === "Normal"
      ? "#00a878"
      : "#8093a3";

  const formatHeure = (createdAt) => {
    try {
      const date = createdAt?.toDate?.();
      if (!date) return "--";
      return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "--";
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar
        barStyle={isLight ? "dark-content" : "light-content"}
        backgroundColor={bg}
      />

      {/* HEADER */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16,
        backgroundColor: card, borderBottomWidth: 1, borderBottomColor: border
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 16, color: "#00c896", fontWeight: "700" }}>← Retour</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "900", color: text, flex: 1 }}>
          Mes Donnees Vitales
        </Text>
      </View>

      {/* ONGLETS */}
      <View style={{
        flexDirection: "row", backgroundColor: card,
        borderBottomWidth: 1, borderBottomColor: border
      }}>
        {[["temps_reel", "Temps reel"], ["historique", "Historique"]].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setOnglet(key)}
            style={{
              flex: 1, padding: 14, alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: onglet === key ? "#00c896" : "transparent"
            }}>
            <Text style={{
              fontWeight: "700", fontSize: 13,
              color: onglet === key ? "#00c896" : text2
            }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>

        {/* ===== ONGLET TEMPS REEL ===== */}
        {onglet === "temps_reel" && (
          <>
            {vitauxListe.map(v => (
              <View key={v.label} style={{
                backgroundColor: card, borderRadius: 16,
                padding: 16, borderWidth: 1, borderColor: border
              }}>
                <View style={{
                  flexDirection: "row", alignItems: "center", marginBottom: 12
                }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: v.color + "20", alignItems: "center",
                    justifyContent: "center", marginRight: 12
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: "900", color: v.color }}>
                      {v.icon}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: text2, fontWeight: "600" }}>
                      {v.label}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                      <Text style={{ fontSize: 32, fontWeight: "900", color: v.color }}>
                        {v.value != null
                          ? (v.label === "Temperature"
                              ? Number(v.value).toFixed(1)
                              : v.value)
                          : "--"}
                      </Text>
                      <Text style={{ fontSize: 14, color: text2 }}>{v.unit}</Text>
                    </View>
                  </View>
                  <View style={{
                    backgroundColor: statusColor(v.status) + "20",
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20
                  }}>
                    <Text style={{
                      fontSize: 11, fontWeight: "700",
                      color: statusColor(v.status)
                    }}>{v.status}</Text>
                  </View>
                </View>

                {/* BARRE DE PROGRESSION */}
                {v.value != null && (
                  <View>
                    <View style={{ height: 6, backgroundColor: border, borderRadius: 3 }}>
                      <View style={{
                        height: 6, borderRadius: 3,
                        backgroundColor: v.color,
                        width: `${Math.min(100, Math.max(0,
                          ((v.value - v.min) / (v.max - v.min)) * 100))}%`
                      }} />
                    </View>
                    <View style={{
                      flexDirection: "row", justifyContent: "space-between", marginTop: 4
                    }}>
                      <Text style={{ fontSize: 10, color: text2 }}>{v.min}{v.unit}</Text>
                      <Text style={{ fontSize: 10, color: text2 }}>{v.max}{v.unit}</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* ===== ONGLET HISTORIQUE ===== */}
        {onglet === "historique" && (
          <>
            <Text style={{ fontSize: 13, color: text2, marginBottom: 8 }}>
              20 dernieres mesures
            </Text>

            {/* Indicateur de chargement */}
            {loading && (
              <View style={{
                backgroundColor: card, borderRadius: 16, padding: 32,
                alignItems: "center", borderWidth: 1, borderColor: border
              }}>
                <ActivityIndicator size="large" color="#00c896" />
                <Text style={{ fontSize: 13, color: text2, marginTop: 12 }}>
                  Chargement...
                </Text>
              </View>
            )}

            {/* Message d'erreur */}
            {!loading && erreur && (
              <View style={{
                backgroundColor: "#d6304a10", borderRadius: 16, padding: 20,
                borderWidth: 1, borderColor: "#d6304a40"
              }}>
                <Text style={{ fontSize: 14, color: "#d6304a", fontWeight: "700",
                  marginBottom: 4 }}>
                  ⚠️ Erreur de connexion
                </Text>
                <Text style={{ fontSize: 12, color: text2 }}>{erreur}</Text>
                {erreur.includes("index") && (
                  <Text style={{ fontSize: 11, color: "#d96a1f", marginTop: 8 }}>
                    → Creer l'index dans la console Firebase (voir logs)
                  </Text>
                )}
              </View>
            )}

            {/* Liste vide */}
            {!loading && !erreur && historique.length === 0 && (
              <View style={{
                backgroundColor: card, borderRadius: 16, padding: 24,
                alignItems: "center", borderWidth: 1, borderColor: border
              }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: text }}>
                  Pas encore de donnees
                </Text>
                <Text style={{ fontSize: 13, color: text2, textAlign: "center", marginTop: 4 }}>
                  Connectez votre montre pour voir l'historique
                </Text>
              </View>
            )}

            {/* Liste des mesures */}
            {!loading && historique.map((entry, i) => (
              <View key={entry.id || i} style={{
                backgroundColor: card, borderRadius: 14,
                padding: 14, borderWidth: 1, borderColor: border,
                flexDirection: "row", gap: 12, alignItems: "center"
              }}>
                <Text style={{
                  fontSize: 11, color: text2, width: 24, fontWeight: "700"
                }}>#{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: text }}>
                    SpO2: {entry.spo2 ?? "--"}% · FC: {entry.hr ?? "--"} bpm
                  </Text>
                  <Text style={{ fontSize: 11, color: text2, marginTop: 2 }}>
                    T: {entry.temp != null ? Number(entry.temp).toFixed(1) : "--"}°C
                    {" · "}Resp: {entry.resp ?? "--"}/min
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: text2 }}>
                  {formatHeure(entry.createdAt)}
                </Text>
              </View>
            ))}
          </>
        )}

      </ScrollView>
    </View>
  );
}
