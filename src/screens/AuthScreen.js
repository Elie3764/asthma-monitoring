import React,{useState,useEffect}from"react";
import{View,Text,StyleSheet,TextInput,TouchableOpacity,KeyboardAvoidingView,Platform,ScrollView,Alert,ActivityIndicator,StatusBar,Modal,FlatList}from"react-native";
import auth from"@react-native-firebase/auth";
import firestore from"@react-native-firebase/firestore";
import{useStore}from"../store/useStore";
const VILLES=["Yaounde","Douala","Bafoussam","Garoua","Bamenda","Maroua","Ngaoundere","Bertoua","Ebolowa","Buea"];
export default function AuthScreen(){
  const[mode,setMode]=useState("login");
  const[name,setName]=useState("");
  const[prenom,setPrenom]=useState("");
  const[age,setAge]=useState("");
  const[ville,setVille]=useState("Yaounde");
  const[villePicker,setVillePicker]=useState(false);
  const[email,setEmail]=useState("");
  const[password,setPass]=useState("");
  const[showPass,setShowPass]=useState(false);
  const[phone,setPhone]=useState("");
  const[parentPhone,setParentPhone]=useState("");
  const[selectedDoctor,setSelectedDoctor]=useState(null);
  const[doctorPicker,setDoctorPicker]=useState(false);
  const[availableDoctors,setAvailableDoctors]=useState([]);
  const[loadingDoctors,setLoadingDoctors]=useState(false);
  const[accountType,setAccountType]=useState("patient");
  const[loading,setLoading]=useState(false);
  const{setUserProfile,setUser}=useStore();

  useEffect(()=>{
    if(accountType==="patient"){
      fetchAvailableDoctors(ville);
    }
  },[ville,accountType]);

  const fetchAvailableDoctors=async(v)=>{
    setLoadingDoctors(true);
    setSelectedDoctor(null);
    try{
      const snap=await firestore().collection("doctors").where("ville","==",v).get();
      const list=[];
      snap.forEach(d=>{
        const data=d.data();
        const count=data.patientCount||0;
        if(count<7)list.push({id:d.id,...data,patientCount:count});
      });
      setAvailableDoctors(list);
    }catch(e){setAvailableDoctors([]);}
    finally{setLoadingDoctors(false);}
  };

  const doLogin=async()=>{
    if(!email||!password){Alert.alert("Champs requis");return;}
    setLoading(true);
    try{
      const c=await auth().signInWithEmailAndPassword(email.trim(),password);
      const parentSnap=await firestore().collection("parents").doc(c.user.uid).get();
      if(parentSnap.exists){setUserProfile(parentSnap.data());}
      else{
        const s=await firestore().collection("patients").doc(c.user.uid).get();
        if(s.exists)setUserProfile(s.data());
      }
    }catch(e){Alert.alert("Erreur",e.code==="auth/wrong-password"||e.code==="auth/invalid-credential"?"Email ou mot de passe incorrect":"Erreur connexion");}
    finally{setLoading(false);}
  };

  const doRegisterPatient=async()=>{
    if(!name||!email||!password){Alert.alert("Remplissez tous les champs");return;}
    if(password.length<6){Alert.alert("Mot de passe trop court");return;}
    if(!selectedDoctor){Alert.alert("Choisissez un medecin","Selectionnez un medecin disponible dans votre ville");return;}
    setLoading(true);
    try{
      const c=await auth().createUserWithEmailAndPassword(email.trim(),password);
      const p={name:name+" "+prenom,firstName:prenom,lastName:name,age:age||"--",ville,email:email.trim(),phone,uid:c.user.uid,role:"patient",severity:"Modere persistant",online:true,doctorId:selectedDoctor.id,doctorEmail:selectedDoctor.email||"",doctorName:selectedDoctor.name||"",createdAt:firestore.FieldValue.serverTimestamp()};
      await firestore().collection("patients").doc(c.user.uid).set(p);
      await firestore().collection("doctors").doc(selectedDoctor.id).update({patientCount:firestore.FieldValue.increment(1)});
      setUserProfile(p);
    }catch(e){Alert.alert("Erreur",e.code==="auth/email-already-in-use"?"Email deja utilise":"Erreur creation");}
    finally{setLoading(false);}
  };

  const doRegisterParent=async()=>{
    if(!name||!email||!password||!parentPhone){Alert.alert("Remplissez tous les champs, y compris votre numero");return;}
    if(password.length<6){Alert.alert("Mot de passe trop court");return;}
    setLoading(true);
    try{
      const cleanPhone=parentPhone.replace(/\s/g,"");
      const patientsSnap=await firestore().collection("patients").get();
      let linkedPatient=null;
      patientsSnap.forEach(doc=>{
        const d=doc.data();
        if(d.phone&&d.phone.replace(/\s/g,"")===cleanPhone){
          linkedPatient={id:doc.id,...d};
        }
      });
      if(!linkedPatient){
        Alert.alert("Patient introuvable","Aucun patient n'a ce numero comme contact d'urgence. Verifiez avec votre proche que le numero est bien enregistre.");
        setLoading(false);
        return;
      }
      const c=await auth().createUserWithEmailAndPassword(email.trim(),password);
      const p={name:name+" "+prenom,firstName:prenom,lastName:name,email:email.trim(),phone:parentPhone,uid:c.user.uid,role:"parent",linkedPatientId:linkedPatient.id,linkedPatientName:linkedPatient.name,createdAt:firestore.FieldValue.serverTimestamp()};
      await firestore().collection("parents").doc(c.user.uid).set(p);
      setUserProfile(p);
      setUser(c.user);
      Alert.alert("Connecte !","Vous suivez maintenant "+linkedPatient.name);
    }catch(e){Alert.alert("Erreur",e.code==="auth/email-already-in-use"?"Email deja utilise":"Erreur creation: "+e.message);}
    finally{setLoading(false);}
  };
  const doRegister=()=>accountType==="patient"?doRegisterPatient():doRegisterParent();

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
          <Text style={{fontSize:14,color:"#50657a",marginTop:4}}>Rejoignez la communaute Asthma Monitoring</Text>
        </View>
        <View style={s.card}>
          <Text style={s.fl}>Type de compte</Text>
          <View style={[s.input,{padding:0,overflow:"hidden",marginBottom:14}]}>
            <View style={{flexDirection:"row"}}>
              {[["patient","Patient"],["parent","Parent/Proche"]].map(([t,l])=>(
                <TouchableOpacity key={t} onPress={()=>setAccountType(t)} style={{flex:1,padding:14,alignItems:"center",backgroundColor:accountType===t?"#00c896":"transparent"}}>
                  <Text style={{fontWeight:"700",color:accountType===t?"white":"#50657a"}}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{flexDirection:"row",gap:10}}>
            <View style={{flex:1}}><Text style={s.fl}>Nom</Text><TextInput style={s.input} value={name} onChangeText={setName} placeholder="Essoung" placeholderTextColor="#aaa"/></View>
            <View style={{flex:1}}><Text style={s.fl}>Prenom</Text><TextInput style={s.input} value={prenom} onChangeText={setPrenom} placeholder="Ines" placeholderTextColor="#aaa"/></View>
          </View>
          {accountType==="patient"&&(
            <View style={{flexDirection:"row",gap:10}}>
              <View style={{flex:1}}><Text style={s.fl}>Age</Text><TextInput style={s.input} value={age} onChangeText={setAge} placeholder="25" placeholderTextColor="#aaa" keyboardType="numeric"/></View>
              <View style={{flex:1}}>
                <Text style={s.fl}>Ville</Text>
                <TouchableOpacity style={s.input} onPress={()=>setVillePicker(true)}>
                  <Text style={{color:"#16242f",fontSize:15}}>{ville}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <Text style={s.fl}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="email@gmail.com" placeholderTextColor="#aaa" keyboardType="email-address" autoCapitalize="none"/>
          <Text style={s.fl}>Mot de passe</Text>
          <View style={{position:"relative",marginBottom:14}}>
            <TextInput style={[s.input,{marginBottom:0}]} value={password} onChangeText={setPass} placeholder="........" placeholderTextColor="#aaa" secureTextEntry={!showPass}/>
            <TouchableOpacity onPress={()=>setShowPass(!showPass)} style={{position:"absolute",right:14,top:14}}>
              <Text style={{color:"#00c896",fontSize:12,fontWeight:"700"}}>{showPass?"Cacher":"Voir"}</Text>
            </TouchableOpacity>
          </View>
          {accountType==="patient"?(
            <>
              <Text style={s.fl}>Numero d'urgence (Parent)</Text>
              <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="683271688" placeholderTextColor="#aaa" keyboardType="phone-pad"/>
              <Text style={s.fh}>Ce numero permettra a votre proche de se connecter et suivre vos donnees</Text>
              <Text style={[s.fl,{marginTop:14}]}>Medecin (dans votre ville)</Text>
              <TouchableOpacity style={[s.input,{minHeight:50,justifyContent:"center"}]} onPress={()=>setDoctorPicker(true)}>
                {loadingDoctors?(
                  <ActivityIndicator size="small" color="#00c896"/>
                ):selectedDoctor?(
                  <View>
                    <Text style={{color:"#16242f",fontSize:14,fontWeight:"700"}}>{selectedDoctor.name}</Text>
                    <Text style={{color:"#50657a",fontSize:12}}>{selectedDoctor.specialty} - {selectedDoctor.hospital}</Text>
                  </View>
                ):(
                  <Text style={{color:"#aaa",fontSize:14}}>{availableDoctors.length===0?"Aucun medecin disponible dans cette ville":"Selectionner un medecin"}</Text>
                )}
              </TouchableOpacity>
            </>
          ):(
            <>
              <Text style={s.fl}>Votre numero de telephone</Text>
              <TextInput style={s.input} value={parentPhone} onChangeText={setParentPhone} placeholder="683271688" placeholderTextColor="#aaa" keyboardType="phone-pad"/>
              <Text style={s.fh}>Ce numero doit correspondre au "numero d'urgence" enregistre par votre proche patient</Text>
            </>
          )}
          <TouchableOpacity style={[s.btn,loading&&{opacity:.6},{marginTop:16}]} onPress={doRegister} disabled={loading}>
            {loading?<ActivityIndicator color="white" size="small"/>:<Text style={s.btnTxt}>{accountType==="patient"?"S'INSCRIRE":"SE CONNECTER A MON PROCHE"}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{marginTop:16,alignItems:"center"}} onPress={()=>setMode("login")}>
            <Text style={{color:"#50657a",fontSize:14}}>Deja un compte ?  <Text style={{color:"#00c896",fontWeight:"700"}}>Se connecter</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={villePicker} transparent animationType="slide" onRequestClose={()=>setVillePicker(false)}>
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"}}>
          <View style={{backgroundColor:"white",borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:"60%"}}>
            <Text style={{fontSize:18,fontWeight:"900",padding:20,paddingBottom:10}}>Choisir une ville</Text>
            <FlatList data={VILLES} keyExtractor={v=>v} renderItem={({item})=>(
              <TouchableOpacity style={{padding:16,borderBottomWidth:1,borderBottomColor:"#eef2f7"}} onPress={()=>{setVille(item);setVillePicker(false);}}>
                <Text style={{fontSize:15,color:"#16242f",fontWeight:ville===item?"800":"400"}}>{item}</Text>
              </TouchableOpacity>
            )}/>
          </View>
        </View>
      </Modal>

      <Modal visible={doctorPicker} transparent animationType="slide" onRequestClose={()=>setDoctorPicker(false)}>
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"}}>
          <View style={{backgroundColor:"white",borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:"70%",padding:20}}>
            <Text style={{fontSize:18,fontWeight:"900",marginBottom:14}}>Medecins a {ville}</Text>
            {availableDoctors.length===0?(
              <Text style={{color:"#50657a",textAlign:"center",paddingVertical:30}}>Aucun medecin disponible actuellement dans cette ville</Text>
            ):(
              <FlatList data={availableDoctors} keyExtractor={d=>d.id} renderItem={({item})=>(
                <TouchableOpacity style={{padding:14,borderBottomWidth:1,borderBottomColor:"#eef2f7",flexDirection:"row",alignItems:"center",justifyContent:"space-between"}} onPress={()=>{setSelectedDoctor(item);setDoctorPicker(false);}}>
                  <View>
                    <Text style={{fontSize:15,fontWeight:"700",color:"#16242f"}}>{item.name}</Text>
                    <Text style={{fontSize:12,color:"#50657a"}}>{item.specialty} - {item.hospital}</Text>
                  </View>
                  <Text style={{fontSize:11,color:"#00c896",fontWeight:"700"}}>{item.patientCount}/7</Text>
                </TouchableOpacity>
              )}/>
            )}
            <TouchableOpacity onPress={()=>setDoctorPicker(false)} style={{marginTop:14,padding:14,alignItems:"center"}}>
              <Text style={{color:"#50657a",fontWeight:"700"}}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
const s=StyleSheet.create({
  c:{flex:1,backgroundColor:"#f4f7fb"},
  inner:{padding:24,paddingTop:60,paddingBottom:40},
  logoWrap:{alignItems:"center",marginBottom:32},
  logoBox:{width:72,height:72,borderRadius:20,backgroundColor:"#00c896",alignItems:"center",justifyContent:"center",marginBottom:12,elevation:8},
  appName:{fontSize:20,fontWeight:"900",color:"#16242f",letterSpacing:1},
  tagline:{fontSize:13,color:"#50657a",marginTop:4,fontStyle:"italic"},
  card:{backgroundColor:"#ffffff",borderRadius:20,padding:20,elevation:2},
  cardTitle:{fontSize:22,fontWeight:"900",color:"#16242f",marginBottom:20},
  fl:{fontSize:12,fontWeight:"600",color:"#50657a",marginBottom:6},
  fh:{fontSize:11,color:"#999",marginTop:4,marginBottom:4},
  input:{backgroundColor:"#f4f7fb",borderRadius:12,padding:14,fontSize:15,color:"#16242f",borderWidth:1.5,borderColor:"#eef2f7",marginBottom:14},
  btn:{backgroundColor:"#00c896",borderRadius:14,padding:16,alignItems:"center",marginTop:4,elevation:4},
  btnTxt:{color:"white",fontWeight:"900",fontSize:14,letterSpacing:0.5},
});
