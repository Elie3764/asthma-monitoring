import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, StatusBar, ScrollView
} from "react-native";
import { useStore } from "../store/useStore";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { BleManager } from "react-native-ble-plx";
import { Buffer } from "buffer";

const BLE_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c3319142";
const BLE_CHAR_PAIR    = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const BLE_CHAR_UID     = "beb5483e-36e1-4688-b7f5-ea07361b26a9";

const manager = new BleManager();

export default function WatchPairingScreen({ navigation }) {
  const { theme, setConnectedDevice, setConnectionType,
          userProfile, setUserProfile } = useStore();

  const isLight = theme === "light";
  const bg    = isLight ? "#f4f7fb" : "#0d1829";
  const card  = isLight ? "#ffffff" : "#111f35";
  const text  = isLight ? "#16242f" : "#e8f4ff";
  const text2 = isLight ? "#50657a" : "#8ba8c4";
  const border= isLight ? "#eef2f7" : "#1e3050";

  const [step, setStep]     = useState("code");
  const [code, setCode]     = useState("");
  const [phone, setPhone]   = useState(userProfile?.phone || "");
  const [pairing, setPairing] = useState(false);
  const [status, setStatus]   = useState("");
  const deviceRef = useRef(null);

  useEffect(() => {
    return () => {
      manager.stopDeviceScan();
      if (deviceRef.current) deviceRef.current.cancelConnection().catch(()=>{});
    };
  }, []);

  // ============================================================
  // ASSOCIATION COMPLETE : Scan BLE → Connexion → Envoi UID
  // ============================================================
  const associer = async () => {
    const uid = auth().currentUser?.uid || "";
    const tel = phone.trim();

    if (!uid) { Alert.alert("Erreur","Vous n'etes pas connecte."); return; }
    if (code.length !== 6) { Alert.alert("Erreur","Code 6 chiffres requis."); return; }

    setPairing(true);

    try {
      // ETAPE 1 : Scanner la montre
      setStatus("Recherche de la montre...");
      let foundDevice = null;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          manager.stopDeviceScan();
          reject(new Error("Montre non trouvee. Assurez-vous qu'elle est allumee et proche."));
        }, 12000);

        manager.startDeviceScan(null, { allowDuplicates: false }, (err, dev) => {
          if (err) { clearTimeout(timeout); manager.stopDeviceScan(); reject(err); return; }
          if (dev?.name?.startsWith("AsthmaWatch")) {
            clearTimeout(timeout);
            manager.stopDeviceScan();
            foundDevice = dev;
            resolve();
          }
        });
      });

      // ETAPE 2 : Connexion BLE
      setStatus("Connexion a " + foundDevice.name + "...");
      const device = await manager.connectToDevice(foundDevice.id);
      deviceRef.current = device;
      await device.discoverAllServicesAndCharacteristics();

      // ETAPE 3 : Lire et verifier le code
      setStatus("Verification du code...");
      const pairChar = await device.readCharacteristicForService(
        BLE_SERVICE_UUID, BLE_CHAR_PAIR
      );
      const raw = Buffer.from(pairChar.value, "base64").toString("utf8");
      // raw = "CODE:123456"
      const watchCode = raw.replace("CODE:", "").trim();

      if (watchCode !== code.trim()) {
        await device.cancelConnection();
        Alert.alert(
          "Code incorrect",
          "Code entré: " + code + "\nCode montre: " + watchCode +
          "\n\nVerifiez le code sur l'ecran de la montre."
        );
        setPairing(false);
        setStatus("");
        return;
      }

      // ETAPE 4 : Envoyer UID + telephone a la montre
      setStatus("Envoi des donnees a la montre...");
      const payload = "UID:" + uid + "|PHONE:" + tel;
      const b64 = Buffer.from(payload).toString("base64");
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID, BLE_CHAR_UID, b64
      );

      // ETAPE 5 : Sauvegarder dans Firebase
      setStatus("Sauvegarde...");
      if (tel && tel !== userProfile?.phone) {
        await firestore().collection("patients").doc(uid).update({ phone: tel });
        setUserProfile({ ...userProfile, phone: tel });
      }
      await firestore().collection("patients").doc(uid).update({
        watchId:        foundDevice.id,
        watchName:      foundDevice.name,
        watchPairedAt:  firestore.FieldValue.serverTimestamp(),
        watchConnected: true,
      });

      setConnectedDevice({ id: foundDevice.id, name: foundDevice.name });
      setConnectionType("BLE");
      setStatus("Association reussie!");
      setStep("success");

    } catch (e) {
      Alert.alert("Erreur", e.message);
      setStatus("");
    } finally {
      setPairing(false);
    }
  };

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
        <Text style={{ fontSize:18, fontWeight:"900", color:text }}>
          Associer la montre
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding:16, gap:16 }}>

        {/* ETAPE CODE */}
        {step === "code" && (
          <>
            <View style={{ backgroundColor:card, borderRadius:16, padding:16,
              borderWidth:1, borderColor:border }}>
              <Text style={{ fontSize:16, fontWeight:"900", color:text, marginBottom:8 }}>
                Code de la montre
              </Text>
              <Text style={{ fontSize:13, color:text2, marginBottom:16, lineHeight:20 }}>
                Regardez l'ecran de votre montre et entrez le code a 6 chiffres affiche.
              </Text>

              <Text style={{ fontSize:12, fontWeight:"700", color:text2, marginBottom:6 }}>
                CODE 6 CHIFFRES
              </Text>
              <TextInput
                style={{ backgroundColor:bg, borderRadius:12, padding:16,
                  fontSize:36, fontWeight:"900", color:text, borderWidth:2,
                  borderColor:code.length===6?"#00c896":border,
                  textAlign:"center", letterSpacing:10, marginBottom:16 }}
                value={code}
                onChangeText={t => setCode(t.replace(/[^0-9]/g,"").slice(0,6))}
                placeholder="000000"
                placeholderTextColor={text2}
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={{ fontSize:12, fontWeight:"700", color:text2, marginBottom:6 }}>
                VOTRE NUMERO (pour alertes SMS)
              </Text>
              <TextInput
                style={{ backgroundColor:bg, borderRadius:12, padding:14,
                  fontSize:16, color:text, borderWidth:1.5,
                  borderColor:phone.length>7?"#00c896":border, marginBottom:8 }}
                value={phone}
                onChangeText={setPhone}
                placeholder="683271688"
                placeholderTextColor={text2}
                keyboardType="phone-pad"
              />
              <Text style={{ fontSize:11, color:text2, marginBottom:16 }}>
                Ce numero recevra les SMS d'alerte en cas de crise
              </Text>

              {/* STATUT */}
              {status !== "" && (
                <View style={{ backgroundColor:isLight?"#e8faf5":"#0a2a20",
                  borderRadius:10, padding:12, marginBottom:12, alignItems:"center" }}>
                  <Text style={{ fontSize:13, color:"#00c896", fontWeight:"600" }}>
                    {status}
                  </Text>
                </View>
              )}

              {/* BOUTON PRINCIPAL */}
              <TouchableOpacity
                onPress={associer}
                disabled={code.length !== 6 || pairing}
                style={{ backgroundColor:code.length===6?"#00c896":"#888",
                  borderRadius:12, padding:16, alignItems:"center" }}>
                {pairing
                  ? <View style={{ flexDirection:"row", gap:10, alignItems:"center" }}>
                      <ActivityIndicator color="white" size="small" />
                      <Text style={{ color:"white", fontWeight:"700" }}>
                        {status || "Association..."}
                      </Text>
                    </View>
                  : <Text style={{ color:"white", fontWeight:"900", fontSize:15 }}>
                      ASSOCIER LA MONTRE
                    </Text>}
              </TouchableOpacity>
            </View>

            {/* INFO */}
            <View style={{ backgroundColor:isLight?"#e8faf5":"#0a2a20",
              borderRadius:12, padding:14 }}>
              <Text style={{ fontSize:12, fontWeight:"700", color:"#00a878", marginBottom:6 }}>
                COMMENT CA MARCHE
              </Text>
              <Text style={{ fontSize:12, color:"#00a878", lineHeight:20 }}>
                1. Allumez la montre AsthmaWatch{"\n"}
                2. Le code s'affiche sur l'ecran{"\n"}
                3. Entrez le code ci-dessus{"\n"}
                4. Appuyez sur ASSOCIER{"\n"}
                5. L'app cherche la montre via Bluetooth{"\n"}
                6. La montre redémarre et affiche HOME
              </Text>
            </View>
          </>
        )}

        {/* ETAPE SUCCES */}
        {step === "success" && (
          <View style={{ alignItems:"center", gap:20, paddingTop:40 }}>
            <View style={{ width:90, height:90, borderRadius:45,
              backgroundColor:"#00c896", alignItems:"center",
              justifyContent:"center", elevation:8 }}>
              <Text style={{ fontSize:48, color:"white" }}>✓</Text>
            </View>
            <Text style={{ fontSize:26, fontWeight:"900", color:text, textAlign:"center" }}>
              Montre associee!
            </Text>
            <Text style={{ fontSize:14, color:text2, textAlign:"center", lineHeight:22 }}>
              Votre montre va redemarrer et afficher l'ecran principal.
            </Text>
            {phone !== "" && (
              <View style={{ backgroundColor:isLight?"#e8faf5":"#0a2a20",
                borderRadius:12, padding:14, width:"100%" }}>
                <Text style={{ fontSize:12, color:"#00a878", fontWeight:"700" }}>
                  Alertes SMS
                </Text>
                <Text style={{ fontSize:14, color:"#00c896", marginTop:4 }}>
                  {phone}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => navigation.navigate("MainTabs")}
              style={{ backgroundColor:"#00c896", borderRadius:14, padding:16,
                alignItems:"center", width:"100%" }}>
              <Text style={{ color:"white", fontWeight:"900", fontSize:15 }}>
                COMMENCER LA SURVEILLANCE
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
