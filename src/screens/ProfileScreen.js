import React,{useState}from"react";
import{View,Text,ScrollView,TouchableOpacity,StatusBar,Alert,Switch,Modal,TextInput,ActivityIndicator}from"react-native";
import auth from"@react-native-firebase/auth";
import firestore from"@react-native-firebase/firestore";
import{useStore}from"../store/useStore";
export default function ProfileScreen({navigation}){
  const{userProfile,setUserProfile,theme,setTheme}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const[editModal,setEditModal]=useState(false);
  const[notifModal,setNotifModal]=useState(false);
  const[aboutModal,setAboutModal]=useState(false);
  const[editName,setEditName]=useState(userProfile?.name||"");
  const[editPhone,setEditPhone]=useState(userProfile?.phone||"");
  const[editVille,setEditVille]=useState(userProfile?.ville||"");
  const[notifAlerts,setNotifAlerts]=useState(true);
  const[notifRappels,setNotifRappels]=useState(true);
  const[notifChat,setNotifChat]=useState(true);
  const[saving,setSaving]=useState(false);
  const initials=(name)=>name?name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2):"P";
  const doLogout=()=>Alert.alert("Deconnexion","Voulez-vous vous deconnecter ?",[{text:"Annuler",style:"cancel"},{text:"Se deconnecter",style:"destructive",onPress:()=>auth().signOut()}]);
  const saveProfile=async()=>{
    if(!auth().currentUser)return;
    setSaving(true);
    try{
      const updates={name:editName,phone:editPhone,ville:editVille};
      await firestore().collection("patients").doc(auth().currentUser.uid).update(updates);
      setUserProfile({...userProfile,...updates});
      setEditModal(false);
      Alert.alert("Succes","Profil mis a jour !");
    }catch{Alert.alert("Erreur","Impossible de sauvegarder");}
    finally{setSaving(false);}
  };
  const menuItems=[
    {icon:"P",label:"Profil",sub:"Modifier vos informations",color:"#00c896",onPress:()=>{setEditName(userProfile?.name||"");setEditPhone(userProfile?.phone||"");setEditVille(userProfile?.ville||"");setEditModal(true);}},
    {icon:"N",label:"Notifications",sub:"Configurer les alertes",color:"#7c3aed",onPress:()=>setNotifModal(true)},
    {icon:"S",label:"Confidentialite",sub:"Securite et donnees",color:"#b88a00",onPress:()=>Alert.alert("Confidentialite","Vos donnees sont chiffrees et securisees sur Firebase. Aucune donnee n'est partagee sans votre accord.")},
    {icon:"A",label:"Apparence",sub:"Theme clair / sombre",color:"#d96a1f",onPress:()=>setTheme(isLight?"dark":"light")},
    {icon:"i",label:"A propos",sub:"Version 1.0.0 · SUPPTIC ENSP",color:"#50657a",onPress:()=>setAboutModal(true)},
  ];
  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{padding:20,paddingTop:52}}>
        <Text style={{fontSize:22,fontWeight:"900",color:text}}>Reglages</Text>
      </View>
      <ScrollView contentContainerStyle={{paddingBottom:120}}>
        <View style={{alignItems:"center",paddingVertical:20}}>
          <View style={{width:80,height:80,borderRadius:40,backgroundColor:"#00c89620",alignItems:"center",justifyContent:"center",marginBottom:12,borderWidth:3,borderColor:"#00c896"}}>
            <Text style={{fontSize:28,fontWeight:"900",color:"#00c896"}}>{initials(userProfile?.name||"P")}</Text>
          </View>
          <Text style={{fontSize:18,fontWeight:"900",color:text}}>{userProfile?.name||"Patient"}</Text>
          <Text style={{fontSize:13,color:text2,marginTop:2}}>{userProfile?.email||""}</Text>
          <View style={{flexDirection:"row",gap:8,marginTop:8,flexWrap:"wrap",justifyContent:"center"}}>
            <View style={{paddingHorizontal:12,paddingVertical:4,borderRadius:20,backgroundColor:"#00c89620"}}>
              <Text style={{fontSize:11,fontWeight:"700",color:"#00c896"}}>{userProfile?.severity||"Modere persistant"}</Text>
            </View>
            <View style={{paddingHorizontal:12,paddingVertical:4,borderRadius:20,backgroundColor:isLight?"#eef2f7":"#1e3050"}}>
              <Text style={{fontSize:11,fontWeight:"700",color:text2}}>{userProfile?.ville||"Yaounde"}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={()=>{setEditName(userProfile?.name||"");setEditPhone(userProfile?.phone||"");setEditVille(userProfile?.ville||"");setEditModal(true);}}
            style={{marginTop:12,paddingHorizontal:20,paddingVertical:8,borderRadius:20,borderWidth:1.5,borderColor:"#00c896"}}>
            <Text style={{fontSize:12,fontWeight:"700",color:"#00c896"}}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>
        <View style={{marginHorizontal:16,borderRadius:16,overflow:"hidden",backgroundColor:card,elevation:2,marginBottom:16}}>
          {menuItems.map((item,i)=>(
            <TouchableOpacity key={i} onPress={item.onPress} style={{flexDirection:"row",alignItems:"center",padding:16,borderBottomWidth:i<menuItems.length-1?1:0,borderBottomColor:border}}>
              <View style={{width:36,height:36,borderRadius:10,backgroundColor:item.color+"20",alignItems:"center",justifyContent:"center",marginRight:12}}>
                <Text style={{fontSize:14,fontWeight:"900",color:item.color}}>{item.icon}</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{fontSize:14,fontWeight:"700",color:text}}>{item.label}</Text>
                <Text style={{fontSize:12,color:text2,marginTop:1}}>{item.sub}</Text>
              </View>
              <Text style={{fontSize:18,color:text2}}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{marginHorizontal:16,borderRadius:16,overflow:"hidden",backgroundColor:card,elevation:2,marginBottom:16}}>
          <View style={{flexDirection:"row",alignItems:"center",padding:16}}>
            <View style={{width:36,height:36,borderRadius:10,backgroundColor:"#7c3aed20",alignItems:"center",justifyContent:"center",marginRight:12}}>
              <Text style={{fontSize:14,fontWeight:"900",color:"#7c3aed"}}>T</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={{fontSize:14,fontWeight:"700",color:text}}>Mode sombre</Text>
              <Text style={{fontSize:12,color:text2}}>Changer l'apparence</Text>
            </View>
            <Switch value={!isLight} onValueChange={(v)=>setTheme(v?"dark":"light")} trackColor={{false:"#eef2f7",true:"#00c896"}} thumbColor="white"/>
          </View>
        </View>
        <View style={{margin:16,borderRadius:16,borderWidth:1,borderColor:"#fde8ec",backgroundColor:"#fde8ec50",padding:16}}>
          <Text style={{fontSize:12,fontWeight:"700",color:"#d6304a",marginBottom:12}}>Zone de danger</Text>
          <TouchableOpacity onPress={doLogout} style={{backgroundColor:"#d6304a",borderRadius:12,padding:14,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8}}>
            <Text style={{color:"white",fontWeight:"900",fontSize:15}}>Se deconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={()=>setEditModal(false)}>
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"}}>
          <View style={{backgroundColor:card,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24}}>
            <Text style={{fontSize:18,fontWeight:"900",color:text,marginBottom:20}}>Modifier le profil</Text>
            {[["Nom complet",editName,setEditName],["Telephone",editPhone,setEditPhone],["Ville",editVille,setEditVille]].map(([label,val,setter])=>(
              <View key={label} style={{marginBottom:14}}>
                <Text style={{fontSize:12,fontWeight:"600",color:text2,marginBottom:6}}>{label}</Text>
                <TextInput style={{backgroundColor:bg,borderRadius:12,padding:12,fontSize:14,color:text,borderWidth:1.5,borderColor:border}} value={val} onChangeText={setter}/>
              </View>
            ))}
            <View style={{flexDirection:"row",gap:10,marginTop:8}}>
              <TouchableOpacity onPress={()=>setEditModal(false)} style={{flex:1,padding:14,borderRadius:12,borderWidth:1.5,borderColor:border,alignItems:"center"}}>
                <Text style={{fontWeight:"700",color:text2}}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveProfile} disabled={saving} style={{flex:1,padding:14,borderRadius:12,backgroundColor:"#00c896",alignItems:"center"}}>
                {saving?<ActivityIndicator color="white" size="small"/>:<Text style={{fontWeight:"900",color:"white"}}>Sauvegarder</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={notifModal} transparent animationType="slide" onRequestClose={()=>setNotifModal(false)}>
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"}}>
          <View style={{backgroundColor:card,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24}}>
            <Text style={{fontSize:18,fontWeight:"900",color:text,marginBottom:20}}>Notifications</Text>
            {[["Alertes SpO2",notifAlerts,setNotifAlerts],["Rappels medicaments",notifRappels,setNotifRappels],["Messages chat",notifChat,setNotifChat]].map(([label,val,setter])=>(
              <View key={label} style={{flexDirection:"row",alignItems:"center",paddingVertical:14,borderBottomWidth:1,borderBottomColor:border}}>
                <Text style={{flex:1,fontSize:14,color:text}}>{label}</Text>
                <Switch value={val} onValueChange={setter} trackColor={{false:border,true:"#00c896"}} thumbColor="white"/>
              </View>
            ))}
            <TouchableOpacity onPress={()=>setNotifModal(false)} style={{marginTop:20,padding:14,borderRadius:12,backgroundColor:"#00c896",alignItems:"center"}}>
              <Text style={{fontWeight:"900",color:"white"}}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={aboutModal} transparent animationType="slide" onRequestClose={()=>setAboutModal(false)}>
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"}}>
          <View style={{backgroundColor:card,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24}}>
            <Text style={{fontSize:18,fontWeight:"900",color:text,marginBottom:16}}>A propos</Text>
            <Text style={{fontSize:14,fontWeight:"700",color:text,marginBottom:4}}>ASTHMA MONITORING v1.0.0</Text>
            <Text style={{fontSize:13,color:text2,lineHeight:20,marginBottom:8}}>Projet SUPPTIC - Ecole Nationale Superieure des Postes, des Telecommunications et des TIC</Text>
            <Text style={{fontSize:13,color:text2,lineHeight:20,marginBottom:8}}>Systeme de surveillance de l'asthme au Cameroun</Text>
            <Text style={{fontSize:13,color:text2,lineHeight:20}}>Stack: React Native · Firebase · BLE · React Web · ENSP 2026</Text>
            <TouchableOpacity onPress={()=>setAboutModal(false)} style={{marginTop:20,padding:14,borderRadius:12,backgroundColor:"#00c896",alignItems:"center"}}>
              <Text style={{fontWeight:"900",color:"white"}}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
