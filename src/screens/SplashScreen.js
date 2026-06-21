import React,{useEffect,useRef}from"react";
import{View,Text,StyleSheet,Animated,StatusBar}from"react-native";
import LungLogo from"../components/LungLogo";
export default function SplashScreen(){
  const pulseAnim=useRef(new Animated.Value(1)).current;
  const rotateAnim=useRef(new Animated.Value(0)).current;
  const fadeAnim=useRef(new Animated.Value(0)).current;
  const fadeAnim2=useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim,{toValue:1.1,duration:1100,useNativeDriver:true}),
        Animated.timing(pulseAnim,{toValue:1,duration:1100,useNativeDriver:true}),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim,{toValue:1,duration:1600,useNativeDriver:true}),
        Animated.timing(rotateAnim,{toValue:-1,duration:1600,useNativeDriver:true}),
        Animated.timing(rotateAnim,{toValue:0,duration:1600,useNativeDriver:true}),
      ])
    ).start();
    Animated.timing(fadeAnim,{toValue:1,duration:700,delay:200,useNativeDriver:true}).start();
    Animated.timing(fadeAnim2,{toValue:1,duration:700,delay:600,useNativeDriver:true}).start();
  },[]);

  const rotateInterpolate=rotateAnim.interpolate({inputRange:[-1,1],outputRange:["-4deg","4deg"]});

  return(
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff"/>
      <Animated.View style={[s.logoCircle,{transform:[{scale:pulseAnim},{rotate:rotateInterpolate}]}]}>
        <LungLogo size={90}/>
      </Animated.View>
      <Animated.Text style={[s.appName,{opacity:fadeAnim}]}>ASTHMA MONITORING</Animated.Text>
      <Animated.View style={{opacity:fadeAnim2,alignItems:"center"}}>
        <Text style={s.role}>Suivi respiratoire intelligent</Text>
        <Text style={s.welcome}>Bienvenue</Text>
      </Animated.View>
      <View style={s.dotsRow}>
        <View style={[s.dot,{opacity:0.4}]}/>
        <View style={[s.dot,{opacity:0.7}]}/>
        <View style={[s.dot,{opacity:1}]}/>
      </View>
      <Text style={s.footer}>SUPPTIC · ENSP Yaounde · Cameroun</Text>
    </View>
  );
}
const s=StyleSheet.create({
  container:{flex:1,backgroundColor:"#ffffff",alignItems:"center",justifyContent:"center"},
  logoCircle:{width:130,height:130,borderRadius:65,backgroundColor:"#eefaf7",alignItems:"center",justifyContent:"center",borderWidth:3,borderColor:"#4fc3b0",elevation:8,marginBottom:28,shadowColor:"#4fc3b0",shadowOpacity:0.3,shadowRadius:20,shadowOffset:{width:0,height:8}},
  appName:{fontSize:24,fontWeight:"900",color:"#16242f",letterSpacing:2,marginBottom:10},
  role:{fontSize:13,color:"#50657a",marginBottom:6,fontStyle:"italic"},
  welcome:{fontSize:16,color:"#34b39e",fontWeight:"700",marginBottom:30},
  dotsRow:{flexDirection:"row",gap:8,position:"absolute",bottom:80},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:"#34b39e"},
  footer:{position:"absolute",bottom:30,fontSize:11,color:"#8093a3"},
});
