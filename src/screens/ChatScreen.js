import React,{useState,useEffect,useRef}from"react";
import{View,Text,FlatList,TextInput,TouchableOpacity,KeyboardAvoidingView,Platform,StatusBar,ScrollView,Alert,ActivityIndicator}from"react-native";
import database from"@react-native-firebase/database";
import firestore from"@react-native-firebase/firestore";
import{useStore}from"../store/useStore";
import{playNotificationSound}from"../utils/sounds";
export default function ChatScreen({navigation}){
  const{theme,user,userProfile,messages,setMessages,appendMessage}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const[tab,setTab]=useState("medecin");
  const[selected,setSelected]=useState(null);
  const[selectedType,setSelectedType]=useState("medecin");
  const[input,setInput]=useState("");
  const[doctors,setDoctors]=useState([]);
  const[patients,setPatients]=useState([]);
  const[posts,setPosts]=useState([]);
  const[newPost,setNewPost]=useState("");
  const[postCategory,setPostCategory]=useState("General");
  const[activeCategory,setActiveCategory]=useState("Tous");
  const[loading,setLoading]=useState(false);
  const flatRef=useRef(null);
  const categories=["Tous","Pollution","Astuces Inhalateur","Alimentation","Sport","General"];

  useEffect(()=>{
    firestore().collection("doctors").get().then(snap=>{
      const docs=[];snap.forEach(d=>docs.push({id:d.id,...d.data()}));setDoctors(docs);
    }).catch(()=>{});
    firestore().collection("patients").get().then(snap=>{
      const pts=[];
      snap.forEach(d=>{
        if(d.id!==user?.uid)pts.push({id:d.id,...d.data()});
      });
      setPatients(pts);
    }).catch(()=>{});
    const unsub=firestore().collection("forum").orderBy("createdAt","desc").limit(50).onSnapshot(snap=>{
      const p=[];snap.forEach(d=>p.push({id:d.id,...d.data()}));setPosts(p);
    },()=>{});
    return unsub;
  },[]);

  const getChatId=(otherId,type)=>{
    if(type==="medecin")return user?.uid+"_"+otherId;
    const ids=[user?.uid,otherId].sort();
    return ids[0]+"_"+ids[1];
  };

  useEffect(()=>{
    if(!selected||!user?.uid)return;
    const chatId=getChatId(selected.id,selectedType);
    const ref=database().ref("chats/"+chatId);
    let lastSeenTs=0;
    const unsub=ref.orderByChild("timestamp").limitToLast(50).on("value",snap=>{
      const d=snap.val();
      if(d){
        const list=Object.values(d).sort((a,b)=>a.timestamp-b.timestamp);
        const last=list[list.length-1];
        if(last&&last.from!==user?.uid&&last.timestamp>lastSeenTs&&lastSeenTs!==0){playNotificationSound();}
        if(last)lastSeenTs=last.timestamp;
        setMessages(chatId,list);
      }
      else setMessages(chatId,[]);
    });
    return()=>ref.off("value",unsub);
  },[selected]);

  useEffect(()=>{
    const chatId=selected?getChatId(selected.id,selectedType):"";
    if((messages[chatId]||[]).length>0)setTimeout(()=>flatRef.current?.scrollToEnd({animated:true}),100);
  },[messages]);

  const sendMsg=async()=>{
    if(!input.trim()||!selected||!user?.uid)return;
    const chatId=getChatId(selected.id,selectedType);
    const msg={text:input.trim(),from:user.uid,fromName:userProfile?.name||"Patient",timestamp:database.ServerValue.TIMESTAMP};
    appendMessage(chatId,{...msg,timestamp:Date.now()});
    setInput("");
    await database().ref("chats/"+chatId).push(msg).catch(()=>{});
  };

  const sendPost=async()=>{
    if(!newPost.trim()||!user?.uid)return;
    setLoading(true);
    try{
      await firestore().collection("forum").add({text:newPost.trim(),from:user.uid,fromName:userProfile?.name||"Patient",category:postCategory,likes:0,comments:0,createdAt:firestore.FieldValue.serverTimestamp()});
      setNewPost("");
      Alert.alert("Publie !","Votre message a ete partage.");
    }catch{Alert.alert("Erreur","Impossible de publier");}
    finally{setLoading(false);}
  };

  const likePost=async(id,likes)=>{
    await firestore().collection("forum").doc(id).update({likes:(likes||0)+1}).catch(()=>{});
  };

  const initials=(name)=>name?name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2):"?";
  const chatId=selected?getChatId(selected.id,selectedType):"";
  const msgs=messages[chatId]||[];
  const filteredPosts=activeCategory==="Tous"?posts:posts.filter(p=>p.category===activeCategory);
  const colors=["#00c896","#7c3aed","#d96a1f","#b88a00","#d6304a"];

  if(selected){
    return(
      <KeyboardAvoidingView style={{flex:1,backgroundColor:bg}} behavior={Platform.OS==="ios"?"padding":"height"}>
        <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
        <View style={{flexDirection:"row",alignItems:"center",padding:14,paddingTop:50,borderBottomWidth:1,borderBottomColor:border,backgroundColor:card}}>
          <TouchableOpacity onPress={()=>setSelected(null)} style={{marginRight:12,padding:4}}>
            <Text style={{fontSize:16,color:"#00c896",fontWeight:"700"}}>?</Text>
          </TouchableOpacity>
          <View style={{width:40,height:40,borderRadius:20,backgroundColor:"#00c89620",alignItems:"center",justifyContent:"center",marginRight:10}}>
            <Text style={{fontSize:13,fontWeight:"900",color:"#00c896"}}>{initials(selected.name)}</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={{fontSize:15,fontWeight:"700",color:text}}>{selected.name}</Text>
            <Text style={{fontSize:12,color:selected.online?"#00c896":text2}}>{selected.online?"En ligne":selected.specialty||selected.severity||"Hors ligne"}</Text>
          </View>
          {selected.online&&<View style={{width:8,height:8,borderRadius:4,backgroundColor:"#00c896"}}/>}
        </View>
        <FlatList ref={flatRef} data={msgs} keyExtractor={(_,i)=>i.toString()} style={{flex:1}} contentContainerStyle={{padding:16,gap:8,paddingBottom:20}}
          ListEmptyComponent={<View style={{alignItems:"center",paddingTop:60}}><Text style={{fontSize:14,color:text2}}>Demarrez la conversation</Text></View>}
          renderItem={({item})=>{
            const isMe=item.from===user?.uid;
            return(
              <View style={[{maxWidth:"82%"},isMe&&{alignSelf:"flex-end"}]}>
                {!isMe&&<Text style={{fontSize:11,fontWeight:"700",color:"#00c896",marginBottom:3}}>{item.fromName}</Text>}
                <View style={{borderRadius:16,padding:10,backgroundColor:isMe?"#00c896":"#00c89615",borderBottomRightRadius:isMe?4:16,borderBottomLeftRadius:isMe?16:4}}>
                  <Text style={{fontSize:14,lineHeight:20,color:isMe?"white":text}}>{item.text}</Text>
                  <Text style={{fontSize:10,marginTop:4,textAlign:"right",color:isMe?"rgba(255,255,255,0.7)":text2}}>
                    {item.timestamp?new Date(item.timestamp).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}):"--"}
                  </Text>
                </View>
              </View>
            );
          }}
        />
        <View style={{flexDirection:"row",alignItems:"center",padding:10,borderTopWidth:1,borderTopColor:border,backgroundColor:card,gap:8}}>
          <TextInput style={{flex:1,borderRadius:24,borderWidth:1.5,paddingHorizontal:14,paddingVertical:10,fontSize:14,maxHeight:100,backgroundColor:bg,borderColor:border,color:text}} value={input} onChangeText={setInput} placeholder="Ecrire un message..." placeholderTextColor={text2} multiline/>
          <TouchableOpacity style={{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:input.trim()?"#00c896":border}} onPress={sendMsg} disabled={!input.trim()}>
            <Text style={{color:"white",fontSize:18,fontWeight:"900"}}>›</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{flexDirection:"row",alignItems:"center",padding:20,paddingTop:52}}><TouchableOpacity onPress={()=>navigation.navigate("MainTabs",{screen:"Home"})} style={{marginRight:12}}><Text style={{fontSize:16,color:"#00c896",fontWeight:"700"}}>{"\u2190"}</Text></TouchableOpacity><Text style={{fontSize:22,fontWeight:"900",color:text}}>Messages</Text></View>
      <View style={{flexDirection:"row",padding:4,borderRadius:14,margin:16,marginTop:0,backgroundColor:card,elevation:1}}>
        {[["medecin","Mon Medecin"],["patients","Patients"],["forum","Forum"]].map(([k,l])=>(
          <TouchableOpacity key={k} style={[{flex:1,paddingVertical:10,borderRadius:10,alignItems:"center"},tab===k&&{backgroundColor:"#00c896"}]} onPress={()=>setTab(k)}>
            <Text style={{fontSize:12,fontWeight:"700",color:tab===k?"white":text2}}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab==="medecin"&&(
        <FlatList data={doctors} keyExtractor={d=>d.id} contentContainerStyle={{paddingHorizontal:16,gap:10,paddingBottom:100}}
          ListEmptyComponent={<View style={{alignItems:"center",paddingTop:40}}><Text style={{color:text2}}>Aucun medecin disponible</Text></View>}
          renderItem={({item})=>(
            <TouchableOpacity style={{backgroundColor:card,borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12,elevation:1,borderWidth:1,borderColor:border}}
              onPress={()=>{setSelected(item);setSelectedType("medecin");}}>
              <View style={{width:50,height:50,borderRadius:25,backgroundColor:"#00c89620",alignItems:"center",justifyContent:"center"}}>
                <Text style={{fontSize:16,fontWeight:"900",color:"#00c896"}}>{initials(item.name)}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{fontSize:15,fontWeight:"700",color:text}}>{item.name}</Text>
                <Text style={{fontSize:12,color:"#00c896",marginTop:1}}>{item.specialty||"Medecin"}</Text>
                <Text style={{fontSize:11,color:text2}}>{item.hospital||""}</Text>
              </View>
              {item.online?(
                <View style={{flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:8,paddingVertical:4,borderRadius:12,backgroundColor:"#00c89620"}}>
                  <View style={{width:6,height:6,borderRadius:3,backgroundColor:"#00c896"}}/>
                  <Text style={{fontSize:10,fontWeight:"700",color:"#00c896"}}>En ligne</Text>
                </View>
              ):<Text style={{fontSize:11,color:text2}}>Hors ligne</Text>}
            </TouchableOpacity>
          )}
        />
      )}

      {tab==="patients"&&(
        <FlatList data={patients} keyExtractor={p=>p.id} contentContainerStyle={{paddingHorizontal:16,gap:10,paddingBottom:100}}
          ListEmptyComponent={<View style={{alignItems:"center",paddingTop:40}}><Text style={{color:text2}}>Aucun autre patient</Text></View>}
          renderItem={({item,index})=>(
            <TouchableOpacity style={{backgroundColor:card,borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12,elevation:1,borderWidth:1,borderColor:border}}
              onPress={()=>{setSelected(item);setSelectedType("patient");}}>
              <View style={{width:46,height:46,borderRadius:23,backgroundColor:colors[index%colors.length]+"20",alignItems:"center",justifyContent:"center"}}>
                <Text style={{fontSize:14,fontWeight:"900",color:colors[index%colors.length]}}>{initials(item.name)}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{fontSize:14,fontWeight:"700",color:text}}>{item.name}</Text>
                <Text style={{fontSize:12,color:text2,marginTop:1}}>{item.severity||"Patient"} - {item.ville||""}</Text>
              </View>
              <View style={{paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:"#00c89620"}}>
                <Text style={{fontSize:11,fontWeight:"700",color:"#00c896"}}>Message</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {tab==="forum"&&(
        <ScrollView contentContainerStyle={{paddingHorizontal:16,paddingBottom:120}}>
          <View style={{backgroundColor:card,borderRadius:16,padding:14,marginBottom:14,elevation:1}}>
            <Text style={{fontSize:14,fontWeight:"900",color:text,marginBottom:4}}>Forum Communautaire</Text>
            <Text style={{fontSize:12,color:text2,marginBottom:12}}>Partagez vos experiences</Text>
            <TextInput style={{backgroundColor:bg,borderRadius:12,padding:12,fontSize:14,color:text,borderWidth:1.5,borderColor:border,minHeight:60}} value={newPost} onChangeText={setNewPost} placeholder="Partagez votre experience..." placeholderTextColor={text2} multiline/>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:10}}>
              <View style={{flexDirection:"row",gap:8}}>
                {["General","Pollution","Astuces Inhalateur","Alimentation","Sport"].map(c=>(
                  <TouchableOpacity key={c} onPress={()=>setPostCategory(c)} style={{paddingHorizontal:10,paddingVertical:4,borderRadius:12,backgroundColor:postCategory===c?"#00c896":bg,borderWidth:1,borderColor:postCategory===c?"#00c896":border}}>
                    <Text style={{fontSize:11,fontWeight:"700",color:postCategory===c?"white":text2}}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={sendPost} disabled={loading} style={{marginTop:10,backgroundColor:"#00c896",borderRadius:12,padding:10,alignItems:"center"}}>
              {loading?<ActivityIndicator color="white" size="small"/>:<Text style={{color:"white",fontWeight:"700"}}>Publier</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
            <View style={{flexDirection:"row",gap:8}}>
              {categories.map(c=>(
                <TouchableOpacity key={c} onPress={()=>setActiveCategory(c)} style={{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:activeCategory===c?"#00c896":card,borderWidth:1,borderColor:activeCategory===c?"#00c896":border}}>
                  <Text style={{fontSize:12,fontWeight:"700",color:activeCategory===c?"white":text2}}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {filteredPosts.length===0&&<View style={{alignItems:"center",paddingTop:20}}><Text style={{color:text2}}>Aucune publication</Text></View>}
          {filteredPosts.map((p,i)=>(
            <View key={p.id} style={{backgroundColor:card,borderRadius:16,padding:14,marginBottom:10,elevation:1,borderWidth:1,borderColor:border}}>
              <View style={{flexDirection:"row",alignItems:"center",gap:10,marginBottom:10}}>
                <View style={{width:36,height:36,borderRadius:18,backgroundColor:colors[i%colors.length]+"20",alignItems:"center",justifyContent:"center"}}>
                  <Text style={{fontSize:13,fontWeight:"900",color:colors[i%colors.length]}}>{initials(p.fromName||"U")}</Text>
                </View>
                <View style={{flex:1}}>
                  <Text style={{fontSize:13,fontWeight:"700",color:text}}>{p.fromName||"Patient"}</Text>
                  <Text style={{fontSize:11,color:text2}}>{p.createdAt?.toDate?p.createdAt.toDate().toLocaleDateString("fr-FR"):"Maintenant"}</Text>
                </View>
                {p.category&&<View style={{paddingHorizontal:8,paddingVertical:3,borderRadius:12,backgroundColor:"#00c89615"}}>
                  <Text style={{fontSize:10,fontWeight:"700",color:"#00c896"}}>{p.category}</Text>
                </View>}
              </View>
              <Text style={{fontSize:14,lineHeight:22,color:text,marginBottom:12}}>{p.text}</Text>
              <View style={{flexDirection:"row",gap:16,borderTopWidth:1,borderTopColor:border,paddingTop:10}}>
                <TouchableOpacity onPress={()=>likePost(p.id,p.likes)} style={{flexDirection:"row",alignItems:"center",gap:6}}>
                  <Text style={{fontSize:16,color:"#d6304a"}}>v</Text>
                  <Text style={{fontSize:12,color:text2}}>{p.likes||0}</Text>
                </TouchableOpacity>
                <View style={{flexDirection:"row",alignItems:"center",gap:6}}>
                  <Text style={{fontSize:16,color:text2}}>o</Text>
                  <Text style={{fontSize:12,color:text2}}>{p.comments||0}</Text>
                </View>
                <TouchableOpacity style={{marginLeft:"auto"}}>
                  <Text style={{fontSize:12,color:text2}}>Partager</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}





