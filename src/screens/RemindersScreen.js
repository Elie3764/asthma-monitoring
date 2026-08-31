import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Alert, Switch
} from "react-native";
import { useStore } from "../store/useStore";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

// IMPORTANT : pas d'import statique de notifee ici. Un import
// classique ("import notifee from ...") execute IMMEDIATEMENT le
// code interne de notifee des que ce fichier est charge par le
// bundle JS - y compris sur des ecrans jamais ouverts par
// l'utilisateur, simplement parce qu'un autre fichier les importe
// (ex: le navigateur). Si le pont natif n'a pas encore fini de tout
// enregistrer a cet instant precis (variable selon l'appareil et sa
// rapidite), ca provoque un crash immediat et systematique de toute
// l'app au demarrage : "Notifee native module not found".
// On charge donc notifee UNIQUEMENT au moment ou une fonction qui
// en a besoin est reellement appelee (via require() a l'interieur
// de la fonction), c'est-a-dire bien apres que l'app ait fini de
// demarrer et que le pont natif soit garanti pret.
function getNotifee() {
  return require("@notifee/react-native").default;
}
function getNotifeeConstants() {
  return require("@notifee/react-native");
}

// Canal Android dedie aux rappels, avec son (utilise le son de
// notification par defaut du systeme - suffisant pour un rappel de
// medicament, contrairement a l'alerte critique qui a son propre
// SoundManager avec une vraie alarme en boucle).
const CANAL_RAPPELS = "rappels-medicaments";

async function assurerPermissionsEtCanal() {
  const notifee = getNotifee();
  const { AndroidImportance, AuthorizationStatus } = getNotifeeConstants();
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
    Alert.alert(
      "Notifications desactivees",
      "Autorisez les notifications dans les reglages du telephone pour que vos rappels sonnent."
    );
  }
  await notifee.createChannel({
    id: CANAL_RAPPELS,
    name: "Rappels de medicaments",
    importance: AndroidImportance.HIGH,
    sound: "default",
  });
}

// Calcule le prochain declenchement (aujourd'hui si l'heure n'est
// pas encore passee, sinon demain), pour un rappel qui se repete
// ensuite tous les jours a la meme heure.
function prochainDeclenchement(heureStr) {
  const [h, m] = heureStr.split(":").map(n => parseInt(n, 10) || 0);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  return date.getTime();
}

