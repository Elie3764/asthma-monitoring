import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator
} from "react-native";
import { useStore } from "../store/useStore";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

export default function ChatScreen({ navigation }) {
  const { theme, userProfile } = useStore();
  const isLight = theme === "light";
  const bg    = isLight ? "#f4f7fb" : "#0d1829";
  const card  = isLight ? "#ffffff" : "#111f35";
  const text  = isLight ? "#16242f" : "#e8f4ff";
  const text2 = isLight ? "#50657a" : "#8ba8c4";
  const border= isLight ? "#eef2f7" : "#1e3050";

  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const unsub = firestore()
      .collection("messages")
      .where("patientId", "==", uid)
      .orderBy("createdAt", "asc")
      .limit(50)
      .onSnapshot(snap => {
        if (!snap) return;
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMessages(msgs);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }, err => {
        console.log("Chat erreur:", err.message);
      });
    return unsub;
  }, []);

  const envoyer = async () => {
    const txt = input.trim();
    if (!txt) return;
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    setInput("");
    setLoading(true);
    try {
      await firestore().collection("messages").add({
        text:      txt,
        patientId: uid,
        senderName:userProfile?.name || "Patient",
        role:      "patient",
        createdAt: firestore.FieldValue.serverTimestamp(),
        lu:        false,
      });
    } catch (e) {
      console.log("Envoi erreur:", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg} />

      {/* HEADER */}
      <View style={{ paddingHorizontal:16, paddingTop:48, paddingBottom:16,
        backgroundColor:card, borderBottomWidth:1, borderBottomColor:border }}>
        <Text style={{ fontSize:20, fontWeight:"900", color:text }}>
          Mon Medecin
        </Text>
        <Text style={{ fontSize:13, color:text2, marginTop:2 }}>
          {userProfile?.doctorEmail || "Messagerie medecin"}
        </Text>
      </View>

      {/* MESSAGES */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding:16, gap:10, paddingBottom:20 }}
        showsVerticalScrollIndicator={false}>

        {messages.length === 0 && (
          <View style={{ alignItems:"center", paddingTop:60 }}>
            <Text style={{ fontSize:40, marginBottom:16 }}>💬</Text>
            <Text style={{ fontSize:16, fontWeight:"700", color:text, textAlign:"center" }}>
              Pas encore de messages
            </Text>
            <Text style={{ fontSize:13, color:text2, textAlign:"center", marginTop:8 }}>
              Envoyez un message a votre medecin
            </Text>
          </View>
        )}

        {messages.map(msg => {
          const moi = msg.role === "patient";
          return (
            <View key={msg.id}
              style={{ alignSelf:moi?"flex-end":"flex-start",
                maxWidth:"80%", gap:4 }}>
              {!moi && (
                <Text style={{ fontSize:11, color:text2, marginLeft:4 }}>
                  {msg.senderName || "Medecin"}
                </Text>
              )}
              <View style={{
                backgroundColor: moi ? "#00c896" : card,
                borderRadius:16,
                borderBottomRightRadius: moi ? 4 : 16,
                borderBottomLeftRadius:  moi ? 16 : 4,
                padding:12,
                borderWidth: moi ? 0 : 1,
                borderColor: border,
              }}>
                <Text style={{
                  fontSize:14, lineHeight:20,
                  color: moi ? "white" : text
                }}>
                  {msg.text}
                </Text>
              </View>
              <Text style={{ fontSize:10, color:text2,
                alignSelf:moi?"flex-end":"flex-start", marginHorizontal:4 }}>
                {msg.createdAt?.toDate?.()?.toLocaleTimeString("fr-FR",
                  { hour:"2-digit", minute:"2-digit" }) || ""}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* INPUT */}
      <View style={{ flexDirection:"row", padding:12, gap:10,
        backgroundColor:card, borderTopWidth:1, borderTopColor:border,
        alignItems:"flex-end" }}>
        <TextInput
          style={{ flex:1, backgroundColor:bg, borderRadius:20,
            paddingHorizontal:16, paddingVertical:10, fontSize:14,
            color:text, borderWidth:1, borderColor:border,
            maxHeight:100 }}
          value={input}
          onChangeText={setInput}
          placeholder="Votre message..."
          placeholderTextColor={text2}
          multiline
        />
        <TouchableOpacity
          onPress={envoyer}
          disabled={!input.trim() || loading}
          style={{ width:44, height:44, borderRadius:22,
            backgroundColor:input.trim()?"#00c896":"#888",
            alignItems:"center", justifyContent:"center" }}>
          {loading
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={{ color:"white", fontSize:18, fontWeight:"900" }}>→</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
