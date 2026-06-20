import React,{useState,useEffect}from"react";
import{View,Text,ScrollView,TouchableOpacity,StatusBar,TextInput,Alert,Switch}from"react-native";
import firestore from"@react-native-firebase/firestore";
import{useStore}from"../store/useStore";
export default function RemindersScreen({navigation}){
  const{theme,reminders,setReminders,toggleReminder,user}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const[showForm,setShowForm]=useState(false);
  const[med,setMed]=useState("");
  const[time,setTime]=useState("08:00");
  const[freq,setFreq]=useState("1x/jour");
  const[tab,setTab]=useState("rappels");
  const[rdvs,setRdvs]=useState([]);
  const[ordonnances,setOrdonnances]=useState([]);
  const freqs=["1x/jour","2x/jour","3x/jour","Si besoin"];

  useEffect(()=>{
    console.log('DEBUG user:',user);if(!user?.uid){console.log('DEBUG no uid, exiting');return;}console.log('DEBUG fetching rdvs for uid:',user.uid);
    const unsubRdv=firestore().collection("rdvs").where("patientId","==",user.uid).orderBy("date","asc")
      .onSnapshot(snap=>{const list=[];snap.forEach(d=>list.push({id:d.id,...d.data()}));setRdvs(list);console.log("DEBUG rdvs loaded:",list.length);},(err)=>{console.log("DEBUG rdvs ERROR:",err.message);});
    const unsubOrd=firestore().collection("ordonnances").where("patientId","==",user.uid).orderBy("createdAt","desc")
      .onSnapshot(snap=>{const list=[];snap.forEach(d=>list.push({id:d.id,...d.data()}));setOrdonnances(list);console.log("DEBUG ordonnances loaded:",list.length);},(err)=>{console.log("DEBUG ordonnances ERROR:",err.message);});
    return()=>{unsubRdv();unsubOrd();};
  },[user]);

  const addReminder=()=>{
    if(!med.trim()){Alert.alert("Entrez le nom du medicament");return;}
    const newR={id:"r"+Date.now(),med:med.trim(),time,freq,active:true};
    setReminders([...reminders,newR]);
    setMed("");setTime("08:00");setFreq("1x/jour");setShowForm(false);
  };
  const deleteReminder=(id)=>Alert.alert("Supprimer","Supprimer ce rappel ?",[{text:"Annuler",style:"cancel"},{text:"Supprimer",style:"destructive",onPress:()=>setReminders(reminders.filter(r=>r.id!==id))}]);
  const colors=["#00c896","#d96a1f","#7c3aed","#b88a00","#d6304a"];

  const tabs=[["rappels","Rappels"],["rdv","Rendez-vous"],["ordonnances","Ordonnances"]];

  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{flexDirection:"row",alignItems:"center",padding:20,paddingTop:52}}>
        <TouchableOpacity onPress={()=>navigation.goBack()} style={{marginRight:12}}>
          <Text style={{fontSize:16,color:"#00c896",fontWeight:"700"}}>?</Text>
        </TouchableOpacity>
        <Text style={{fontSize:22,fontWeight:"900",color:text,flex:1}}>Suivi medical</Text>
        {tab==="rappels"&&(
          <TouchableOpacity onPress={()=>setShowForm(!showForm)} style={{width:36,height:36,borderRadius:18,backgroundColor:"#00c896",alignItems:"center",justifyContent:"center"}}>
            <Text style={{fontSize:22,color:"white",lineHeight:24}}>{showForm?"x":"+"}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{flexDirection:"row",padding:4,borderRadius:14,marginHorizontal:16,marginBottom:12,backgroundColor:card,elevation:1}}>
        {tabs.map(([k,l])=>(
          <TouchableOpacity key={k} style={[{flex:1,paddingVertical:10,borderRadius:10,alignItems:"center"},tab===k&&{backgroundColor:"#00c896"}]} onPress={()=>setTab(k)}>
            <Text style={{fontSize:12,fontWeight:"700",color:tab===k?"white":text2}}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{padding:16,paddingTop:0,paddingBottom:120}}>

        {tab==="rappels"&&(
          <>
            {showForm&&(
              <View style={{backgroundColor:card,borderRadius:16,padding:16,marginBottom:16,elevation:2,borderWidth:1,borderColor:"#00c89630"}}>
                <Text style={{fontSize:16,fontWeight:"900",color:text,marginBottom:16}}>Nouveau rappel</Text>
                <Text style={{fontSize:12,fontWeight:"600",color:text2,marginBottom:6}}>Medicament</Text>
                <TextInput style={{backgroundColor:bg,borderRadius:12,padding:12,fontSize:14,color:text,borderWidth:1.5,borderColor:border,marginBottom:12}} value={med} onChangeText={setMed} placeholder="Salbutamol 100ug..." placeholderTextColor={text2}/>
                <Text style={{fontSize:12,fontWeight:"600",color:text2,marginBottom:6}}>Heure</Text>
                <TextInput style={{backgroundColor:bg,borderRadius:12,padding:12,fontSize:14,color:text,borderWidth:1.5,borderColor:border,marginBottom:12}} value={time} onChangeText={setTime} placeholder="08:00" placeholderTextColor={text2}/>
                <Text style={{fontSize:12,fontWeight:"600",color:text2,marginBottom:8}}>Frequence</Text>
                <View style={{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:16}}>
                  {freqs.map(f=>(
                    <TouchableOpacity key={f} onPress={()=>setFreq(f)} style={{paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:freq===f?"#00c896":bg,borderWidth:1,borderColor:freq===f?"#00c896":border}}>
                      <Text style={{fontSize:12,fontWeight:"700",color:freq===f?"white":text2}}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={addReminder} style={{backgroundColor:"#00c896",borderRadius:12,padding:14,alignItems:"center"}}>
                  <Text style={{color:"white",fontWeight:"900",fontSize:14}}>Ajouter le rappel</Text>
                </TouchableOpacity>
              </View>
            )}
            {reminders.length===0&&!showForm&&(
              <View style={{alignItems:"center",paddingTop:60,gap:12}}>
                <View style={{width:64,height:64,borderRadius:32,backgroundColor:"#00c89620",alignItems:"center",justifyContent:"center"}}>
                  <Text style={{fontSize:28,color:"#00c896"}}>R</Text>
                </View>
                <Text style={{fontSize:16,fontWeight:"700",color:text2}}>Aucun rappel</Text>
                <Text style={{fontSize:13,color:text2,textAlign:"center"}}>Appuyez sur + pour ajouter un rappel de medicament</Text>
              </View>
            )}
            {reminders.map((r,i)=>(
              <View key={r.id} style={{backgroundColor:card,borderRadius:16,padding:16,marginBottom:10,elevation:1,borderWidth:1,borderColor:border,flexDirection:"row",alignItems:"center",gap:12}}>
                <View style={{width:44,height:44,borderRadius:12,backgroundColor:colors[i%colors.length]+"20",alignItems:"center",justifyContent:"center"}}>
                  <Text style={{fontSize:18,color:colors[i%colors.length],fontWeight:"900"}}>M</Text>
                </View>
                <View style={{flex:1}}>
                  <Text style={{fontSize:14,fontWeight:"700",color:text}}>{r.med}</Text>
                  <Text style={{fontSize:12,color:text2,marginTop:2}}>{r.time} · {r.freq}</Text>
                </View>
                <Switch value={r.active} onValueChange={()=>toggleReminder(r.id)} trackColor={{false:border,true:"#00c896"}} thumbColor="white"/>
                <TouchableOpacity onPress={()=>deleteReminder(r.id)} style={{padding:4}}>
                  <Text style={{fontSize:16,color:"#d6304a"}}>x</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {tab==="rdv"&&(
          <>
            {rdvs.length===0&&(
              <View style={{alignItems:"center",paddingTop:60,gap:12}}>
                <View style={{width:64,height:64,borderRadius:32,backgroundColor:"#7c3aed20",alignItems:"center",justifyContent:"center"}}>
                  <Text style={{fontSize:28,color:"#7c3aed"}}>D</Text>
                </View>
                <Text style={{fontSize:16,fontWeight:"700",color:text2}}>Aucun rendez-vous</Text>
                <Text style={{fontSize:13,color:text2,textAlign:"center"}}>Vos rendez-vous programmes par le medecin apparaitront ici</Text>
              </View>
            )}
            {rdvs.map(r=>(
              <View key={r.id} style={{backgroundColor:card,borderRadius:16,padding:16,marginBottom:10,elevation:1,borderWidth:1,borderColor:border}}>
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

        {tab==="ordonnances"&&(
          <>
            {ordonnances.length===0&&(
              <View style={{alignItems:"center",paddingTop:60,gap:12}}>
                <View style={{width:64,height:64,borderRadius:32,backgroundColor:"#d96a1f20",alignItems:"center",justifyContent:"center"}}>
                  <Text style={{fontSize:28,color:"#d96a1f"}}>O</Text>
                </View>
                <Text style={{fontSize:16,fontWeight:"700",color:text2}}>Aucune ordonnance</Text>
                <Text style={{fontSize:13,color:text2,textAlign:"center"}}>Vos ordonnances emises par le medecin apparaitront ici</Text>
              </View>
            )}
            {ordonnances.map(o=>(
              <View key={o.id} style={{backgroundColor:card,borderRadius:16,padding:16,marginBottom:10,elevation:1,borderWidth:1,borderColor:border}}>
                <View style={{flexDirection:"row",alignItems:"center",gap:12,marginBottom:8}}>
                  <View style={{width:44,height:44,borderRadius:12,backgroundColor:"#d96a1f20",alignItems:"center",justifyContent:"center"}}>
                    <Text style={{fontSize:16,color:"#d96a1f",fontWeight:"900"}}>Rx</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{fontSize:14,fontWeight:"700",color:text}}>{o.med}</Text>
                    <Text style={{fontSize:12,color:text2,marginTop:2}}>{o.dosage} · {o.duration}</Text>
                  </View>
                </View>
                <Text style={{fontSize:12,color:text2,marginLeft:56}}>{o.date} · {o.doctorName||"Medecin"}</Text>
              </View>
            ))}
          </>
        )}

      </ScrollView>
    </View>
  );
}


