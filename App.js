import React,{useEffect,useState}from"react";
import{NavigationContainer}from"@react-navigation/native";
import{createNativeStackNavigator}from"@react-navigation/native-stack";
import auth from"@react-native-firebase/auth";
import firestore from"@react-native-firebase/firestore";
import{View,ActivityIndicator}from"react-native";
import{useStore}from"./src/store/useStore";
import AppNavigator from"./src/navigation/AppNavigator";
import ParentNavigator from"./src/navigation/ParentNavigator";
import AuthScreen from"./src/screens/AuthScreen";
import SplashScreen from"./src/screens/SplashScreen";
const Stack=createNativeStackNavigator();
export default function App(){
  const{setUser,setUserProfile,userProfile,loadPersistedData}=useStore();
  const[initializing,setInitializing]=useState(true);
  const[showSplash,setShowSplash]=useState(true);
  const[user,setLocalUser]=useState(null);
  const[role,setRole]=useState(null);
  useEffect(()=>{
    loadPersistedData();
    const t=setTimeout(()=>setShowSplash(false),2800);
    return()=>clearTimeout(t);
  },[]);
  useEffect(()=>{
    const unsub=auth().onAuthStateChanged(async u=>{
      setUser(u);
      setLocalUser(u);
      if(u){
        await checkRole(u.uid);
      }else{
        setRole(null);
      }
      if(initializing)setInitializing(false);
    });
    return unsub;
  },[]);
  const checkRole=async(uid)=>{
    try{
      const parentSnap=await firestore().collection("parents").doc(uid).get();
      if(parentSnap.exists){
        setUserProfile(parentSnap.data());
        setRole("parent");
        return;
      }
      const snap=await firestore().collection("patients").doc(uid).get();
      if(snap.exists){
        setUserProfile(snap.data());
        setRole("patient");
        return;
      }
    }catch(e){}
  };
  useEffect(()=>{
    if(user&&!role){
      const t=setTimeout(()=>checkRole(user.uid),800);
      return()=>clearTimeout(t);
    }
  },[user,role,userProfile]);

  if(showSplash||initializing){
    return<SplashScreen/>;
  }
  return(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown:false}}>
        {user&&role==="parent"?(
          <Stack.Screen name="ParentApp"component={ParentNavigator}/>
        ):user&&role==="patient"?(
          <Stack.Screen name="App"component={AppNavigator}/>
        ):(
          <Stack.Screen name="Auth"component={AuthScreen}/>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
