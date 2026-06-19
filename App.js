import React,{useEffect,useState}from"react";
import{NavigationContainer}from"@react-navigation/native";
import{createNativeStackNavigator}from"@react-navigation/native-stack";
import auth from"@react-native-firebase/auth";
import firestore from"@react-native-firebase/firestore";
import{View,ActivityIndicator}from"react-native";
import{useStore}from"./src/store/useStore";
import AppNavigator from"./src/navigation/AppNavigator";
import AuthScreen from"./src/screens/AuthScreen";
const Stack=createNativeStackNavigator();
export default function App(){
  const{setUser,setUserProfile}=useStore();
  const[initializing,setInitializing]=useState(true);
  const[user,setLocalUser]=useState(null);
  useEffect(()=>{
    const unsub=auth().onAuthStateChanged(async u=>{
      setUser(u);
      setLocalUser(u);
      if(u){
        try{
          const snap=await firestore().collection("patients").doc(u.uid).get();
          if(snap.exists)setUserProfile(snap.data());
        }catch(e){}
      }
      if(initializing)setInitializing(false);
    });
    return unsub;
  },[]);
  if(initializing){
    return(
      <View style={{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#0d1829"}}>
        <ActivityIndicator size="large"color="#00c9a7"/>
      </View>
    );
  }
  return(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown:false}}>
        {user?(
          <Stack.Screen name="App"component={AppNavigator}/>
        ):(
          <Stack.Screen name="Auth"component={AuthScreen}/>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
