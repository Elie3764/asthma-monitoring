import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert
} from "react-native";
import { useStore } from "../store/useStore";
import { ANTHROPIC_API_KEY } from "../config/secrets";

export default function AIScreen() {
  const { theme, vitals } = useStore();
  const isLight = theme === "light";
  const bg    = isLight ? "#f4f7fb" : "#0d1829";
  const card  = isLight ? "#ffffff" : "#111f35";
  const text  = isLight ? "#16242f" : "#e8f4ff";
  const text2 = isLight ? "#50657a" : "#8ba8c4";
  const border= isLight ? "#eef2f7" : "#1e3050";

  const [messages, setMessages] = useState([
    { role:"assistant", text:"Bonjour! Je suis votre assistant sante. Comment puis-je vous aider?" }
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);

  const envoyer = async () => {
    const txt = input.trim();
    if (!txt) return;
    setInput("");
    const newMessages = [...messages, { role:"user", text:txt }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const contexte = `Parametres actuels du patient:
SpO2: ${vitals.spo2 || "--"}%
FC: ${vitals.hr || "--"} bpm
Temp: ${vitals.temp || "--"}C
Resp: ${vitals.resp || "--"}/min
Question: ${txt}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 500,
          system: "Tu es un assistant medical specialise en asthme. Reponds en francais de maniere claire et concise. Ne remplace pas un medecin.",
          messages: [{ role:"user", content:contexte }]
        })
      });
      const data = await response.json();

      // DEBUG TEMPORAIRE : affiche la reponse brute si la requete a
      // echoue cote serveur (cle API invalide, modele incorrect,
      // etc.) - a retirer une fois le probleme identifie.
      if (!response.ok) {
        Alert.alert(
          "Debug IA - Erreur " + response.status,
          JSON.stringify(data).slice(0, 500)
        );
      }

      const rep = data.content?.[0]?.text || "Je ne peux pas repondre maintenant.";
      setMessages([...newMessages, { role:"assistant", text:rep }]);
    } catch (e) {
      // DEBUG TEMPORAIRE : affiche l'erreur exacte (reseau, cle API
      // manquante, etc.) au lieu de la cacher derriere un message
      // generique - a retirer une fois le probleme identifie.
      Alert.alert("Debug IA - Exception", e.message || String(e));
      setMessages([...newMessages, {
        role:"assistant",
        text:"Desolee, je ne peux pas repondre maintenant. Verifiez votre connexion."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Qu'est-ce que l'asthme?",
    "Mes valeurs sont-elles normales?",
    "Que faire en cas de crise?",
    "Comment utiliser un bronchodilatateur?",
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex:1, backgroundColor:bg }}
      behavior={Platform.OS==="ios"?"padding":"height"}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg} />

      <View style={{ paddingHorizontal:16, paddingTop:48, paddingBottom:16,
        backgroundColor:card, borderBottomWidth:1, borderBottomColor:border }}>
        <Text style={{ fontSize:20, fontWeight:"900", color:text }}>
          Assistant IA
        </Text>
        <Text style={{ fontSize:13, color:text2, marginTop:2 }}>
          Conseils sante personnalises
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding:16, gap:10, paddingBottom:20 }}>
        {messages.map((msg, i) => (
          <View key={i} style={{
            alignSelf:msg.role==="user"?"flex-end":"flex-start",
            maxWidth:"85%" }}>
            <View style={{
              backgroundColor:msg.role==="user"?"#00c896":card,
              borderRadius:16,
              borderBottomRightRadius:msg.role==="user"?4:16,
              borderBottomLeftRadius: msg.role==="user"?16:4,
              padding:12,
              borderWidth:msg.role==="user"?0:1,
              borderColor:border }}>
              <Text style={{ fontSize:14, lineHeight:20,
                color:msg.role==="user"?"white":text }}>
                {msg.text}
              </Text>
            </View>
          </View>
        ))}

        {loading && (
          <View style={{ alignSelf:"flex-start", padding:12,
            backgroundColor:card, borderRadius:16,
            borderWidth:1, borderColor:border }}>
            <ActivityIndicator color="#00c896" size="small" />
          </View>
        )}

        {messages.length === 1 && (
          <View style={{ gap:8, marginTop:8 }}>
            <Text style={{ fontSize:12, color:text2, fontWeight:"600" }}>
              SUGGESTIONS
            </Text>
            {suggestions.map((s, i) => (
              <TouchableOpacity key={i} onPress={() => setInput(s)}
                style={{ backgroundColor:card, borderRadius:12, padding:12,
                  borderWidth:1, borderColor:border }}>
                <Text style={{ fontSize:13, color:text }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{ flexDirection:"row", padding:12, gap:10,
        backgroundColor:card, borderTopWidth:1, borderTopColor:border,
        alignItems:"flex-end" }}>
        <TextInput
          style={{ flex:1, backgroundColor:bg, borderRadius:20,
            paddingHorizontal:16, paddingVertical:10, fontSize:14,
            color:text, borderWidth:1, borderColor:border, maxHeight:100 }}
          value={input}
          onChangeText={setInput}
          placeholder="Posez votre question..."
          placeholderTextColor={text2}
          multiline
        />
        <TouchableOpacity onPress={envoyer}
          disabled={!input.trim()||loading}
          style={{ width:44, height:44, borderRadius:22,
            backgroundColor:input.trim()?"#00c896":"#888",
            alignItems:"center", justifyContent:"center" }}>
          <Text style={{ color:"white", fontSize:18, fontWeight:"900" }}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}