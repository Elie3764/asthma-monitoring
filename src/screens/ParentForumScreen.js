import React,{useState,useEffect}from"react";
import{View,Text,ScrollView,TouchableOpacity,StatusBar,TextInput,Alert,ActivityIndicator}from"react-native";
import firestore from"@react-native-firebase/firestore";
import{useStore}from"../store/useStore";
export default function ParentForumScreen(){
  const{theme,user,userProfile}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const[posts,setPosts]=useState([]);
  const[newPost,setNewPost]=useState("");
  const[postCategory,setPostCategory]=useState("General");
  const[activeCategory,setActiveCategory]=useState("Tous");
  const[loading,setLoading]=useState(false);
  const categories=["Tous","Pollution","Astuces Inhalateur","Alimentation","Sport","General"];
  const colors=["#00c896","#7c3aed","#d96a1f","#b88a00","#d6304a"];
  useEffect(()=>{
    const unsub=firestore().collection("forum").orderBy("createdAt","desc").limit(50).onSnapshot(snap=>{
      const p=[];snap.forEach(d=>p.push({id:d.id,...d.data()}));setPosts(p);
    },()=>{});
    return unsub;
  },[]);
  const sendPost=async()=>{
    if(!newPost.trim()||!user?.uid)return;
    setLoading(true);
    try{
      await firestore().collection("forum").add({text:newPost.trim(),from:user.uid,fromName:(userProfile?.name||"Parent")+" (proche)",category:postCategory,likes:0,comments:0,createdAt:firestore.FieldValue.serverTimestamp()});
      setNewPost("");
    }catch{Alert.alert("Erreur","Impossible de publier");}
    finally{setLoading(false);}
  };
  const likePost=async(id,likes)=>{
    await firestore().collection("forum").doc(id).update({likes:(likes||0)+1}).catch(()=>{});
  };
  const initials=(name)=>name?name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2):"?";
  const filteredPosts=activeCategory==="Tous"?posts:posts.filter(p=>p.category===activeCategory);
  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{padding:20,paddingTop:52}}>
        <Text style={{fontSize:22,fontWeight:"900",color:text}}>Forum Communautaire</Text>
        <Text style={{fontSize:12,color:text2,marginTop:2}}>Echangez avec d'autres proches et patients</Text>
      </View>
      <ScrollView contentContainerStyle={{paddingHorizontal:16,paddingBottom:120}}>
        <View style={{backgroundColor:card,borderRadius:16,padding:14,marginBottom:14,elevation:1}}>
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
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
