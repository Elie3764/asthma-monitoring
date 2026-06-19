import React from"react";
import{View,Text,StyleSheet,FlatList,StatusBar,TouchableOpacity}from"react-native";
import{useStore}from"../store/useStore";
import{getTheme,getVitalColor}from"../utils/theme";
export default function VitauxScreen({navigation}){
  const{vitals,vitalsHistory,activeAlerts,theme}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const avg=(k)=>vitalsHistory.length?(vitalsHistory.reduce((s,v)=>s+(v[k]||0),0)/vitalsHistory.length).toFixed(k==="hr"?0:1):"--";
  const data=[...vitalsHistory].reverse().slice(0,100);
  const vitalsNow=[
    {label:"SpO2",value:vitals.spo2,unit:"%",key:"spo2",color:"#00c896",icon:"O2"},
    {label:"Freq. cardiaque",value:vitals.hr,unit:" bpm",key:"hr",color:"#d96a1f",icon:"HR"},
    {label:"Temperature",value:vitals.temp,unit:"°C",key:"temp",color:"#b88a00",icon:"T"},
    {label:"Respiration",value:vitals.resp,unit:"/min",key:"resp",color:"#7c3aed",icon:"RR"},
  ];
  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{flexDirection:"row",alignItems:"center",padding:20,paddingTop:52}}>
        <TouchableOpacity onPress={()=>navigation.goBack()} style={{marginRight:12}}>
          <Text style={{fontSize:16,color:"#00c896",fontWeight:"700"}}>←</Text>
        </TouchableOpacity>
        <Text style={{fontSize:22,fontWeight:"900",color:text,flex:1}}>Mes Donnees</Text>
        <View style={{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:10,paddingVertical:4,borderRadius:20,backgroundColor:"#00c89620"}}>
          <View style={{width:6,height:6,borderRadius:3,backgroundColor:"#00c896"}}/>
          <Text style={{fontSize:10,fontWeight:"800",color:"#00c896"}}>LIVE</Text>
        </View>
      </View>
      <View style={{flexDirection:"row",margin:16,marginTop:0,borderRadius:16,overflow:"hidden",backgroundColor:card,elevation:2}}>
        {[[avg("spo2")+"%","SpO2 moy.","#00c896"],[avg("hr")+" bpm","FC moy.","#d96a1f"],[activeAlerts.length+"","Alertes",activeAlerts.length>0?"#d6304a":"#00c896"]].map(([v,l,c],i)=>(
          <React.Fragment key={i}>
            {i>0&&<View style={{width:1,backgroundColor:border}}/>}
            <View style={{flex:1,alignItems:"center",padding:14}}>
              <Text style={{fontSize:22,fontWeight:"900",color:c}}>{v}</Text>
              <Text style={{fontSize:11,marginTop:2,color:text2}}>{l}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      <View style={{flexDirection:"row",flexWrap:"wrap",paddingHorizontal:12,gap:10,marginBottom:16}}>
        {vitalsNow.map(v=>(
          <View key={v.key} style={{width:"47%",backgroundColor:card,borderRadius:16,padding:14,elevation:1,borderWidth:1,borderColor:border}}>
            <View style={{width:36,height:36,borderRadius:10,backgroundColor:v.color+"20",alignItems:"center",justifyContent:"center",marginBottom:8}}>
              <Text style={{fontSize:12,fontWeight:"900",color:v.color}}>{v.icon}</Text>
            </View>
            <Text style={{fontSize:11,color:text2,fontWeight:"600"}}>{v.label}</Text>
            <Text style={{fontSize:28,fontWeight:"900",color:v.color,marginTop:2}}>
              {v.value!=null?(v.key==="temp"?v.value.toFixed(1):v.value):"--"}
              <Text style={{fontSize:13,fontWeight:"400",color:text2}}>{v.unit}</Text>
            </Text>
          </View>
        ))}
      </View>
      <Text style={{fontSize:11,fontWeight:"700",letterSpacing:1,marginHorizontal:16,marginBottom:8,color:text2}}>HISTORIQUE RECENT</Text>
      {data.length===0?(
        <View style={{flex:1,alignItems:"center",justifyContent:"center",gap:8}}>
          <Text style={{fontSize:48}}>-</Text>
          <Text style={{fontSize:16,fontWeight:"700",color:text2}}>Aucune donnee</Text>
          <Text style={{fontSize:13,textAlign:"center",color:text2,paddingHorizontal:30}}>Connectez une montre pour voir vos vitaux</Text>
          <TouchableOpacity onPress={()=>navigation.navigate("Watch")} style={{marginTop:8,paddingHorizontal:20,paddingVertical:10,borderRadius:12,backgroundColor:"#00c896"}}>
            <Text style={{color:"white",fontWeight:"700"}}>Connecter une montre</Text>
          </TouchableOpacity>
        </View>
      ):(
        <FlatList data={data} keyExtractor={(_,i)=>i.toString()} style={{flex:1}} contentContainerStyle={{paddingHorizontal:16,paddingBottom:100}}
          renderItem={({item})=>(
            <View style={{flexDirection:"row",alignItems:"center",borderRadius:12,borderWidth:1,padding:10,marginBottom:8,backgroundColor:card,borderColor:border}}>
              <Text style={{fontSize:10,fontFamily:"monospace",width:58,color:text2}}>{new Date(item.timestamp).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</Text>
              {[["O2","spo2","%","#00c896"],["HR","hr"," bpm","#d96a1f"],["RR","resp","/m","#7c3aed"],["T","temp","C","#b88a00"]].map(([ic,k,u,c])=>(
                <View key={k} style={{flex:1,alignItems:"center"}}>
                  <Text style={{fontSize:9,color:text2,fontWeight:"600"}}>{ic}</Text>
                  <Text style={{fontSize:12,fontWeight:"700",color:c}}>{item[k]!=null?(k==="temp"?item[k].toFixed(1):item[k]):"--"}{u}</Text>
                </View>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}
