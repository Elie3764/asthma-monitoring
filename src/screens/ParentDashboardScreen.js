import React,{useEffect,useState}from"react";
import{View,Text,ScrollView,TouchableOpacity,StatusBar,Linking,Alert,ActivityIndicator}from"react-native";
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
  const[tab,setTab]=useState("suivi");
  const[vitals,setVitals]=useState({spo2:null,hr:null,temp:null,resp:null});
  const[online,setOnline]=useState(false);
  const[patientInfo,setPatientInfo]=useState(null);
  const[doctorInfo,setDoctorInfo]=useState(null);
  const[rdvs,setRdvs]=useState([]);
  const[reminders,setReminders]=useState([]);
  const[notes,setNotes]=useState([]);
  const linkedId=userProfile?.linkedPatientId;

  useEffect(()=>{
    if(!linkedId)return;
    firestore().collection("patients").doc(linkedId).get().then(async snap=>{
      if(snap.exists){
        const data=snap.data();
        setPatientInfo(data);
        if(data.doctorId){
          const docSnap=await firestore().collection("doctors").doc(data.doctorId).get();
          if(docSnap.exists)setDoctorInfo(docSnap.data());
        }
      }
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
    const unsubRdv=firestore().collection("rdvs").where("patientId","==",linkedId).orderBy("date","asc")
      .onSnapshot(s=>{const l=[];s.forEach(d=>l.push({id:d.id,...d.data()}));setRdvs(l);},()=>{});
    const unsubNotes=firestore().collection("medicalNotes").where("patientId","==",linkedId).orderBy("createdAt","desc")
      .onSnapshot(s=>{const l=[];s.forEach(d=>l.push({id:d.id,...d.data()}));setNotes(l);},()=>{});
    return()=>{ref.off("value",unsub);unsubRdv();unsubNotes();};
  },[linkedId]);

  const callPatient=()=>{
    if(!patientInfo?.phone){Alert.alert("Numero indisponible","Le patient n'a pas renseigne de numero de telephone.");return;}
    Linking.openURL("tel:"+patientInfo.phone);
  };
  const callDoctor=()=>{
    if(!doctorInfo?.phone){Alert.alert("Numero indisponible","Le medecin n'a pas renseigne de numero de telephone.");return;}
    Linking.openURL("tel:"+doctorInfo.phone);
  };
  const callEmergency=()=>{
    const hasPatientPhone=!!patientInfo?.phone;
    const hasDoctorPhone=!!doctorInfo?.phone;
    if(!hasPatientPhone&&!hasDoctorPhone){
      Alert.alert("Aucun numero disponible","Ni le patient ni le medecin n'ont renseigne de numero de telephone.");
      return;
    }
    if(hasPatientPhone&&hasDoctorPhone){
      Alert.alert("Appeler qui ?","",[
        {text:"Annuler",style:"cancel"},
        {text:patientInfo.name||"Patient",onPress:callPatient},
        {text:doctorInfo.name||"Medecin",onPress:callDoctor}
      ]);
    }else if(hasPatientPhone){callPatient();}
    else{callDoctor();}
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

      <View style={{backgroundColor:card,borderRadius:16,padding:16,marginHorizontal:16,marginBottom:14,elevation:2,flexDirection:"row",alignItems:"center",gap:12}}>
        <View style={{width:48,height:48,borderRadius:24,backgroundColor:"#00c89620",alignItems:"center",justifyContent:"center"}}>
          <Text style={{fontSize:16,fontWeight:"900",color:"#00c896"}}>{initials(patientInfo?.name)}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:15,fontWeight:"700",color:text}}>Vous suivez {patientInfo?.name||"..."}</Text>
          <Text style={{fontSize:12,color:online?"#00c896":text2}}>{online?"Connecte maintenant":"Hors ligne"}</Text>
        </View>
        <View style={{width:10,height:10,borderRadius:5,backgroundColor:online?"#00c896":border}}/>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
        <View style={{flexDirection:"row",gap:8,paddingHorizontal:16}}>
          {[["suivi","Suivi"],["rdv","Rendez-vous"],["rappels","Rappels"],["analyses","Analyses"]].map(([k,l])=>(
            <TouchableOpacity key={k} onPress={()=>setTab(k)} style={{paddingHorizontal:16,paddingVertical:9,borderRadius:20,backgroundColor:tab===k?"#00c896":card,borderWidth:1,borderColor:tab===k?"#00c896":border}}>
              <Text style={{fontSize:12,fontWeight:"700",color:tab===k?"white":text2}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView contentContainerStyle={{padding:16,paddingTop:0,paddingBottom:100}}>
        {tab==="suivi"&&(
          <>
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
            {(patientInfo?.phone||doctorInfo?.phone)&&(
              <TouchableOpacity onPress={callEmergency} style={{backgroundColor:"#d6304a",borderRadius:14,padding:16,alignItems:"center",elevation:4}}>
                <Text style={{color:"white",fontWeight:"900",fontSize:15}}>Appeler en cas d'urgence</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {tab==="rdv"&&(
          <>
            {rdvs.length===0?(
              <View style={{alignItems:"center",paddingTop:60,gap:12}}>
                <Text style={{fontSize:16,fontWeight:"700",color:text2}}>Aucun rendez-vous</Text>
              </View>
            ):rdvs.map(r=>(
              <View key={r.id} style={{backgroundColor:card,borderRadius:16,padding:16,marginBottom:10,borderWidth:1,borderColor:border}}>
                <View style={{flexDirection:"row",alignItems:"center",gap:12,marginBottom:8}}>
                  <View style={{width:44,height:44,borderRadius:12,backgroundColor:"#7c3aed20",alignItems:"center",justifyContent:"center"}}>
                    <Text style={{fontSize:16,color:"#7c3aed",fontWeight:"900"}}>{r.date?r.date.split("-")[2]:"--"}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{fontSize:14,fontWeight:"700",color:text}}>{r.date} a {r.time}</Text>
                    <Text style={{fontSize:12,color:text2,marginTop:2}}>{r.doctorName||"Medecin"}</Text>
                  </View>
                  <View style={{paddingHorizontal:10,paddingVertical:4,borderRadius:10,backgroundColor:"#00c89620"}}>
                    <Text style={{fontSize:10,fontWeight:"700",color:"#00c896"}}>{r.status||"confirme"}</Text>
                  </View>
                </View>
                {r.motif&&<Text style={{fontSize:13,color:text2,marginLeft:56}}>{r.motif}</Text>}
              </View>
            ))}
          </>
        )}

        {tab==="rappels"&&(
          <View style={{backgroundColor:card,borderRadius:16,padding:20,alignItems:"center"}}>
            <Text style={{fontSize:14,color:text2,textAlign:"center"}}>Les rappels de medicaments sont geres directement par {patientInfo?.name||"le patient"} sur son telephone.</Text>
          </View>
        )}

        {tab==="analyses"&&(
          <>
            <Text style={{fontSize:13,fontWeight:"700",color:text2,marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Notes du medecin</Text>
            {notes.length===0?(
              <View style={{backgroundColor:card,borderRadius:14,padding:16,marginBottom:20,borderWidth:1,borderColor:border}}>
                <Text style={{fontSize:13,color:text2,textAlign:"center"}}>Aucune note medicale pour le moment</Text>
              </View>
            ):notes.map(n=>(
              <View key={n.id} style={{backgroundColor:card,borderRadius:14,padding:14,marginBottom:10,borderWidth:1,borderColor:border}}>
                <View style={{flexDirection:"row",justifyContent:"space-between",marginBottom:6}}>
                  <Text style={{fontSize:13,fontWeight:"700",color:text}}>{n.doctorName||"Medecin"}</Text>
                  <Text style={{fontSize:11,color:text2}}>{n.createdAt?.toDate?n.createdAt.toDate().toLocaleDateString("fr-FR"):""}</Text>
                </View>
                <Text style={{fontSize:13,color:text2,lineHeight:19}}>{n.text}</Text>
              </View>
            ))}
            <Text style={{fontSize:13,fontWeight:"700",color:text2,marginTop:10,marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Vitaux actuels</Text>
            <View style={{backgroundColor:card,borderRadius:14,padding:16,borderWidth:1,borderColor:border}}>
              <Text style={{fontSize:13,color:text2,lineHeight:20}}>SpO2: {vitals.spo2||"--"}% - FC: {vitals.hr||"--"} bpm - Temp: {vitals.temp||"--"}C - Resp: {vitals.resp||"--"}/min</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