async function programmerRappel(id, titre, heureStr) {
  const notifee = getNotifee();
  const { TriggerType, RepeatFrequency } = getNotifeeConstants();
  await notifee.createTriggerNotification(
    {
      id, // meme id que le document Firestore : permet d'annuler/remplacer facilement
      title: "Rappel medicament",
      body: titre,
      android: {
        channelId: CANAL_RAPPELS,
        pressAction: { id: "default" },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: prochainDeclenchement(heureStr),
      repeatFrequency: RepeatFrequency.DAILY,
    }
  );
}

async function annulerRappel(id) {
  const notifee = getNotifee();
  await notifee.cancelTriggerNotification(id).catch(() => {});
}

export default function RemindersScreen({ navigation }) {
  const { theme } = useStore();
  const isLight = theme === "light";
  const bg    = isLight ? "#f4f7fb" : "#0d1829";
  const card  = isLight ? "#ffffff" : "#111f35";
  const text  = isLight ? "#16242f" : "#e8f4ff";
  const text2 = isLight ? "#50657a" : "#8ba8c4";
  const border= isLight ? "#eef2f7" : "#1e3050";

  const [rappels, setRappels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [titre, setTitre]     = useState("");
  const [heure, setHeure]     = useState("08:00");
  const [actif, setActif]     = useState(true);

  useEffect(() => {
    assurerPermissionsEtCanal();
  }, []);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const unsub = firestore()
      .collection("patients").doc(uid)
      .collection("rappels")
      .orderBy("heure")
      .onSnapshot(snap => {
        if (!snap) return;
        setRappels(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      }, err => console.log("Rappels:", err.message));
    return unsub;
  }, []);

  const ajouter = async () => {
    if (!titre.trim()) { Alert.alert("Titre requis"); return; }
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const docRef = await firestore().collection("patients").doc(uid)
      .collection("rappels").add({
        titre: titre.trim(), heure, actif,
        createdAt: firestore.FieldValue.serverTimestamp()
      });
    if (actif) {
      await programmerRappel(docRef.id, titre.trim(), heure);
    }
    setTitre(""); setHeure("08:00"); setActif(true); setShowForm(false);
  };

  const supprimer = (id) => {
    Alert.alert("Supprimer", "Supprimer ce rappel ?", [
      { text:"Annuler", style:"cancel" },
      { text:"Supprimer", style:"destructive", onPress: async () => {
        const uid = auth().currentUser?.uid;
        if (uid) await firestore().collection("patients").doc(uid)
          .collection("rappels").doc(id).delete();
        await annulerRappel(id);
      }}
    ]);
  };

  const toggleActif = async (id, val, r) => {
    const uid = auth().currentUser?.uid;
    if (uid) await firestore().collection("patients").doc(uid)
      .collection("rappels").doc(id).update({ actif: val });
    if (val) {
      await programmerRappel(id, r.titre, r.heure);
    } else {
      await annulerRappel(id);
    }
  };

  return (
    <View style={{ flex:1, backgroundColor:bg }}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg} />

      <View style={{ flexDirection:"row", alignItems:"center",
        paddingHorizontal:16, paddingTop:48, paddingBottom:16,
        backgroundColor:card, borderBottomWidth:1, borderBottomColor:border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight:12 }}>
          <Text style={{ fontSize:16, color:"#00c896", fontWeight:"700" }}>← Retour</Text>
        </TouchableOpacity>
        <Text style={{ fontSize:20, fontWeight:"900", color:text, flex:1 }}>
          Mes Rappels
        </Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)}
          style={{ backgroundColor:"#00c896", borderRadius:20,
            paddingHorizontal:14, paddingVertical:6 }}>
          <Text style={{ color:"white", fontWeight:"700" }}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>

        {showForm && (
          <View style={{ backgroundColor:card, borderRadius:16, padding:16,
            borderWidth:1, borderColor:"#00c896"+"60" }}>
            <Text style={{ fontSize:16, fontWeight:"800", color:text, marginBottom:12 }}>
              Nouveau rappel
            </Text>
            <Text style={{ fontSize:12, fontWeight:"600", color:text2, marginBottom:6 }}>
              TITRE
            </Text>
            <TextInput
              style={{ backgroundColor:bg, borderRadius:10, padding:12,
                fontSize:14, color:text, borderWidth:1, borderColor:border,
                marginBottom:12 }}
              value={titre} onChangeText={setTitre}
              placeholder="Ex: Prendre medicament"
              placeholderTextColor={text2}
            />
            <Text style={{ fontSize:12, fontWeight:"600", color:text2, marginBottom:6 }}>
              HEURE (HH:MM)
            </Text>
            <TextInput
              style={{ backgroundColor:bg, borderRadius:10, padding:12,
                fontSize:14, color:text, borderWidth:1, borderColor:border,
                marginBottom:12 }}
              value={heure} onChangeText={setHeure}
              placeholder="08:00" placeholderTextColor={text2}
              keyboardType="numbers-and-punctuation"
            />
            <View style={{ flexDirection:"row", alignItems:"center",
              justifyContent:"space-between", marginBottom:16 }}>
              <Text style={{ fontSize:14, color:text }}>Activer le rappel</Text>
              <Switch value={actif} onValueChange={setActif}
                trackColor={{ false:border, true:"#00c896" }} thumbColor="white" />
            </View>
            <TouchableOpacity onPress={ajouter}
              style={{ backgroundColor:"#00c896", borderRadius:10,
                padding:12, alignItems:"center" }}>
              <Text style={{ color:"white", fontWeight:"900" }}>ENREGISTRER</Text>
            </TouchableOpacity>
          </View>
        )}

        {rappels.length === 0 && !showForm && (
          <View style={{ alignItems:"center", paddingTop:60 }}>
            <Text style={{ fontSize:40, marginBottom:16 }}>⏰</Text>
            <Text style={{ fontSize:16, fontWeight:"700", color:text }}>
              Aucun rappel
            </Text>
            <Text style={{ fontSize:13, color:text2, marginTop:8, textAlign:"center" }}>
              Ajoutez des rappels pour vos medicaments
            </Text>
          </View>
        )}

        {rappels.map(r => (
          <View key={r.id} style={{ backgroundColor:card, borderRadius:14,
            padding:14, borderWidth:1,
            borderColor:r.actif?"#00c896"+"40":border,
            flexDirection:"row", alignItems:"center", gap:12 }}>
            <View style={{ width:48, height:48, borderRadius:24,
              backgroundColor:r.actif?"#00c89620":"#88888820",
              alignItems:"center", justifyContent:"center" }}>
              <Text style={{ fontSize:16, fontWeight:"900",
                color:r.actif?"#00c896":text2 }}>{r.heure}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:14, fontWeight:"700", color:text }}>
                {r.titre}
              </Text>
              <Text style={{ fontSize:12, color:text2, marginTop:2 }}>
                {r.actif ? "Actif" : "Desactive"}
              </Text>
            </View>
            <Switch value={r.actif}
              onValueChange={(v) => toggleActif(r.id, v, r)}
              trackColor={{ false:border, true:"#00c896" }}
              thumbColor="white" />
            <TouchableOpacity onPress={() => supprimer(r.id)}>
              <Text style={{ color:"#ff5252", fontSize:18 }}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}