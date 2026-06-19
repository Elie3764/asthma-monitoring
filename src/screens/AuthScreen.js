import React,{useState}from"react";
import{View,Text,StyleSheet,TextInput,TouchableOpacity,KeyboardAvoidingView,Platform,ScrollView,Alert,ActivityIndicator,StatusBar}from"react-native";
import auth from"@react-native-firebase/auth";
import firestore from"@react-native-firebase/firestore";
import{useStore}from"../store/useStore";
export default function AuthScreen(){
  const[mode,setMode]=useState("login");
  const[name,setName]=useState("");
  const[prenom,setPrenom]=useState("");
  const[age,setAge]=useState("");
  const[ville,setVille]=useState("");
  const[email,setEmail]=useState("");
  const[password,setPass]=useState("");
  const[showPass,setShowPass]=useState(false);
  const[phone,setPhone]=useState("");
  const[doctorEmail,setDoctorEmail]=useState("");
  const[accountType,setAccountType]=useState("patient");
  const[loading,setLoading]=useState(false);
  const{setUserProfile}=useStore();
  const doLogin=async()=>{
    if(!email||!password){Alert.alert("Champs requis");return;}
    setLoading(true);
    try{const c=await auth().signInWithEmailAndPassword(email.trim(),password);const s=await firestore().collection("patients").doc(c.user.uid).get();if(s.exists)setUserProfile(s.data());}
    catch(e){Alert.alert("Erreur",e.code==="auth/wrong-password"||e.code==="auth/invalid-credential"?"Email ou mot de passe incorrect":"Erreur connexion");}
    finally{setLoading(false);}
  };
  const doRegister=async()=>{
    if(!name||!email||!password){Alert.alert("Remplissez tous les champs");return;}
    if(password.length<6){Alert.alert("Mot de passe trop court");return;}
    setLoading(true);
    try{
      const c=await auth().createUserWithEmailAndPassword(email.trim(),password);
      const p={name:name+" "+prenom,firstName:prenom,lastName:name,age:age||"--",ville:ville||"Yaounde",email:email.trim(),phone,uid:c.user.uid,role:accountType,severity:"Modere persistant",online:true,doctorEmail:doctorEmail||"",createdAt:firestore.FieldValue.serverTimestamp()};
      await firestore().collection("patients").doc(c.user.uid).set(p);
      setUserProfile(p);
    }catch(e){Alert.alert("Erreur",e.code==="auth/email-already-in-use"?"Email deja utilise":"Erreur creation");}
    finally{setLoading(false);}
  };
  if(mode==="login"){return(
    <KeyboardAvoidingView style={s.c} behavior={Platform.OS==="ios"?"padding":"height"}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f7fb"/>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <View style={s.logoWrap}>
          <View style={s.logoBox}><Text style={{fontSize:36,color:"white",fontWeight:"900"}}>+</Text></View>
          <Text style={s.appName}>ASTHMA MONITORING</Text>
          <Text style={s.tagline}>Surveillez. Prevenez. Vivez.</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Se connecter</Text>
          <Text style={s.fl}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="votre@email.com" placeholderTextColor="#aaa" keyboardType="email-address" autoCapitalize="none"/>
          <Text style={s.fl}>Mot de passe</Text>
          <View style={{position:"relative",marginBottom:14}}>
            <TextInput style={[s.input,{marginBottom:0}]} value={password} onChangeText={setPass} placeholder="........" placeholderTextColor="#aaa" secureTextEntry={!showPass}/>
            <TouchableOpacity onPress={()=>setShowPass(!showPass)} style={{position:"absolute",right:14,top:14}}>
              <Text style={{color:"#00c896",fontSize:12,fontWeight:"700"}}>{showPass?"Cacher":"Voir"}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.btn,loading&&{opacity:.6}]} onPress={doLogin} disabled={loading}>
            {loading?<ActivityIndicator color="white" size="small"/>:<Text style={s.btnTxt}>SE CONNECTER</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{marginTop:16,alignItems:"center"}} onPress={()=>setMode("register")}>
            <Text style={{color:"#50657a",fontSize:14}}>Pas de compte ?  <Text style={{color:"#00c896",fontWeight:"700"}}>S'inscrire</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );}
  return(
    <KeyboardAvoidingView style={s.c} behavior={Platform.OS==="ios"?"padding":"height"}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f7fb"/>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <View style={{marginBottom:24}}>
          <Text style={{fontSize:28,fontWeight:"900",color:"#16242f"}}>Creer un compte</Text>
          <Text style={{fontSize:14,color:"#50657a",marginTop:4}}>Rejoignez la communaute ASTHMA MONITORING</Text>
        </View>
        <View style={s.card}>
          <View style={{flexDirection:"row",gap:10}}>
            <View style={{flex:1}}><Text style={s.fl}>Nom</Text><TextInput style={s.input} value={name} onChangeText={setName} placeholder="Essoung" placeholderTextColor="#aaa"/></View>
            <View style={{flex:1}}><Text style={s.fl}>Prenom</Text><TextInput style={s.input} value={prenom} onChangeText={setPrenom} placeholder="Ines" placeholderTextColor="#aaa"/></View>
          </View>
          <View style={{flexDirection:"row",gap:10}}>
            <View style={{flex:1}}><Text style={s.fl}>Age</Text><TextInput style={s.input} value={age} onChangeText={setAge} placeholder="25" placeholderTextColor="#aaa" keyboardType="numeric"/></View>
            <View style={{flex:1}}><Text style={s.fl}>Ville</Text><TextInput style={s.input} value={ville} onChangeText={setVille} placeholder="Yaounde" placeholderTextColor="#aaa"/></View>
          </View>
          <Text style={s.fl}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="lyka@gmail.com" placeholderTextColor="#aaa" keyboardType="email-address" autoCapitalize="none"/>
          <Text style={s.fl}>Mot de passe</Text>
          <View style={{position:"relative",marginBottom:14}}>
            <TextInput style={[s.input,{marginBottom:0}]} value={password} onChangeText={setPass} placeholder="........" placeholderTextColor="#aaa" secureTextEntry={!showPass}/>
            <TouchableOpacity onPress={()=>setShowPass(!showPass)} style={{position:"absolute",right:14,top:14}}>
              <Text style={{color:"#00c896",fontSize:12,fontWeight:"700"}}>{showPass?"Cacher":"Voir"}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.fl}>Type de compte</Text>
          <View style={[s.input,{padding:0,overflow:"hidden",marginBottom:14}]}>
            <View style={{flexDirection:"row"}}>
              {["patient","parent"].map(t=>(
                <TouchableOpacity key={t} onPress={()=>setAccountType(t)} style={{flex:1,padding:14,alignItems:"center",backgroundColor:accountType===t?"#00c896":"transparent"}}>
                  <Text style={{fontWeight:"700",color:accountType===t?"white":"#50657a",textTransform:"capitalize"}}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={s.fl}>Numero d'urgence (Parent)</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="683271688" placeholderTextColor="#aaa" keyboardType="phone-pad"/>
          <Text style={s.fl}>Email de votre medecin</Text>
          <TextInput style={[s.input,doctorEmail&&{borderColor:"#00c896"}]} value={doctorEmail} onChangeText={setDoctorEmail} placeholder="medecin@hopital.cm" placeholderTextColor="#aaa" keyboardType="email-address" autoCapitalize="none"/>
          <TouchableOpacity style={[s.btn,loading&&{opacity:.6},{marginTop:8}]} onPress={doRegister} disabled={loading}>
            {loading?<ActivityIndicator color="white" size="small"/>:<Text style={s.btnTxt}>S'INSCRIRE</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{marginTop:16,alignItems:"center"}} onPress={()=>setMode("login")}>
            <Text style={{color:"#50657a",fontSize:14}}>Deja un compte ?  <Text style={{color:"#00c896",fontWeight:"700"}}>Se connecter</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s=StyleSheet.create({
  c:{flex:1,backgroundColor:"#f4f7fb"},
  inner:{padding:24,paddingTop:60,paddingBottom:40},
  logoWrap:{alignItems:"center",marginBottom:32},
  logoBox:{width:72,height:72,borderRadius:20,backgroundColor:"#00c896",alignItems:"center",justifyContent:"center",marginBottom:12,elevation:8},
  appName:{fontSize:22,fontWeight:"900",color:"#16242f",letterSpacing:2},
  tagline:{fontSize:13,color:"#50657a",marginTop:4,fontStyle:"italic"},
  card:{backgroundColor:"#ffffff",borderRadius:20,padding:20,elevation:2},
  cardTitle:{fontSize:22,fontWeight:"900",color:"#16242f",marginBottom:20},
  fl:{fontSize:12,fontWeight:"600",color:"#50657a",marginBottom:6},
  input:{backgroundColor:"#f4f7fb",borderRadius:12,padding:14,fontSize:15,color:"#16242f",borderWidth:1.5,borderColor:"#eef2f7",marginBottom:14},
  btn:{backgroundColor:"#00c896",borderRadius:14,padding:16,alignItems:"center",marginTop:4,elevation:4},
  btnTxt:{color:"white",fontWeight:"900",fontSize:15,letterSpacing:1},
});


