import React,{useState}from"react";
import{View,Text,ScrollView,TouchableOpacity,StatusBar,TextInput,ActivityIndicator,Alert}from"react-native";
import{useStore}from"../store/useStore";
export default function AIScreen({navigation}){
  const{theme,vitals,aiAnalysis,aiLoading,setAiAnalysis,setAiLoading}=useStore();
  const isLight=theme==="light";
  const bg=isLight?"#f4f7fb":"#0d1829";
  const card=isLight?"#ffffff":"#111f35";
  const text=isLight?"#16242f":"#e8f4ff";
  const text2=isLight?"#50657a":"#8ba8c4";
  const border=isLight?"#eef2f7":"#1e3050";
  const[question,setQuestion]=useState("");
  const suggestions=["Mon SpO2 est-il normal ?","Que faire lors d'une crise ?","Mes medicaments sont-ils adaptes ?","Quand consulter un medecin ?"];
  const analyze=async(q)=>{
    const prompt=q||("Analyse ces vitaux d'asthme: SpO2="+vitals.spo2+"%, FC="+vitals.hr+"bpm, Temp="+vitals.temp+"C, Resp="+vitals.resp+"/min. Donne une analyse courte et des conseils pratiques en francais.");
    setAiLoading(true);
    setAiAnalysis(null);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:500,messages:[{role:"user",content:"Tu es un assistant medical specialise en asthme. "+prompt}]})
      });
      const d=await res.json();
      setAiAnalysis(d.content?.[0]?.text||"Analyse indisponible");
    }catch{setAiAnalysis("Erreur de connexion. Verifiez votre internet.");}
    finally{setAiLoading(false);}
  };
  return(
    <View style={{flex:1,backgroundColor:bg}}>
      <StatusBar barStyle={isLight?"dark-content":"light-content"} backgroundColor={bg}/>
      <View style={{flexDirection:"row",alignItems:"center",padding:20,paddingTop:52}}>
        <TouchableOpacity onPress={()=>navigation.goBack()} style={{marginRight:12}}>
          <Text style={{fontSize:16,color:"#00c896",fontWeight:"700"}}>←</Text>
        </TouchableOpacity>
        <View style={{flex:1}}>
          <Text style={{fontSize:22,fontWeight:"900",color:text}}>Analyse IA</Text>
          <Text style={{fontSize:12,color:text2}}>Powered by Claude AI · SUPPTIC ENSP</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:120}}>
        <View style={{backgroundColor:card,borderRadius:16,padding:16,marginBottom:16,elevation:2}}>
          <Text style={{fontSize:12,fontWeight:"700",color:text2,marginBottom:12,letterSpacing:1}}>VOS VITAUX ACTUELS</Text>
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:10}}>
            {[["O2",vitals.spo2,"%","#00c896"],["HR",vitals.hr," bpm","#d96a1f"],["T",vitals.temp,"C","#b88a00"],["RR",vitals.resp,"/min","#7c3aed"]].map(([ic,v,u,c])=>(
              <View key={ic} style={{flex:1,minWidth:"40%",backgroundColor:c+"15",borderRadius:12,padding:10,alignItems:"center"}}>
                <Text style={{fontSize:10,fontWeight:"700",color:c}}>{ic}</Text>
                <Text style={{fontSize:20,fontWeight:"900",color:c}}>{v!=null?(ic==="T"?v.toFixed(1):v):"--"}<Text style={{fontSize:11}}>{u}</Text></Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={()=>analyze(null)} disabled={aiLoading} style={{marginTop:14,backgroundColor:"#00c896",borderRadius:12,padding:14,alignItems:"center",flexDirection:"row",justifyContent:"center",gap:8}}>
            {aiLoading?<ActivityIndicator color="white" size="small"/>:<Text style={{color:"white",fontWeight:"900",fontSize:14}}>Analyser mes vitaux avec l'IA</Text>}
          </TouchableOpacity>
        </View>
        {aiAnalysis&&(
          <View style={{backgroundColor:card,borderRadius:16,padding:16,marginBottom:16,elevation:2,borderWidth:1,borderColor:"#00c89630"}}>
            <Text style={{fontSize:12,fontWeight:"700",color:"#00c896",marginBottom:10,letterSpacing:1}}>RESULTAT DE L'ANALYSE</Text>
            <Text style={{fontSize:14,lineHeight:22,color:text}}>{aiAnalysis}</Text>
          </View>
        )}
        <View style={{backgroundColor:card,borderRadius:16,padding:16,elevation:2}}>
          <Text style={{fontSize:12,fontWeight:"700",color:text2,marginBottom:12,letterSpacing:1}}>POSER UNE QUESTION</Text>
          <Text style={{fontSize:12,color:text2,marginBottom:10}}>Suggestions :</Text>
          <View style={{gap:8,marginBottom:14}}>
            {suggestions.map(s=>(
              <TouchableOpacity key={s} onPress={()=>analyze(s)} style={{backgroundColor:bg,borderRadius:12,padding:12,borderWidth:1,borderColor:border}}>
                <Text style={{fontSize:13,color:text}}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{flexDirection:"row",gap:10}}>
            <TextInput style={{flex:1,backgroundColor:bg,borderRadius:12,padding:12,fontSize:14,color:text,borderWidth:1.5,borderColor:border}} value={question} onChangeText={setQuestion} placeholder="Votre question..." placeholderTextColor={text2} multiline/>
            <TouchableOpacity onPress={()=>{if(question.trim()){analyze(question);setQuestion("");}}} style={{width:44,height:44,borderRadius:22,backgroundColor:"#00c896",alignItems:"center",justifyContent:"center",alignSelf:"flex-end"}}>
              <Text style={{color:"white",fontWeight:"900",fontSize:16}}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{fontSize:11,color:text2,textAlign:"center",marginTop:16,lineHeight:18}}>Analyse informative uniquement. En cas d'urgence, consultez un medecin.{"\n"}SUPPTIC · ENSP Yaounde · Cameroun</Text>
      </ScrollView>
    </View>
  );
}
