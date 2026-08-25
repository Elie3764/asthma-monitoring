import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert
} from "react-native";
import { useStore } from "../store/useStore";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

export default function ChatScreen({ navigation }) {
  const { theme, userProfile, user } = useStore();
  const isLight = theme === "light";
  const bg    = isLight ? "#f4f7fb" : "#0d1829";
  const card  = isLight ? "#ffffff" : "#111f35";
  const text  = isLight ? "#16242f" : "#e8f4ff";
  const text2 = isLight ? "#50657a" : "#8ba8c4";
  const border= isLight ? "#eef2f7" : "#1e3050";

  const [mode, setMode] = useState("medecin"); // "medecin" | "forum"

  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const scrollRef = useRef(null);

  // ===== FORUM STATE =====
  const [posts, setPosts]               = useState([]);
  const [newPost, setNewPost]           = useState("");
  const [postCategory, setPostCategory] = useState("General");
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [forumLoading, setForumLoading] = useState(false);
  const categories = ["Tous","Pollution","Astuces Inhalateur","Alimentation","Sport","General"];
  const postCategories = ["General","Pollution","Astuces Inhalateur","Alimentation","Sport"];
  const forumColors = ["#00c896","#7c3aed","#d96a1f","#b88a00","#d6304a"];

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

  useEffect(() => {
    const unsub = firestore()
      .collection("forum")
      .orderBy("createdAt", "desc")
      .limit(50)
      .onSnapshot(snap => {
        const p = [];
        snap.forEach(d => p.push({ id: d.id, ...d.data() }));
        setPosts(p);
      }, () => {});
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

  const sendPost = async () => {
    if (!newPost.trim() || !user?.uid) return;
    setForumLoading(true);
    try {
      await firestore().collection("forum").add({
        text: newPost.trim(),
        from: user.uid,
        fromName: userProfile?.name || "Patient",
        category: postCategory,
        likes: 0,
        comments: 0,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      setNewPost("");
    } catch {
      Alert.alert("Erreur", "Impossible de publier");
    } finally {
      setForumLoading(false);
    }
  };

  const likePost = async (id, likes) => {
    await firestore().collection("forum").doc(id).update({ likes: (likes||0)+1 }).catch(() => {});
  };

  const initials = (name) => name ? name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) : "?";
  const filteredPosts = activeCategory === "Tous" ? posts : posts.filter(p => p.category === activeCategory);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg} />

      {/* HEADER */}
      <View style={{ paddingHorizontal:16, paddingTop:48, paddingBottom:12,
        backgroundColor:card, borderBottomWidth:1, borderBottomColor:border }}>
        <Text style={{ fontSize:20, fontWeight:"900", color:text }}>
          {mode === "medecin" ? "Mon Medecin" : "Forum Communautaire"}
        </Text>
        <Text style={{ fontSize:13, color:text2, marginTop:2 }}>
          {mode === "medecin"
            ? (userProfile?.doctorEmail || "Messagerie medecin")
            : "Echangez avec d'autres patients et proches"}
        </Text>

        {/* SELECTEUR MEDECIN / FORUM */}
        <View style={{ flexDirection:"row", backgroundColor:bg, borderRadius:12,
          padding:4, marginTop:14, borderWidth:1, borderColor:border }}>
          <TouchableOpacity onPress={() => setMode("medecin")}
            style={{ flex:1, paddingVertical:9, borderRadius:9, alignItems:"center",
              backgroundColor: mode==="medecin" ? "#00c896" : "transparent" }}>
            <Text style={{ fontSize:13, fontWeight:"700",
              color: mode==="medecin" ? "white" : text2 }}>Mon Medecin</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode("forum")}
            style={{ flex:1, paddingVertical:9, borderRadius:9, alignItems:"center",
              backgroundColor: mode==="forum" ? "#00c896" : "transparent" }}>
            <Text style={{ fontSize:13, fontWeight:"700",
              color: mode==="forum" ? "white" : text2 }}>Forum</Text>
          </TouchableOpacity>
        </View>
      </View>

      {mode === "medecin" ? (
        <>
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
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:40 }}
          showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor:card, borderRadius:16, padding:14,
            marginBottom:14, borderWidth:1, borderColor:border }}>
            <TextInput
              style={{ backgroundColor:bg, borderRadius:12, padding:12,
                fontSize:14, color:text, borderWidth:1.5, borderColor:border,
                minHeight:60 }}
              value={newPost}
              onChangeText={setNewPost}
              placeholder="Partagez votre experience..."
              placeholderTextColor={text2}
              multiline
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop:10 }}>
              <View style={{ flexDirection:"row", gap:8 }}>
                {postCategories.map(c => (
                  <TouchableOpacity key={c} onPress={() => setPostCategory(c)}
                    style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:12,
                      backgroundColor: postCategory===c ? "#00c896" : bg,
                      borderWidth:1, borderColor: postCategory===c ? "#00c896" : border }}>
                    <Text style={{ fontSize:11, fontWeight:"700",
                      color: postCategory===c ? "white" : text2 }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={sendPost} disabled={forumLoading}
              style={{ marginTop:10, backgroundColor:"#00c896", borderRadius:12,
                padding:10, alignItems:"center" }}>
              {forumLoading
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={{ color:"white", fontWeight:"700" }}>Publier</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
            <View style={{ flexDirection:"row", gap:8 }}>
              {categories.map(c => (
                <TouchableOpacity key={c} onPress={() => setActiveCategory(c)}
                  style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:20,
                    backgroundColor: activeCategory===c ? "#00c896" : card,
                    borderWidth:1, borderColor: activeCategory===c ? "#00c896" : border }}>
                  <Text style={{ fontSize:12, fontWeight:"700",
                    color: activeCategory===c ? "white" : text2 }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {filteredPosts.length === 0 && (
            <View style={{ alignItems:"center", paddingTop:20 }}>
              <Text style={{ color:text2 }}>Aucune publication</Text>
            </View>
          )}

          {filteredPosts.map((p, i) => (
            <View key={p.id} style={{ backgroundColor:card, borderRadius:16,
              padding:14, marginBottom:10, borderWidth:1, borderColor:border }}>
              <View style={{ flexDirection:"row", alignItems:"center", gap:10, marginBottom:10 }}>
                <View style={{ width:36, height:36, borderRadius:18,
                  backgroundColor: forumColors[i % forumColors.length]+"20",
                  alignItems:"center", justifyContent:"center" }}>
                  <Text style={{ fontSize:13, fontWeight:"900",
                    color: forumColors[i % forumColors.length] }}>{initials(p.fromName||"U")}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:13, fontWeight:"700", color:text }}>{p.fromName || "Patient"}</Text>
                  <Text style={{ fontSize:11, color:text2 }}>
                    {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString("fr-FR") : "Maintenant"}
                  </Text>
                </View>
                {p.category && (
                  <View style={{ paddingHorizontal:8, paddingVertical:3, borderRadius:12,
                    backgroundColor:"#00c89615" }}>
                    <Text style={{ fontSize:10, fontWeight:"700", color:"#00c896" }}>{p.category}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize:14, lineHeight:22, color:text, marginBottom:12 }}>{p.text}</Text>
              <View style={{ flexDirection:"row", gap:16, borderTopWidth:1,
                borderTopColor:border, paddingTop:10 }}>
                <TouchableOpacity onPress={() => likePost(p.id, p.likes)}
                  style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                  <Text style={{ fontSize:16, color:"#d6304a" }}>♥</Text>
                  <Text style={{ fontSize:12, color:text2 }}>{p.likes || 0}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
