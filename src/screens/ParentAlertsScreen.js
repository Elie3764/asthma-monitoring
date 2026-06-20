import React,{useEffect,useState}from"react";
import{View,Text,FlatList,StatusBar}from"react-native";
import database from"@react-native-firebase/database";
import{useStore}from"../store/useStore";
export default function ParentAlertsScreen(){
  const{theme,userProfile}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const[history,setHistory]=useState([]);
  const linkedId=userProfile?.linkedPatientId;
  useEffect(()=>{
    if(!linkedId)return;
    const ref=database().ref("patients/"+linkedId+"/vitals");
    const unsub=ref.on("value",snap=>{
      const v=snap.val();
      if(v&&v.spo2!=null){
        setHistory(prev=>{
          const entry={spo2:v.spo2,hr:v.hr,timestamp:v.timestamp||Date.now(),critical:v.spo2<88,warning:v.spo2<92&&v.spo2>=88};
          const exists=prev.find(p=>p.timestamp===entry.timestamp);
          if(exists)return prev;
          return[entry,...prev].slice(0,50);
        });
      }
    });
    return()=>ref.off("value",unsub);
  },[linkedId]);
  const alertsOnly=history.filter(h=>h.critical||h.warning);
  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{padding:20,paddingTop:52}}>
        <Text style={{fontSize:22,fontWeight:"900",color:text}}>Historique des alertes</Text>
      </View>
      {alertsOnly.length===0?(
        <View style={{flex:1,alignItems:"center",justifyContent:"center",gap:8}}>
          <Text style={{fontSize:16,fontWeight:"700",color:text2}}>Aucune alerte</Text>
          <Text style={{fontSize:13,color:text2,textAlign:"center",paddingHorizontal:30}}>Votre proche n'a eu aucune alerte de sante recente</Text>
        </View>
      ):(
        <FlatList data={alertsOnly} keyExtractor={(_,i)=>i.toString()} contentContainerStyle={{padding:16}}
          renderItem={({item})=>(
            <View style={{backgroundColor:card,borderRadius:14,padding:14,marginBottom:10,borderWidth:1,borderColor:item.critical?"#d6304a40":"#d96a1f40",flexDirection:"row",alignItems:"center",gap:12}}>
              <View style={{width:36,height:36,borderRadius:18,backgroundColor:item.critical?"#fde8ec":"#fef3e8",alignItems:"center",justifyContent:"center"}}>
                <Text style={{fontSize:16,color:item.critical?"#d6304a":"#d96a1f",fontWeight:"900"}}>!</Text>
              </View>
              <View style={{flex:1}}>
                <Text style={{fontSize:14,fontWeight:"700",color:text}}>SpO2 {item.critical?"critique":"basse"}: {item.spo2}%</Text>
                <Text style={{fontSize:12,color:text2,marginTop:2}}>{new Date(item.timestamp).toLocaleString("fr-FR")}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
