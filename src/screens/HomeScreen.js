import React,{useEffect,useRef,useState}from"react";
import{View,Text,ScrollView,TouchableOpacity,Animated,StatusBar,RefreshControl,Modal}from"react-native";
import{useStore}from"../store/useStore";
export default function HomeScreen({navigation}){
  const{vitals,alertStatus,userProfile,theme,connectedDevice,connectionType,setTheme}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const[date,setDate]=useState("");
  const[refreshing,setRefreshing]=useState(false);
  const[menuOpen,setMenuOpen]=useState(false);
  const pulse=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    setDate(new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}));
    Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1.06,duration:800,useNativeDriver:true}),Animated.timing(pulse,{toValue:1,duration:800,useNativeDriver:true})])).start();
  },[]);
  const risk=()=>{
    if(!vitals.spo2)return{label:"Inconnu",color:"#8093a3",bg:isLight?"#f0f4f8":"#1a2a3a",icon:"?"};
    if(vitals.spo2<88)return{label:"Critique",color:"#d6304a",bg:"#fde8ec",icon:"!"};
    if(vitals.spo2<92)return{label:"Eleve",color:"#d96a1f",bg:"#fef3e8",icon:"!"};
    if(vitals.spo2<95)return{label:"Modere",color:"#b88a00",bg:"#fefbe8",icon:"~"};
    return{label:"Faible",color:"#00a878",bg:isLight?"#e8faf5":"#0a2a20",icon:"v"};
  };
  const r=risk();
  const spo2=vitals.spo2||0;
  const spo2Color=spo2<88?"#d6304a":spo2<92?"#d96a1f":spo2<95?"#b88a00":"#00c896";
  const menuItems=[["Accueil","MainTabs"],["Mon Medecin","Chat"],["Mes Donnees","Vitaux"],["Montre","Watch"],["Rappels","Reminders"],["Reglages","Profile"]];
  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{flexDirection:"row",alignItems:"center",paddingHorizontal:16,paddingTop:48,paddingBottom:12,backgroundColor:card,borderBottomWidth:1,borderBottomColor:border}}>
        <TouchableOpacity onPress={()=>setMenuOpen(true)} style={{padding:6}}>
          <View style={{width:22,height:2,backgroundColor:text,marginBottom:5,borderRadius:2}}/>
          <View style={{width:16,height:2,backgroundColor:text,marginBottom:5,borderRadius:2}}/>
          <View style={{width:22,height:2,backgroundColor:text,borderRadius:2}}/>
        </TouchableOpacity>
        <View style={{flex:1,alignItems:"center"}}>
          <Text style={{fontSize:15,fontWeight:"900",color:"#00c896",letterSpacing:1}}>ASTHMA MONITORING</Text>
        </View>
        <TouchableOpacity onPress={()=>setTheme(isLight?"dark":"light")} style={{padding:6,borderRadius:20,backgroundColor:isLight?"#eef2f7":"#1e3050"}}>
          <Text style={{fontSize:16}}>{isLight?"N":"J"}</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={()=>setMenuOpen(false)}>
        <TouchableOpacity style={{flex:1,backgroundColor:"rgba(0,0,0,0.4)"}} activeOpacity={1} onPress={()=>setMenuOpen(false)}>
          <View style={{width:260,height:"100%",backgroundColor:card,padding:20,paddingTop:60}}>
            <TouchableOpacity onPress={()=>setMenuOpen(false)} style={{position:"absolute",top:20,right:20,padding:8}}>
              <Text style={{fontSize:20,color:text2}}>x</Text>
            </TouchableOpacity>
            <Text style={{fontSize:11,color:text2,fontWeight:"700",letterSpacing:1,marginBottom:16}}>ASTHMA MONITORING</Text>
            {menuItems.map(([label,screen])=>(
              <TouchableOpacity key={screen} onPress={()=>{setMenuOpen(false);navigation.navigate(screen);}} style={{padding:14,borderRadius:10,marginBottom:4}}>
                <Text style={{fontSize:15,fontWeight:"600",color:text}}>{label}</Text>
              </TouchableOpacity>
            ))}
            <View style={{position:"absolute",bottom:30,left:20,right:20}}>
              <Text style={{fontSize:12,color:text2}}>{userProfile?.name||"Patient"}</Text>
              <Text style={{fontSize:11,color:text2,marginTop:2}}>Patient · Asthmatique</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      <ScrollView contentContainerStyle={{paddingBottom:100}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);setTimeout(()=>setRefreshing(false),800);}} tintColor="#00c896"/>}>
        {alertStatus!=="normal"&&(
          <View style={{backgroundColor:alertStatus==="critical"?"#fde8ec":"#fef3e8",padding:12,paddingHorizontal:16}}>
            <Text style={{color:alertStatus==="critical"?"#d6304a":"#d96a1f",fontWeight:"800",fontSize:13,textAlign:"center"}}>
              {alertStatus==="critical"?"SpO2 CRITIQUE - Consultez un medecin!":"SpO2 basse - Surveillez votre respiration"}
            </Text>
          </View>
        )}
        <View style={{backgroundColor:isLight?"#e8faf5":"#0a2a20",margin:16,borderRadius:12,padding:10,flexDirection:"row",alignItems:"center",gap:8}}>
          <View style={{width:8,height:8,borderRadius:4,backgroundColor:"#00c896"}}/>
          <Text style={{fontSize:12,fontWeight:"700",color:"#00a878",flex:1}}>{connectedDevice?"Bracelet connecte · "+connectionType?.toUpperCase():"Tous vos parametres sont normaux"}</Text>
          <Text style={{fontSize:11,color:"#00a878"}}>Mis a jour</Text>
        </View>
        <View style={{flexDirection:"row",justifyContent:"space-around",paddingHorizontal:16,marginBottom:16}}>
          {[["Journal","Vitaux"],["RDV","Watch"],["Appel","Chat"],["Exporter","AI"]].map(([label,screen])=>(
            <TouchableOpacity key={label} onPress={()=>navigation.navigate(screen)} style={{alignItems:"center",gap:6}}>
              <View style={{width:52,height:52,borderRadius:14,backgroundColor:card,borderWidth:1,borderColor:border,alignItems:"center",justifyContent:"center",elevation:2}}>
                <Text style={{fontSize:13,fontWeight:"900",color:"#00c896"}}>{label[0]}</Text>
              </View>
              <Text style={{fontSize:11,fontWeight:"600",color:text2}}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{alignItems:"center",marginVertical:8}}>
          <Animated.View style={{transform:[{scale:pulse}]}}>
            <View style={{width:180,height:180,borderRadius:90,borderWidth:8,borderColor:spo2Color+"40",backgroundColor:card,alignItems:"center",justifyContent:"center",elevation:4}}>
              <View style={{position:"absolute",width:160,height:160,borderRadius:80,borderWidth:3,borderColor:spo2Color,borderStyle:"dashed"}}/>
              <Text style={{fontSize:11,fontWeight:"700",color:spo2Color,letterSpacing:1}}>SpO2</Text>
              <Text style={{fontSize:52,fontWeight:"900",color:spo2Color,lineHeight:58}}>{vitals.spo2||"--"}{vitals.spo2?"%":""}</Text>
              <View style={{flexDirection:"row",alignItems:"center",gap:4}}>
                <Text style={{fontSize:14,fontWeight:"700",color:text2}}>{vitals.hr||"--"} bpm</Text>
              </View>
            </View>
          </Animated.View>
        </View>
        <View style={{margin:16,borderRadius:16,padding:16,backgroundColor:r.bg,borderWidth:1,borderColor:r.color+"30"}}>
          <View style={{flexDirection:"row",alignItems:"center",gap:8,marginBottom:4}}>
            <View style={{width:32,height:32,borderRadius:8,backgroundColor:r.color+"20",alignItems:"center",justifyContent:"center"}}>
              <Text style={{fontSize:16,fontWeight:"900",color:r.color}}>{r.icon}</Text>
            </View>
            <Text style={{fontSize:18,fontWeight:"900",color:r.color}}>{r.label}</Text>
          </View>
          <Text style={{fontSize:12,fontWeight:"700",color:r.color,textTransform:"uppercase",letterSpacing:0.5}}>Niveau de Risque</Text>
          <Text style={{fontSize:12,color:r.color+"99",marginTop:2}}>{alertStatus==="normal"?"Aucune alerte detectee":"Attention requise"}</Text>
        </View>
        <View style={{flexDirection:"row",gap:10,marginHorizontal:16,marginBottom:16}}>
          {[["Temp","temp","C","#b88a00"],["Resp","resp","/min","#7c3aed"]].map(([label,key,unit,color])=>(
            <View key={key} style={{flex:1,backgroundColor:card,borderRadius:14,padding:14,borderWidth:1,borderColor:border,elevation:1}}>
              <Text style={{fontSize:11,color:text2,fontWeight:"600",marginBottom:4}}>{label}</Text>
              <Text style={{fontSize:26,fontWeight:"900",color}}>{vitals[key]!=null?(key==="temp"?vitals[key].toFixed(1):vitals[key]):"--"}<Text style={{fontSize:13,fontWeight:"400",color:text2}}> {unit}</Text></Text>
            </View>
          ))}
        </View>
        {!connectedDevice&&(
          <TouchableOpacity onPress={()=>navigation.navigate("Watch")} style={{margin:16,marginTop:0,borderRadius:14,borderWidth:1,borderStyle:"dashed",borderColor:"#00c896",padding:16,flexDirection:"row",alignItems:"center",gap:12,backgroundColor:isLight?"#e8faf5":"#0a2a20"}}>
            <View style={{flex:1}}>
              <Text style={{fontSize:14,fontWeight:"700",color:"#00a878"}}>Connecter un bracelet</Text>
              <Text style={{fontSize:12,color:"#00a878",marginTop:2,opacity:0.8}}>Bluetooth BLE ou GSM</Text>
            </View>
            <Text style={{fontSize:18,color:"#00c896"}}>›</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <TouchableOpacity onPress={()=>navigation.navigate("Chat")} style={{position:"absolute",bottom:80,right:20,width:52,height:52,borderRadius:26,backgroundColor:"#ff5252",alignItems:"center",justifyContent:"center",elevation:8}}>
        <Text style={{fontSize:22,color:"white",fontWeight:"900"}}>!</Text>
      </TouchableOpacity>
    </View>
  );
}
