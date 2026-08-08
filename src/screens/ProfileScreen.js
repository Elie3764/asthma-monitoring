import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StatusBar, Alert, Switch, TextInput, Modal
} from "react-native";
import { useStore } from "../store/useStore";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

export default function ProfileScreen({ navigation }) {
  const { theme, setTheme, userProfile, setUserProfile,
          connectedDevice, notificationsEnabled, setNotificationsEnabled,
          smsAlertsEnabled, setSmsAlertsEnabled } = useStore();

  const isLight = theme === "light";
  const bg    = isLight ? "#f4f7fb" : "#0d1829";
  const card  = isLight ? "#ffffff" : "#111f35";
  const text  = isLight ? "#16242f" : "#e8f4ff";
  const text2 = isLight ? "#50657a" : "#8ba8c4";
  const border= isLight ? "#eef2f7" : "#1e3050";

  // Etats modification
  const [editModal, setEditModal]   = useState(false);
  const [editField, setEditField]   = useState("");
  const [editLabel, setEditLabel]   = useState("");
  const [editValue, setEditValue]   = useState("");
  const [saving, setSaving]         = useState(false);

  const ouvrirEdit = (field, label, value) => {
    setEditField(field);
    setEditLabel(label);
    setEditValue(value || "");
    setEditModal(true);
  };

  const sauvegarder = async () => {
    if (!editValue.trim()) { Alert.alert("Champ vide"); return; }
    setSaving(true);
    try {
      const uid = auth().currentUser?.uid;
      await firestore().collection("patients").doc(uid)
        .update({ [editField]: editValue.trim() });
      setUserProfile({ ...userProfile, [editField]: editValue.trim() });
      setEditModal(false);
      Alert.alert("Modifie!", editLabel + " mis a jour.");
    } catch (e) {
      Alert.alert("Erreur", e.message);
    } finally {
      setSaving(false);
    }
  };

  const doLogout = () => {
    Alert.alert("Deconnexion", "Voulez-vous vous deconnecter ?", [
      { text:"Annuler", style:"cancel" },
      { text:"Deconnecter", style:"destructive",
        onPress: () => auth().signOut() }
    ]);
  };

  const changer_mdp = () => {
    Alert.alert(
      "Mot de passe",
      "Un email de reinitialisation sera envoye a " + userProfile?.email,
      [
        { text:"Annuler", style:"cancel" },
        { text:"Envoyer", onPress: async () => {
          await auth().sendPasswordResetEmail(userProfile?.email || "");
          Alert.alert("Email envoye!", "Verifiez votre boite mail.");
        }}
      ]
    );
  };

  // Ligne modifiable
  const LigneEdit = ({ label, field, value, keyboard="default" }) => (
    <TouchableOpacity
      onPress={() => ouvrirEdit(field, label, value)}
      style={{ flexDirection:"row", alignItems:"center", padding:14,
        borderBottomWidth:1, borderBottomColor:border }}>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:12, color:text2, marginBottom:2 }}>{label}</Text>
        <Text style={{ fontSize:14, fontWeight:"600", color:text }}>
          {value || "Non renseigne"}
        </Text>
      </View>
      <Text style={{ color:"#00c896", fontSize:14, fontWeight:"700" }}>Modifier</Text>
    </TouchableOpacity>
  );

  // Ligne simple (non modifiable)
  const Ligne = ({ label, value }) => (
    <View style={{ flexDirection:"row", alignItems:"center", padding:14,
      borderBottomWidth:1, borderBottomColor:border }}>
      <Text style={{ flex:1, fontSize:14, color:text2 }}>{label}</Text>
      <Text style={{ fontSize:14, fontWeight:"600", color:text }}>{value || "--"}</Text>
    </View>
  );

  // Ligne switch
  const LigneSwitch = ({ label, desc, value, onChange }) => (
    <View style={{ flexDirection:"row", alignItems:"center", padding:14,
      borderBottomWidth:1, borderBottomColor:border }}>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:14, color:text }}>{label}</Text>
        {desc && <Text style={{ fontSize:11, color:text2, marginTop:2 }}>{desc}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange}
        trackColor={{ false:border, true:"#00c896" }} thumbColor="white" />
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:bg }}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg} />

      {/* HEADER */}
      <View style={{ paddingHorizontal:16, paddingTop:48, paddingBottom:16,
        backgroundColor:card, borderBottomWidth:1, borderBottomColor:border }}>
        <Text style={{ fontSize:24, fontWeight:"900", color:text }}>Reglages</Text>
        <Text style={{ fontSize:12, color:"#00c896", fontStyle:"italic", marginTop:2 }}>
          Surveillez. Alertez. Agissez.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom:40 }}>

        {/* AVATAR */}
        <View style={{ alignItems:"center", paddingVertical:24 }}>
          <View style={{ width:80, height:80, borderRadius:40,
            backgroundColor:"#00c896", alignItems:"center",
            justifyContent:"center", marginBottom:12, elevation:4 }}>
            <Text style={{ fontSize:32, color:"white", fontWeight:"900" }}>
              {userProfile?.name?.[0]?.toUpperCase() || "P"}
            </Text>
          </View>
          <Text style={{ fontSize:18, fontWeight:"900", color:text }}>
            {userProfile?.name || "Patient"}
          </Text>
          <Text style={{ fontSize:13, color:text2, marginTop:4 }}>
            {userProfile?.role==="parent" ? "Parent / Proche" : "Patient Asthmatique"}
          </Text>
        </View>

        {/* === INFORMATIONS PERSONNELLES === */}
        <Text style={{ fontSize:12, fontWeight:"700", color:text2,
          paddingHorizontal:16, paddingBottom:8, textTransform:"uppercase",
          letterSpacing:0.5 }}>Informations personnelles</Text>
        <View style={{ backgroundColor:card, marginHorizontal:16,
          borderRadius:16, borderWidth:1, borderColor:border,
          overflow:"hidden", marginBottom:16 }}>
          <LigneEdit label="Nom complet"  field="name"  value={userProfile?.name} />
          <LigneEdit label="Age"          field="age"   value={userProfile?.age} keyboard="numeric" />
          <LigneEdit label="Ville"        field="ville" value={userProfile?.ville} />
          <LigneEdit label="Telephone urgence" field="phone" value={userProfile?.phone} keyboard="phone-pad" />
          <LigneEdit label="Email medecin" field="doctorEmail" value={userProfile?.doctorEmail} keyboard="email-address" />
          <Ligne label="Email"  value={userProfile?.email} />
          <Ligne label="Role"   value={userProfile?.role==="parent"?"Parent/Proche":"Patient"} />
        </View>

        {/* === MONTRE === */}
        <Text style={{ fontSize:12, fontWeight:"700", color:text2,
          paddingHorizontal:16, paddingBottom:8, textTransform:"uppercase",
          letterSpacing:0.5 }}>Montre connectee</Text>
        <View style={{ backgroundColor:card, marginHorizontal:16,
          borderRadius:16, borderWidth:1, borderColor:border,
          overflow:"hidden", marginBottom:16 }}>
          <Ligne label="Statut" value={connectedDevice?"Associee":"Non associee"} />
          <Ligne label="Appareil" value={connectedDevice?.name || "--"} />
          <TouchableOpacity
            onPress={() => navigation.navigate("Watch")}
            style={{ flexDirection:"row", alignItems:"center", padding:14 }}>
            <Text style={{ flex:1, fontSize:14, color:text }}>
              Gerer la montre
            </Text>
            <Text style={{ color:"#00c896", fontSize:16 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* === AFFICHAGE === */}
        <Text style={{ fontSize:12, fontWeight:"700", color:text2,
          paddingHorizontal:16, paddingBottom:8, textTransform:"uppercase",
          letterSpacing:0.5 }}>Affichage</Text>
        <View style={{ backgroundColor:card, marginHorizontal:16,
          borderRadius:16, borderWidth:1, borderColor:border,
          overflow:"hidden", marginBottom:16 }}>
          <LigneSwitch
            label="Mode sombre"
            desc="Interface sombre pour economiser la batterie"
            value={!isLight}
            onChange={v => setTheme(v?"dark":"light")}
          />
        </View>

        {/* === ALERTES === */}
        <Text style={{ fontSize:12, fontWeight:"700", color:text2,
          paddingHorizontal:16, paddingBottom:8, textTransform:"uppercase",
          letterSpacing:0.5 }}>Alertes et notifications</Text>
        <View style={{ backgroundColor:card, marginHorizontal:16,
          borderRadius:16, borderWidth:1, borderColor:border,
          overflow:"hidden", marginBottom:16 }}>
          <LigneSwitch
            label="Notifications"
            desc="Recevoir les alertes sur le telephone"
            value={notificationsEnabled}
            onChange={setNotificationsEnabled}
          />
          <LigneSwitch
            label="Alertes SMS"
            desc="SMS automatique au contact d'urgence"
            value={smsAlertsEnabled}
            onChange={setSmsAlertsEnabled}
          />
        </View>

        {/* === COMPTE === */}
        <Text style={{ fontSize:12, fontWeight:"700", color:text2,
          paddingHorizontal:16, paddingBottom:8, textTransform:"uppercase",
          letterSpacing:0.5 }}>Compte</Text>
        <View style={{ backgroundColor:card, marginHorizontal:16,
          borderRadius:16, borderWidth:1, borderColor:border,
          overflow:"hidden", marginBottom:16 }}>
          <TouchableOpacity onPress={changer_mdp}
            style={{ flexDirection:"row", alignItems:"center", padding:14,
              borderBottomWidth:1, borderBottomColor:border }}>
            <Text style={{ flex:1, fontSize:14, color:text }}>
              Changer le mot de passe
            </Text>
            <Text style={{ color:"#00c896", fontSize:16 }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Reminders")}
            style={{ flexDirection:"row", alignItems:"center", padding:14 }}>
            <Text style={{ flex:1, fontSize:14, color:text }}>Mes rappels</Text>
            <Text style={{ color:"#00c896", fontSize:16 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* DECONNEXION */}
        <TouchableOpacity onPress={doLogout}
          style={{ backgroundColor:"#fde8ec", marginHorizontal:16,
            borderRadius:16, padding:16, alignItems:"center",
            borderWidth:1, borderColor:"#d6304a"+"30", marginBottom:8 }}>
          <Text style={{ color:"#d6304a", fontWeight:"900", fontSize:15 }}>
            Se deconnecter
          </Text>
        </TouchableOpacity>

        <Text style={{ textAlign:"center", color:text2, fontSize:11,
          marginTop:8, marginBottom:16 }}>
          Asthma Monitoring v3.1 · SUPPTIC ENSP 2026
        </Text>
      </ScrollView>

      {/* MODAL MODIFICATION */}
      <Modal visible={editModal} transparent animationType="slide"
        onRequestClose={() => setEditModal(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)",
          justifyContent:"flex-end" }}>
          <View style={{ backgroundColor:card, borderTopLeftRadius:20,
            borderTopRightRadius:20, padding:20, paddingBottom:40 }}>
            <Text style={{ fontSize:18, fontWeight:"900", color:text,
              marginBottom:16 }}>
              Modifier {editLabel}
            </Text>
            <TextInput
              style={{ backgroundColor:bg, borderRadius:12, padding:14,
                fontSize:16, color:text, borderWidth:1.5,
                borderColor:"#00c896", marginBottom:20 }}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={editLabel}
              placeholderTextColor={text2}
              autoFocus
            />
            <View style={{ flexDirection:"row", gap:12 }}>
              <TouchableOpacity
                onPress={() => setEditModal(false)}
                style={{ flex:1, borderWidth:1, borderColor:border,
                  borderRadius:12, padding:14, alignItems:"center" }}>
                <Text style={{ color:text2, fontWeight:"700" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={sauvegarder}
                disabled={saving}
                style={{ flex:1, backgroundColor:"#00c896",
                  borderRadius:12, padding:14, alignItems:"center" }}>
                <Text style={{ color:"white", fontWeight:"900" }}>
                  {saving ? "Sauvegarde..." : "Enregistrer"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
