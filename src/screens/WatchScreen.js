import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StatusBar, Alert, Switch, Modal, FlatList
} from "react-native";
import { useStore } from "../store/useStore";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import database from "@react-native-firebase/database";
import { BleManager } from "react-native-ble-plx";
import { Buffer } from "buffer";
import { getAgeGroup, SPO2_THRESHOLDS, FC_THRESHOLDS, FR_THRESHOLDS } from "../../functions/thresholds";
import { playCritique, stopAll } from "../utils/SoundManager";

// UUIDs BLE
const BLE_SVC  = "4fafc201-1fb5-459e-8fcc-c5c9c3319142";
const CHR_PAIR = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const CHR_UID  = "beb5483e-36e1-4688-b7f5-ea07361b26a9";
const CHR_VIT  = "beb5483e-36e1-4688-b7f5-ea07361b26aa";

const manager = new BleManager();

const THEMES = [
  { id:0, nom:"Aurora",  couleur:"#00c8c8" },
  { id:1, nom:"Ocean",   couleur:"#0066cc" },
  { id:2, nom:"Sunset",  couleur:"#ff6600" },
  { id:3, nom:"Minimal", couleur:"#888888" },
  { id:4, nom:"Sakura",  couleur:"#ff88aa" },
  { id:5, nom:"Cosmos",  couleur:"#6600cc" },
  { id:6, nom:"Sombre",  couleur:"#222222" },
  { id:7, nom:"Medical", couleur:"#00cc66" },
  { id:8, nom:"Nuit",    couleur:"#003366" },
  { id:9, nom:"Nature",  couleur:"#336600" },
];

