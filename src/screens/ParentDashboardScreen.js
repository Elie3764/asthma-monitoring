import React,{useEffect,useState}from"react";
import{View,Text,ScrollView,TouchableOpacity,StatusBar,Linking,Alert}from"react-native";
import database from"@react-native-firebase/database";
import firestore from"@react-native-firebase/firestore";
import auth from"@react-native-firebase/auth";
import{useStore}from"../store/useStore";
export default function ParentDashboardScreen(){
  const{theme,userProfile,setTheme}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const[vitals,setVitals]=useState({spo2:null,hr:null,temp:null,resp:null});
  const[online,setOnline]=useState(false);
  const[patientInfo,setPatientInfo]=useState(null);
  const linkedId=userProfile?.linkedPatientId;
  useEffect(()=>{
    if(!linkedId)return;
    firestore().collection("patients").doc(linkedId).get().then(snap=>{
      if(snap.exists)setPatientInfo(snap.data());
    }).catch(()=>{});
    const ref=database().ref("patients/"+linkedId+"/vitals");
    const unsub=ref.on("value",snap=>{
      const v=snap.val();
      if(v){
        setVitals(v);
        const ageMs=Date.now()-(v.timestamp||0);
        setOnline(ageMs<60000);
      }
    });
    return()=>ref.off("value",unsub);
  },[linkedId]);
  const callEmergency=()=>{
    Alert.alert("Appeler en urgence","Contacter "+(patientInfo?.name||"votre proche")+" maintenant ?",[
      {text:"Annuler",style:"cancel"},
      {text:"Appeler",onPress:()=>Linking.openURL("tel:"+(patientInfo?.phone||""))}
    ]);
  };
  const doLogout=()=>Alert.alert("Deconnexion","Voulez-vous vous deconnecter ?",[{text:"Annuler",style:"cancel"},{text:"Se deconnecter",style:"destructive",onPress:()=>auth().signOut()}]);
  const initials=(name)=>name?name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2):"P";
  const spo2Color=!vitals.spo2?text2:vitals.spo2<88?"#d6304a":vitals.spo2<92?"#d96a1f":"#00c896";
  if(!linkedId){
    return(
      <View style={{flex:1,backgroundColor:bg,alignItems:"center",justifyContent:"center",padding:30}}>
        <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
        <Text style={{fontSize:16,fontWeight:"700",color:text,marginBottom:8}}>Aucun patient lie</Text>
        <Text style={{fontSize:13,color:text2,textAlign:"center"}}>Verifiez que votre numero correspond au contact d'urgence enregistre par votre proche.</Text>
      </View>
    );
  }
  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{flexDirection:"row",alignItems:"center",padding:20,paddingTop:52}}>
        <Text style={{fontSize:22,fontWeight:"900",color:text,flex:1}}>Suivi</Text>
        <TouchableOpacity onPress={()=>setTheme(isLight?"dark":"light")} style={{padding:8,borderRadius:20,backgroundColor:card,marginRight:8}}>
          <Text style={{fontSize:14}}>{isLight?"N":"J"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={doLogout} style={{padding:8,borderRadius:20,backgroundColor:card}}>
          <Text style={{fontSize:12,fontWeight:"700",color:"#d6304a"}}>Sortir</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:100}}>
        <View style={{backgroundColor:card,borderRadius:16,padding:16,marginBottom:16,elevation:2,flexDirection:"row",alignItems:"center",gap:12}}>
          <View style={{width:48,height:48,borderRadius:24,backgroundColor:"#00c89620",alignItems:"center",justifyContent:"center"}}>
            <Text style={{fontSize:16,fontWeight:"900",color:"#00c896"}}>{initials(patientInfo?.name)}</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={{fontSize:15,fontWeight:"700",color:text}}>Vous suivez {patientInfo?.name||"..."}</Text>
            <Text style={{fontSize:12,color:online?"#00c896":text2}}>{online?"Connecte maintenant":"Hors ligne"}</Text>
          </View>
          <View style={{width:10,height:10,borderRadius:5,backgroundColor:online?"#00c896":border}}/>
        </View>
        <View style={{flexDirection:"row",gap:10,marginBottom:16}}>
          <View style={{flex:1,backgroundColor:card,borderRadius:14,padding:14,borderWidth:1,borderColor:border}}>
            <Text style={{fontSize:11,color:text2,fontWeight:"600",marginBottom:4}}>SpO2</Text>
            <Text style={{fontSize:28,fontWeight:"900",color:spo2Color}}>{vitals.spo2||"--"}<Text style={{fontSize:13,fontWeight:"400"}}>%</Text></Text>
          </View>
          <View style={{flex:1,backgroundColor:card,borderRadius:14,padding:14,borderWidth:1,borderColor:border}}>
            <Text style={{fontSize:11,color:text2,fontWeight:"600",marginBottom:4}}>FC</Text>
            <Text style={{fontSize:28,fontWeight:"900",color:"#d96a1f"}}>{vitals.hr||"--"}<Text style={{fontSize:13,fontWeight:"400"}}> bpm</Text></Text>
          </View>
        </View>
        <View style={{flexDirection:"row",gap:10,marginBottom:16}}>
          <View style={{flex:1,backgroundColor:card,borderRadius:14,padding:14,borderWidth:1,borderColor:border}}>
            <Text style={{fontSize:11,color:text2,fontWeight:"600",marginBottom:4}}>Temperature</Text>
            <Text style={{fontSize:22,fontWeight:"900",color:"#b88a00"}}>{vitals.temp!=null?vitals.temp.toFixed(1):"--"}<Text style={{fontSize:13,fontWeight:"400"}}>C</Text></Text>
          </View>
          <View style={{flex:1,backgroundColor:card,borderRadius:14,padding:14,borderWidth:1,borderColor:border}}>
            <Text style={{fontSize:11,color:text2,fontWeight:"600",marginBottom:4}}>Respiration</Text>
            <Text style={{fontSize:22,fontWeight:"900",color:"#7c3aed"}}>{vitals.resp||"--"}<Text style={{fontSize:13,fontWeight:"400"}}>/min</Text></Text>
          </View>
        </View>
        <View style={{backgroundColor:vitals.spo2&&vitals.spo2<92?"#fde8ec":"#e8faf5",borderRadius:14,padding:14,marginBottom:16,flexDirection:"row",alignItems:"center",gap:10}}>
          <Text style={{fontSize:13,color:vitals.spo2&&vitals.spo2<92?"#d6304a":"#00a878",fontWeight:"700"}}>
            {vitals.spo2&&vitals.spo2<92?"Attention : SpO2 basse":"Aucune alerte actuellement"}
          </Text>
        </View>
        <TouchableOpacity onPress={callEmergency} style={{backgroundColor:"#d6304a",borderRadius:14,padding:16,alignItems:"center",elevation:4}}>
          <Text style={{color:"white",fontWeight:"900",fontSize:15}}>Appeler en cas d'urgence</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
