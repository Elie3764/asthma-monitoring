import React,{useState,useRef,useEffect}from"react";
import{View,Text,StyleSheet,FlatList,TouchableOpacity,TextInput,Alert,ActivityIndicator,StatusBar,PermissionsAndroid,Platform}from"react-native";
import{BleManager}from"react-native-ble-plx";
import{Buffer}from"buffer";
import database from"@react-native-firebase/database";
import{useStore}from"../store/useStore";
import{getTheme}from"../utils/theme";
import{ALERT_THRESHOLDS}from"../services/firebase";

let ble=null;
const getBle=()=>{if(!ble)ble=new BleManager();return ble;};
const HR_SERVICE="0000180d-0000-1000-8000-00805f9b34fb";
const HR_CHAR="00002a37-0000-1000-8000-00805f9b34fb";
const SPO2_SERVICE="00001822-0000-1000-8000-00805f9b34fb";
const SPO2_CHAR="00002a5f-0000-1000-8000-00805f9b34fb";
const BATTERY_SERVICE="0000180f-0000-1000-8000-00805f9b34fb";
const BATTERY_CHAR="00002a19-0000-1000-8000-00805f9b34fb";

export default function WatchScreen({navigation}){
  const{theme,setConnectedDevice,disconnect,connectedDevice,connectionType,setVitals,setAlertStatus,addAlert,user}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const[mode,setMode]=useState("ble");
  const[scanning,setScanning]=useState(false);
  const[devices,setDevices]=useState([]);
  const[connecting,setConnecting]=useState(false);
  const[gsmUrl,setGsmUrl]=useState("http://192.168.1.100:3000");
  const[bleVitals,setBleVitals]=useState({hr:null,spo2:null,battery:null});
  const gsmT=useRef(null);
  const simT=useRef(null);
  const bleDevice=useRef(null);

  useEffect(()=>()=>{
    getBle().stopDeviceScan();
    if(gsmT.current)clearInterval(gsmT.current);
    if(simT.current)clearInterval(simT.current);
    if(bleDevice.current)bleDevice.current.cancelConnection().catch(()=>{});
  },[]);

  const reqPermissions=async()=>{
    if(Platform.OS!=="android")return true;
    try{
      const perms=[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT];
      const r=await PermissionsAndroid.requestMultiple(perms);
      return Object.values(r).every(v=>v===PermissionsAndroid.RESULTS.GRANTED);
    }catch{return false;}
  };

  const startScan=async()=>{
    const ok=await reqPermissions();
    if(!ok){Alert.alert("Permissions requises","Autorisez le Bluetooth et la localisation");return;}
    setScanning(true);
    setDevices([]);
    const found=new Set();
    getBle().startDeviceScan(null,{allowDuplicates:false},(err,dev)=>{
      if(err){setScanning(false);Alert.alert("Erreur BLE",err.message);return;}
      if(!dev||found.has(dev.id))return;
      found.add(dev.id);
      setDevices(p=>[...p,{id:dev.id,name:dev.name||dev.localName||"Appareil inconnu",rssi:dev.rssi||0,raw:dev}]);
    });
    setTimeout(()=>{getBle().stopDeviceScan();setScanning(false);},15000);
  };

  const connectBLE=async(item)=>{
    getBle().stopDeviceScan();
    setScanning(false);
    setConnecting(true);
    try{
      const dev=await getBle().connectToDevice(item.id,{autoConnect:false});
      await dev.discoverAllServicesAndCharacteristics();
      bleDevice.current=dev;
      setConnectedDevice({id:item.id,name:item.name},"ble");
      setConnecting(false);
      Alert.alert("Connecte !",item.name+" est connecte.");

      // Subscribe to Heart Rate
      dev.monitorCharacteristicForService(HR_SERVICE,HR_CHAR,(err,char)=>{
        if(err||!char)return;
        try{
          const bytes=Buffer.from(char.value,"base64");
          const flag=bytes[0];
          const hr=(flag&0x01)?bytes.readUInt16LE(1):bytes[1];
          setBleVitals(v=>({...v,hr}));
          handleV({hr,spo2:bleVitals.spo2||95,temp:36.6,resp:16},"ble");
        }catch{}
      });

      // Subscribe to SpO2
      dev.monitorCharacteristicForService(SPO2_SERVICE,SPO2_CHAR,(err,char)=>{
        if(err||!char)return;
        try{
          const bytes=Buffer.from(char.value,"base64");
          const spo2=bytes[1];
          setBleVitals(v=>({...v,spo2}));
          handleV({hr:bleVitals.hr||75,spo2,temp:36.6,resp:16},"ble");
        }catch{}
      });

      // Battery level
      try{
        const bat=await dev.readCharacteristicForService(BATTERY_SERVICE,BATTERY_CHAR);
        if(bat){const b=Buffer.from(bat.value,"base64")[0];setBleVitals(v=>({...v,battery:b}));}
      }catch{}

      // Disconnect handler
      dev.onDisconnected(()=>{
        setBleVitals({hr:null,spo2:null,battery:null});
        disconnect();
        Alert.alert("Deconnecte","La montre s'est deconnectee.");
      });

    }catch(e){
      setConnecting(false);
      Alert.alert("Erreur connexion",e.message||"Impossible de se connecter");
    }
  };

  const handleV=(v,src)=>{
    setVitals(v);
    if(v.spo2<ALERT_THRESHOLDS.spo2.critical){setAlertStatus("critical");addAlert({level:"critical",message:"SpO2 critique: "+v.spo2+"%",timestamp:Date.now()});}
    else if(v.spo2<ALERT_THRESHOLDS.spo2.warning){setAlertStatus("warning");addAlert({level:"warning",message:"SpO2 basse: "+v.spo2+"%",timestamp:Date.now()});}
    else setAlertStatus("normal");
    if(user?.uid)database().ref("patients/"+user.uid+"/vitals").set({...v,timestamp:database.ServerValue.TIMESTAMP,source:src}).catch(()=>{});
  };

  const startSim=()=>{
    setConnecting(true);
    setTimeout(()=>{
      setConnectedDevice({id:"sim1",name:"Simulation Montre"},"sim");
      const poll=()=>handleV({spo2:94+Math.floor(Math.random()*6),hr:65+Math.floor(Math.random()*30),temp:+(36.2+Math.random()*.9).toFixed(1),resp:13+Math.floor(Math.random()*7)},"sim");
      poll();
      simT.current=setInterval(poll,5000);
      setConnecting(false);
      Alert.alert("Simulation","Donnees simulees actives");
    },500);
  };

  const connectGSM=()=>{
    if(!gsmUrl.startsWith("http")){Alert.alert("URL invalide");return;}
    setConnecting(true);
    const poll=async()=>{
      try{
        const res=await fetch(gsmUrl+"/vitals",{signal:AbortSignal.timeout(8000)});
        if(res.ok){const d=await res.json();handleV({spo2:+d.spo2,hr:+(d.hr||d.heartRate),temp:+(d.temp||d.temperature),resp:+(d.resp||d.respiratoryRate)},"gsm");setConnectedDevice({id:"gsm",name:"GSM "+gsmUrl},"gsm");}
      }catch{Alert.alert("Erreur GSM","Verifiez l'URL et la connexion");}
      finally{setConnecting(false);}
    };
    poll();
    gsmT.current=setInterval(poll,30000);
  };

  const doDisconnect=()=>Alert.alert("Deconnecter ?","",[{text:"Annuler",style:"cancel"},{text:"Oui",style:"destructive",onPress:()=>{
    getBle().stopDeviceScan();
    if(bleDevice.current)bleDevice.current.cancelConnection().catch(()=>{});
    if(gsmT.current)clearInterval(gsmT.current);
    if(simT.current)clearInterval(simT.current);
    setBleVitals({hr:null,spo2:null,battery:null});
    disconnect();
  }}]);

  const signalLabel=(rssi)=>rssi>-60?"Excellent":rssi>-75?"Bon":rssi>-85?"Faible":"Tres faible";
  const signalColor=(rssi)=>rssi>-60?"#00c896":rssi>-75?"#b88a00":"#d96a1f";

  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{flexDirection:"row",alignItems:"center",padding:20,paddingTop:52}}>
        <TouchableOpacity onPress={()=>navigation.goBack()} style={{marginRight:12}}>
          <Text style={{fontSize:16,color:"#00c896",fontWeight:"700"}}>?</Text>
        </TouchableOpacity>
        <View style={{flex:1}}>
          <Text style={{fontSize:22,fontWeight:"900",color:text}}>Connexion Appareil</Text>
          <Text style={{fontSize:12,color:text2}}>Bluetooth BLE � GSM/WiFi � Simulation</Text>
        </View>
      </View>

      {connectedDevice&&(
        <View style={{margin:16,marginTop:0,borderRadius:14,borderWidth:1,padding:14,backgroundColor:"#00c89615",borderColor:"#00c89640",flexDirection:"row",alignItems:"center",gap:10}}>
          <View style={{width:10,height:10,borderRadius:5,backgroundColor:"#00c896"}}/>
          <View style={{flex:1}}>
            <Text style={{fontSize:14,fontWeight:"700",color:"#00a878"}}>{connectedDevice.name}</Text>
            <Text style={{fontSize:11,color:"#00a878"}}>{connectionType?.toUpperCase()} � Actif{bleVitals.battery!=null?" � Batterie "+bleVitals.battery+"%":""}</Text>
          </View>
          <TouchableOpacity onPress={doDisconnect} style={{paddingHorizontal:10,paddingVertical:6,borderRadius:8,borderWidth:1,borderColor:"#d6304a40"}}>
            <Text style={{fontSize:12,color:"#d6304a",fontWeight:"700"}}>Deconnecter</Text>
          </TouchableOpacity>
        </View>
      )}

      {bleVitals.hr&&(
        <View style={{margin:16,marginTop:0,borderRadius:14,padding:14,backgroundColor:card,borderWidth:1,borderColor:border,flexDirection:"row",justifyContent:"space-around"}}>
          <View style={{alignItems:"center"}}><Text style={{fontSize:11,color:text2}}>FC</Text><Text style={{fontSize:24,fontWeight:"900",color:"#d96a1f"}}>{bleVitals.hr}</Text><Text style={{fontSize:10,color:text2}}>bpm</Text></View>
          <View style={{width:1,backgroundColor:border}}/>
          <View style={{alignItems:"center"}}><Text style={{fontSize:11,color:text2}}>SpO2</Text><Text style={{fontSize:24,fontWeight:"900",color:"#00c896"}}>{bleVitals.spo2||"--"}</Text><Text style={{fontSize:10,color:text2}}>%</Text></View>
        </View>
      )}

      <View style={{flexDirection:"row",padding:4,borderRadius:14,margin:16,marginTop:0,backgroundColor:card,elevation:1}}>
        {[["ble","Bluetooth"],["gsm","GSM/WiFi"],["sim","Simulation"]].map(([k,l])=>(
          <TouchableOpacity key={k} style={[{flex:1,paddingVertical:10,borderRadius:10,alignItems:"center"},mode===k&&{backgroundColor:"#00c896"}]} onPress={()=>setMode(k)}>
            <Text style={{fontSize:12,fontWeight:"700",color:mode===k?"white":text2}}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode==="ble"&&(
        <View style={{flex:1}}>
          <View style={{flexDirection:"row",gap:10,marginHorizontal:16,marginBottom:12}}>
            <TouchableOpacity style={{flex:1,padding:14,borderRadius:12,alignItems:"center",backgroundColor:scanning?"#d6304a":"#00c896"}}
              onPress={scanning?()=>{getBle().stopDeviceScan();setScanning(false);}:startScan}>
              {scanning?<ActivityIndicator color="white" size="small"/>:<Text style={{color:"white",fontWeight:"800",fontSize:14}}>Scanner Bluetooth</Text>}
            </TouchableOpacity>
          </View>
          {scanning&&<Text style={{textAlign:"center",color:text2,fontSize:12,marginBottom:8}}>Recherche en cours... (15s)</Text>}
          {devices.length===0&&!scanning&&(
            <View style={{flex:1,alignItems:"center",justifyContent:"center",gap:10,padding:30}}>
              <Text style={{fontSize:48}}>BT</Text>
              <Text style={{fontSize:16,fontWeight:"700",color:text2}}>Aucun appareil detecte</Text>
              <Text style={{fontSize:13,textAlign:"center",color:text2}}>Activez le Bluetooth sur votre montre et appuyez sur Scanner</Text>
            </View>
          )}
          <FlatList data={devices} keyExtractor={d=>d.id} contentContainerStyle={{paddingHorizontal:16,gap:10,paddingBottom:100}}
            renderItem={({item})=>(
              <TouchableOpacity style={{backgroundColor:card,borderRadius:14,borderWidth:1,borderColor:border,padding:14,flexDirection:"row",alignItems:"center",gap:12}} onPress={()=>connectBLE(item)} disabled={connecting}>
                <View style={{width:44,height:44,borderRadius:22,backgroundColor:"#00c89620",alignItems:"center",justifyContent:"center"}}>
                  <Text style={{fontSize:14,fontWeight:"900",color:"#00c896"}}>BT</Text>
                </View>
                <View style={{flex:1}}>
                  <Text style={{fontSize:14,fontWeight:"700",color:text}}>{item.name}</Text>
                  <Text style={{fontSize:11,marginTop:2,color:signalColor(item.rssi)}}>Signal: {signalLabel(item.rssi)} ({item.rssi} dBm)</Text>
                  <Text style={{fontSize:10,color:text2,marginTop:1}}>{item.id}</Text>
                </View>
                <View style={{paddingHorizontal:12,paddingVertical:6,borderRadius:10,backgroundColor:"#00c89620",borderWidth:1,borderColor:"#00c896"}}>
                  <Text style={{color:"#00c896",fontSize:12,fontWeight:"700"}}>Connecter</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {mode==="gsm"&&(
        <View style={{padding:16,gap:12}}>
          <View style={{backgroundColor:card,borderRadius:14,borderWidth:1,borderColor:border,padding:18,gap:10}}>
            <Text style={{fontSize:14,fontWeight:"700",color:text}}>URL de votre appareil ESP32/Arduino</Text>
            <TextInput style={{backgroundColor:bg,borderRadius:12,borderWidth:1.5,borderColor:border,padding:12,fontSize:14,color:text}} value={gsmUrl} onChangeText={setGsmUrl} placeholder="http://192.168.1.100:3000" placeholderTextColor={text2} autoCapitalize="none" autoCorrect={false}/>
            <Text style={{fontSize:11,color:text2}}>Format attendu: GET /vitals ? JSON avec spo2, hr, temp, resp</Text>
            <TouchableOpacity style={{padding:14,borderRadius:12,alignItems:"center",backgroundColor:"#00c896"}} onPress={connectGSM} disabled={connecting}>
              {connecting?<ActivityIndicator color="white" size="small"/>:<Text style={{color:"white",fontWeight:"800",fontSize:14}}>Connecter via WiFi/GSM</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {mode==="sim"&&(
        <View style={{padding:16}}>
          <View style={{backgroundColor:card,borderRadius:14,borderWidth:1,borderColor:border,padding:22,gap:12,alignItems:"center"}}>
            <Text style={{fontSize:16,fontWeight:"700",color:text}}>Mode Simulation</Text>
            <Text style={{fontSize:13,textAlign:"center",color:text2}}>Genere des donnees vitales aleatoires pour tester l'application</Text>
            <TouchableOpacity style={{padding:14,borderRadius:12,alignItems:"center",width:"100%",backgroundColor:"#00c896"}} onPress={startSim} disabled={connecting}>
              {connecting?<ActivityIndicator color="white" size="small"/>:<Text style={{color:"white",fontWeight:"800",fontSize:14}}>Demarrer Simulation</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {connecting&&(
        <View style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.6)",alignItems:"center",justifyContent:"center"}}>
          <View style={{backgroundColor:card,borderRadius:18,padding:30,alignItems:"center",gap:12}}>
            <ActivityIndicator size="large" color="#00c896"/>
            <Text style={{fontWeight:"700",color:text}}>Connexion en cours...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