export default function WatchScreen({ navigation }) {
  const { theme, connectedDevice, setConnectedDevice,
          setConnectionType, vitals, userProfile } = useStore();

  const isLight = theme === "light";
  const bg    = isLight ? "#f4f7fb" : "#0d1829";
  const card  = isLight ? "#ffffff" : "#111f35";
  const text  = isLight ? "#16242f" : "#e8f4ff";
  const text2 = isLight ? "#50657a" : "#8ba8c4";
  const border= isLight ? "#eef2f7" : "#1e3050";

  const [watchInfo, setWatchInfo]     = useState(null);
  const [bleDevice, setBleDevice]     = useState(null);
  const [connected, setConnected]     = useState(false);
  const [connecting, setConnecting]   = useState(false);
  const [themeModal, setThemeModal]   = useState(false);
  const [themeActuel, setThemeActuel] = useState(0);
  const [onglet, setOnglet]           = useState("vitaux"); // vitaux | controle | reglages
  const [vitauxMontre, setVitauxMontre] = useState(null);
  const [simulating, setSimulating]   = useState(false);
  const deviceRef = useRef(null);
  const pollingRef = useRef(null);

  // Charger infos depuis Firebase
  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const unsub = firestore().collection("patients").doc(uid)
      .onSnapshot(snap => {
        if (snap.exists) {
          const d = snap.data();
          if (d.watchId) {
            setWatchInfo({ id:d.watchId, name:d.watchName||"AsthmaWatch",
              at: d.watchPairedAt?.toDate?.()?.toLocaleDateString("fr-FR")||"--" });
            setConnectedDevice({ id:d.watchId, name:d.watchName });
            setConnectionType("BLE");
          }
        }
      });
    return unsub;
  }, []);

  // Connexion BLE à la montre
  const connecterBLE = async () => {
    if (!watchInfo) return;
    setConnecting(true);
    try {
      // Scanner pour trouver la montre
      let found = null;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          manager.stopDeviceScan();
          reject(new Error("Montre non trouvee. Assurez-vous qu'elle est allumee."));
        }, 10000);
        manager.startDeviceScan(null, null, (err, dev) => {
          if (err) { clearTimeout(timeout); reject(err); return; }
          if (dev?.name?.startsWith("AsthmaWatch")) {
            clearTimeout(timeout);
            manager.stopDeviceScan();
            found = dev;
            resolve();
          }
        });
      });
      const dev = await manager.connectToDevice(found.id);
      await dev.discoverAllServicesAndCharacteristics();
      deviceRef.current = dev;
      setBleDevice(dev);
      setConnected(true);

      // Lecture des vitaux par polling (plus fiable que "monitor"/notify
      // sur certains telephones ou l'abonnement notify echoue
      // silencieusement, sans jamais declencher le callback d'erreur).
      let premierPollDebug = true;
      const lireVitaux = async () => {
        try {
          const char = await dev.readCharacteristicForService(BLE_SVC, CHR_VIT);
          if (!char?.value) {
            if (premierPollDebug) {
              premierPollDebug = false;
              Alert.alert("Debug lecture BLE", "Lecture reussie mais char.value est vide.");
            }
            return;
          }
          const json = Buffer.from(char.value, "base64").toString("utf8");
          if (premierPollDebug) {
            premierPollDebug = false;
            Alert.alert("Debug lecture BLE - Recu", json);
          }
          setVitauxMontre(JSON.parse(json));
        } catch (e) {
          if (premierPollDebug) {
            premierPollDebug = false;
            Alert.alert("Erreur lecture BLE", e.message || String(e));
          }
        }
      };
      // Delai avant la premiere lecture : evite "operation was rejected",
      // erreur BLE frequente si on lit trop tot juste apres la connexion,
      // pendant que la negociation Bluetooth n'est pas encore stabilisee.
      setTimeout(() => {
        lireVitaux();
        pollingRef.current = setInterval(lireVitaux, 3000);
      }, 800);

      // Detecter deconnexion
      dev.onDisconnected(() => {
        setConnected(false);
        setBleDevice(null);
        setVitauxMontre(null);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      });

      // (Alerte "Connecte!" retiree - trop de popups pendant les tests)
    } catch (e) {
      Alert.alert("Erreur", e.message);
    } finally {
      setConnecting(false);
    }
  };

  // Declenche une alerte manuelle directement sur la montre via BLE
  // (envoie "ALERT:CRISE" sur la caracteristique commande, gere par
  // CommandCallbacks::onWrite dans le firmware -> vibreur + ecran rouge
  // immediatement, sans passer par la Realtime Database).
  const declencherAlerteBLE = async () => {
    if (!deviceRef.current || !connected) {
      Alert.alert("Non connecte", "Connectez la montre en BLE d'abord.");
      return;
    }
    try {
      const b64 = Buffer.from("ALERT:CRISE").toString("base64");
      await deviceRef.current.writeCharacteristicWithResponseForService(
        BLE_SVC, CHR_UID, b64
      );
      Alert.alert("Alerte envoyee", "La montre devrait vibrer et afficher l'ecran d'alerte immediatement.");
    } catch (e) {
      Alert.alert("Erreur", "Impossible d'envoyer l'alerte: " + e.message);
    }
  };

  // Envoyer commande theme
  const envoyerTheme = async (themeId) => {
    if (!deviceRef.current || !connected) {
      Alert.alert("Non connecte", "Connectez la montre en BLE d'abord.");
      return;
    }
    try {
      const payload = "THEME:" + themeId;
      const b64 = Buffer.from(payload).toString("base64");
      await deviceRef.current.writeCharacteristicWithResponseForService(
        BLE_SVC, CHR_UID, b64
      );
      setThemeActuel(themeId);
      setThemeModal(false);
      Alert.alert("Theme change!", "Le fond d'ecran a ete mis a jour.");
    } catch (e) {
      Alert.alert("Erreur", "Impossible d'envoyer le theme: " + e.message);
    }
  };

  const dissocier = () => {
    Alert.alert("Dissocier", "Voulez-vous dissocier la montre ?", [
      { text:"Annuler", style:"cancel" },
      { text:"Dissocier", style:"destructive", onPress: async () => {
        const uid = auth().currentUser?.uid;
        if (uid) await firestore().collection("patients").doc(uid).update({
          watchId: firestore.FieldValue.delete(),
          watchName: firestore.FieldValue.delete(),
          watchConnected: false,
        });
        if (deviceRef.current) deviceRef.current.cancelConnection().catch(()=>{});
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        setConnectedDevice(null); setConnectionType(null);
        setWatchInfo(null); setConnected(false);
      }}
    ]);
  };

  // Simuler une crise d'asthme : genere des vitaux critiques coherents
  // avec la tranche d'age du patient (memes seuils que thresholds.js,
  // utilises aussi par le dashboard medecin et l'app parent), et les
  // ecrit dans Realtime Database au meme endroit que la vraie montre
  // (patients/{uid}/vitals) pour declencher les alertes normalement.
  const simulerCrise = () => {
    Alert.alert(
      "Simuler une crise ?",
      "Ceci va generer des valeurs vitales critiques pour tester les alertes (SpO2 basse, FC et frequence respiratoire elevees). A utiliser uniquement pour les tests.",
      [
        { text:"Annuler", style:"cancel" },
        { text:"Simuler", style:"destructive", onPress: async () => {
          const uid = auth().currentUser?.uid;
          if (!uid) return;
          setSimulating(true);
          try {
            const age = parseInt(userProfile?.age, 10) || 30;
            const ageGroup = getAgeGroup(age);
            const spo2T = SPO2_THRESHOLDS[ageGroup];
            const fcT   = FC_THRESHOLDS[ageGroup];
            const frT   = FR_THRESHOLDS[ageGroup];

            // Valeurs nettement dans la zone "critique" pour l'age du patient
            const crisisSpo2 = Math.max(70, spo2T.critiqueMax - 4);
            const crisisHr   = fcT.avertMax + 15;
            const crisisResp = frT.avertMax + 8;

            const crisisVitals = {
              spo2: crisisSpo2,
              hr: crisisHr,
              temp: 37.4,
              resp: crisisResp,
              timestamp: Date.now(),
              source: "simulation_crise",
            };

            await database().ref("patients/" + uid + "/vitals").set(crisisVitals);
            setVitauxMontre(crisisVitals);
            playCritique();
            Alert.alert(
              "Crise simulee",
              `SpO2: ${crisisSpo2}% - FC: ${crisisHr} bpm - Resp: ${crisisResp}/min\nBase sur la tranche d'age: ${ageGroup}`
            );
          } catch (e) {
            Alert.alert("Erreur", "Impossible de simuler la crise: " + e.message);
          } finally {
            setSimulating(false);
          }
        }}
      ]
    );
  };

  // Vitaux a afficher (BLE direct ou store)
  const vit = vitauxMontre || vitals;
  const estAssociee = watchInfo !== null;

  return (
    <View style={{ flex:1, backgroundColor:bg }}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg} />

      {/* HEADER */}
      <View style={{ flexDirection:"row", alignItems:"center", paddingHorizontal:16,
        paddingTop:48, paddingBottom:16, backgroundColor:card,
        borderBottomWidth:1, borderBottomColor:border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight:12 }}>
          <Text style={{ fontSize:16, color:"#00c896", fontWeight:"700" }}>← Retour</Text>
        </TouchableOpacity>
        <Text style={{ fontSize:20, fontWeight:"900", color:text, flex:1 }}>
          Ma Montre
        </Text>
        {/* Indicateur connexion BLE */}
        <View style={{ flexDirection:"row", alignItems:"center", gap:6,
          backgroundColor:connected?"#00c89620":"#88888820",
          paddingHorizontal:10, paddingVertical:4, borderRadius:12 }}>
          <View style={{ width:8, height:8, borderRadius:4,
            backgroundColor:connected?"#00c896":"#888" }} />
          <Text style={{ fontSize:11, fontWeight:"700",
            color:connected?"#00c896":"#888" }}>
            {connected?"BLE":"Hors ligne"}
          </Text>
        </View>
      </View>

      {!estAssociee ? (
        // PAS ASSOCIEE
        <View style={{ flex:1, alignItems:"center", justifyContent:"center", padding:24 }}>
          <Text style={{ fontSize:40, marginBottom:16 }}>⌚</Text>
          <Text style={{ fontSize:18, fontWeight:"900", color:text, textAlign:"center" }}>
            Aucune montre associee
          </Text>
          <Text style={{ fontSize:14, color:text2, textAlign:"center",
            marginTop:8, marginBottom:24, lineHeight:22 }}>
            Associez votre montre AsthmaWatch pour surveiller votre sante en temps reel.
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("WatchPairing")}
            style={{ backgroundColor:"#00c896", borderRadius:14,
              padding:16, alignItems:"center", width:"100%" }}>
            <Text style={{ color:"white", fontWeight:"900", fontSize:15 }}>
              Associer ma montre
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* CARTE MONTRE */}
          <View style={{ backgroundColor:card, margin:16, borderRadius:16,
            padding:16, borderWidth:1, borderColor:"#00c896"+"40" }}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:12 }}>
              <View style={{ width:50, height:50, borderRadius:25,
                backgroundColor:"#00c89620", alignItems:"center",
                justifyContent:"center" }}>
                <Text style={{ fontSize:24 }}>⌚</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:16, fontWeight:"900", color:text }}>
                  {watchInfo.name}
                </Text>
                <Text style={{ fontSize:12, color:text2, marginTop:2 }}>
                  Associee le {watchInfo.at}
                </Text>
              </View>
            </View>

            {/* BOUTON CONNEXION BLE */}
            {!connected ? (
              <TouchableOpacity onPress={connecterBLE} disabled={connecting}
                style={{ backgroundColor:connecting?"#888":"#00c896",
                  borderRadius:12, padding:12, alignItems:"center", marginTop:12 }}>
                <Text style={{ color:"white", fontWeight:"700" }}>
                  {connecting ? "Connexion en cours..." : "Connecter en BLE"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor:"#00c89620", borderRadius:12,
                padding:10, marginTop:12, alignItems:"center" }}>
                <Text style={{ color:"#00c896", fontWeight:"700" }}>
                  Connectee — Donnees en temps reel
                </Text>
              </View>
            )}
          </View>

          {/* ONGLETS */}
          <View style={{ flexDirection:"row", marginHorizontal:16, marginBottom:12,
            backgroundColor:card, borderRadius:12, padding:4,
            borderWidth:1, borderColor:border }}>
            {[["vitaux","Vitaux"],["controle","Controle"],["reglages","Reglages"]].map(([k,l])=>(
              <TouchableOpacity key={k} onPress={() => setOnglet(k)}
                style={{ flex:1, padding:10, borderRadius:10, alignItems:"center",
                  backgroundColor:onglet===k?"#00c896":"transparent" }}>
                <Text style={{ fontSize:12, fontWeight:"700",
                  color:onglet===k?"white":text2 }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal:16, gap:12, paddingBottom:40 }}>

            {/* ===== ONGLET VITAUX ===== */}
            {onglet === "vitaux" && (
              <>
                {/* Grille vitaux */}
                <View style={{ flexDirection:"row", flexWrap:"wrap", gap:10 }}>
                  {[
                    ["SpO2",  vit?.spo2 ? vit.spo2+"%" : "--",       "#00c896", "Saturation"],
                    ["FC",    vit?.hr   ? vit.hr+" bpm":"--",         "#ff5252", "Frequence"],
                    ["Temp",  vit?.temp ? vit.temp.toFixed(1)+"C":"--","#b88a00","Temperature"],
                    ["Hum",   vit?.hum  ? vit.hum+"%":"--",           "#7c3aed", "Humidite"],
                    ["Resp",  vit?.resp ? vit.resp+"/min":"--",        "#0ea5e9", "Respiration"],
                    ["Batt",  vit?.batt ? vit.batt+"%":"--",           "#22c55e", "Batterie"],
                  ].map(([label, val, color, desc]) => (
                    <View key={label} style={{ width:"47%", backgroundColor:card,
                      borderRadius:14, padding:14, borderWidth:1, borderColor:border }}>
                      <Text style={{ fontSize:11, color:text2, marginBottom:4 }}>{desc}</Text>
                      <Text style={{ fontSize:28, fontWeight:"900", color }}>{val}</Text>
                      <Text style={{ fontSize:10, color:text2, marginTop:2 }}>{label}</Text>
                    </View>
                  ))}
                </View>

                {/* GPS */}
                {vit?.gps && (
                  <View style={{ backgroundColor:card, borderRadius:14, padding:14,
                    borderWidth:1, borderColor:"#00c896"+"40" }}>
                    <Text style={{ fontSize:12, fontWeight:"700", color:"#00c896",
                      marginBottom:8 }}>GPS LOCALISATION</Text>
                    <Text style={{ fontSize:13, color:text }}>
                      Lat: {vit.lat?.toFixed(6)}
                    </Text>
                    <Text style={{ fontSize:13, color:text, marginTop:4 }}>
                      Lng: {vit.lng?.toFixed(6)}
                    </Text>
                  </View>
                )}

                {/* SIMULATION DE CRISE (test) */}
                <View style={{ backgroundColor:isLight?"#fde8ec":"#2a0a10",
                  borderRadius:14, padding:16, borderWidth:1,
                  borderColor:"#d6304a"+"40" }}>
                  <Text style={{ fontSize:14, fontWeight:"800", color:"#d6304a",
                    marginBottom:4 }}>Zone de test</Text>
                  <Text style={{ fontSize:12, color:text2, marginBottom:12, lineHeight:18 }}>
                    Genere des vitaux critiques adaptes a l'age du patient pour tester les alertes, sans avoir besoin de la montre physique.
                  </Text>
                  <TouchableOpacity onPress={simulerCrise} disabled={simulating}
                    style={{ backgroundColor:simulating?"#888":"#d6304a",
                      borderRadius:12, padding:14, alignItems:"center" }}>
                    <Text style={{ color:"white", fontWeight:"900" }}>
                      {simulating ? "Simulation en cours..." : "Simuler une crise"}
                    </Text>
                  </TouchableOpacity>
                  {connected && (
                    <TouchableOpacity onPress={declencherAlerteBLE}
                      style={{ backgroundColor:"#7c3aed", borderRadius:12,
                        padding:14, alignItems:"center", marginTop:8 }}>
                      <Text style={{ color:"white", fontWeight:"900" }}>
                        Declencher une alerte sur la montre (BLE)
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => stopAll()}
                    style={{ backgroundColor:"transparent", borderRadius:12,
                      padding:12, alignItems:"center", marginTop:8,
                      borderWidth:1, borderColor:"#d6304a" }}>
                    <Text style={{ color:"#d6304a", fontWeight:"700", fontSize:13 }}>
                      Arreter l'alerte (son/vibration)
                    </Text>
                  </TouchableOpacity>
                </View>

                {!connected && (
                  <View style={{ backgroundColor:isLight?"#fff8e8":"#1a1400",
                    borderRadius:12, padding:12, borderWidth:1,
                    borderColor:"#b88a00"+"40" }}>
                    <Text style={{ fontSize:12, color:"#b88a00", textAlign:"center" }}>
                      Connectez la montre en BLE pour les donnees en temps reel
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ===== ONGLET CONTROLE ===== */}
            {onglet === "controle" && (
              <>
                {/* Fond d'ecran */}
                <View style={{ backgroundColor:card, borderRadius:16, padding:16,
                  borderWidth:1, borderColor:border }}>
                  <Text style={{ fontSize:16, fontWeight:"800", color:text,
                    marginBottom:4 }}>Fond d'ecran</Text>
                  <Text style={{ fontSize:13, color:text2, marginBottom:12 }}>
                    Choisissez le theme de la montre
                  </Text>
                  <TouchableOpacity onPress={() => setThemeModal(true)}
                    style={{ backgroundColor:"#00c896", borderRadius:12,
                      padding:14, alignItems:"center" }}>
                    <Text style={{ color:"white", fontWeight:"700" }}>
                      Theme actuel: {THEMES[themeActuel].nom}
                    </Text>
                  </TouchableOpacity>
                  {!connected && (
                    <Text style={{ fontSize:11, color:text2, marginTop:8, textAlign:"center" }}>
                      Connectez la montre en BLE pour changer le theme
                    </Text>
                  )}
                </View>

                {/* Alertes SMS */}
                <View style={{ backgroundColor:card, borderRadius:16, padding:16,
                  borderWidth:1, borderColor:border }}>
                  <Text style={{ fontSize:16, fontWeight:"800", color:text,
                    marginBottom:4 }}>Alertes SMS</Text>
                  <Text style={{ fontSize:13, color:text2, marginBottom:8 }}>
                    Numero pour les alertes de crise
                  </Text>
                  <View style={{ backgroundColor:isLight?"#e8faf5":"#0a2a20",
                    borderRadius:10, padding:12 }}>
                    <Text style={{ fontSize:14, fontWeight:"700",
                      color:"#00c896" }}>
                      {userProfile?.phone || "Non configure"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Profile")}
                    style={{ marginTop:10, alignItems:"center" }}>
                    <Text style={{ color:"#00c896", fontWeight:"600", fontSize:13 }}>
                      Modifier dans les reglages →
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Pages de la montre */}
                <View style={{ backgroundColor:card, borderRadius:16, padding:16,
                  borderWidth:1, borderColor:border }}>
                  <Text style={{ fontSize:16, fontWeight:"800", color:text,
                    marginBottom:12 }}>Pages de la montre</Text>
                  {[
                    ["Page 1 — Home",    "Heure, SpO2, FC, Temp, Resp"],
                    ["Page 2 — Vitaux",  "Tous les capteurs en detail"],
                    ["Page 3 — GPS",     "Localisation en temps reel"],
                    ["Page 4 — Conseil", "Alertes et conseils sante"],
                    ["Page 5 — Systeme", "Infos BLE, SIM, GPS, batterie"],
                    ["Page 6 — Reglages","Theme, son, vibration"],
                  ].map(([titre, desc]) => (
                    <View key={titre} style={{ flexDirection:"row",
                      paddingVertical:8, borderBottomWidth:1, borderBottomColor:border }}>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize:13, fontWeight:"700", color:text }}>
                          {titre}
                        </Text>
                        <Text style={{ fontSize:11, color:text2, marginTop:2 }}>
                          {desc}
                        </Text>
                      </View>
                      <Text style={{ color:text2 }}>BTN1 ›</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ===== ONGLET REGLAGES ===== */}
            {onglet === "reglages" && (
              <>
                <View style={{ backgroundColor:card, borderRadius:16,
                  borderWidth:1, borderColor:border, overflow:"hidden" }}>
                  {[
                    { label:"Nom",          val:watchInfo?.name },
                    { label:"ID",           val:watchInfo?.id?.substring(0,16)+"..." },
                    { label:"Associee le",  val:watchInfo?.at },
                    { label:"Connexion",    val:connected?"BLE Actif":"Hors ligne" },
                  ].map((r, i) => (
                    <View key={i} style={{ flexDirection:"row", padding:14,
                      borderBottomWidth:1, borderBottomColor:border }}>
                      <Text style={{ flex:1, fontSize:13, color:text2 }}>{r.label}</Text>
                      <Text style={{ fontSize:13, fontWeight:"600",
                        color:r.label==="Connexion"&&connected?"#00c896":text }}>
                        {r.val || "--"}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Bouton dissocier */}
                <TouchableOpacity onPress={dissocier}
                  style={{ backgroundColor:"#fde8ec", borderRadius:16,
                    padding:16, alignItems:"center", borderWidth:1,
                    borderColor:"#d6304a"+"30" }}>
                  <Text style={{ color:"#d6304a", fontWeight:"900" }}>
                    Dissocier la montre
                  </Text>
                </TouchableOpacity>

                <View style={{ backgroundColor:isLight?"#e8faf5":"#0a2a20",
                  borderRadius:12, padding:14 }}>
                  <Text style={{ fontSize:12, fontWeight:"700", color:"#00a878",
                    marginBottom:6 }}>NAVIGATION SUR LA MONTRE</Text>
                  <Text style={{ fontSize:12, color:"#00a878", lineHeight:22 }}>
                    BTN1 = Page suivante{"\n"}
                    BTN2 = Retour accueil{"\n"}
                    BTN2 long = Retour depuis Reglages{"\n"}
                    Dans Reglages: BTN1=item suivant, BTN2=modifier
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* MODAL THEMES */}
      <Modal visible={themeModal} transparent animationType="slide"
        onRequestClose={() => setThemeModal(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)",
          justifyContent:"flex-end" }}>
          <View style={{ backgroundColor:card, borderTopLeftRadius:20,
            borderTopRightRadius:20, padding:20, paddingBottom:40,
            maxHeight:"70%" }}>
            <Text style={{ fontSize:18, fontWeight:"900", color:text,
              marginBottom:16 }}>Choisir le fond d'ecran</Text>
            <FlatList
              data={THEMES}
              keyExtractor={t => t.id.toString()}
              numColumns={2}
              columnWrapperStyle={{ gap:10 }}
              contentContainerStyle={{ gap:10 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => envoyerTheme(item.id)}
                  style={{ flex:1, padding:16, borderRadius:14,
                    backgroundColor:item.couleur+"20",
                    borderWidth:2,
                    borderColor:themeActuel===item.id?item.couleur:border,
                    alignItems:"center", gap:8 }}>
                  <View style={{ width:40, height:40, borderRadius:20,
                    backgroundColor:item.couleur }} />
                  <Text style={{ fontSize:13, fontWeight:"700",
                    color:text }}>{item.nom}</Text>
                  {themeActuel===item.id && (
                    <Text style={{ fontSize:10, color:item.couleur,
                      fontWeight:"700" }}>Actuel</Text>
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setThemeModal(false)}
              style={{ marginTop:16, padding:14, alignItems:"center",
                backgroundColor:isLight?"#eef2f7":"#1e3050",
                borderRadius:12 }}>
              <Text style={{ color:text2, fontWeight:"700" }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}