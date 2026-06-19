import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { useStore } from "../store/useStore";
import HomeScreen from "../screens/HomeScreen";
import VitauxScreen from "../screens/VitauxScreen";
import WatchScreen from "../screens/WatchScreen";
import ChatScreen from "../screens/ChatScreen";
import AIScreen from "../screens/AIScreen";
import RemindersScreen from "../screens/RemindersScreen";
import ProfileScreen from "../screens/ProfileScreen";
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
function TabIcon({ label, focused, color }) {
  return (
    <View style={{ alignItems:"center", gap:2, paddingTop:4 }}>
      <View style={{ width:28, height:28, borderRadius:8, backgroundColor:focused?"#00c89620":"transparent", alignItems:"center", justifyContent:"center" }}>
        <Text style={{ fontSize:12, fontWeight:"900", color:focused?"#00c896":color }}>{label[0]}</Text>
      </View>
      <Text style={{ fontSize:9, fontWeight:focused?"800":"500", color:focused?"#00c896":color }}>{label}</Text>
    </View>
  );
}
function MainTabs() {
  const { theme } = useStore();
  const isLight = theme === "light";
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: isLight ? "#ffffff" : "#111f35",
          borderTopColor: isLight ? "#eef2f7" : "#1e3050",
          borderTopWidth: 1,
          height: 65,
          paddingBottom: 8,
          elevation: 10,
        },
        tabBarActiveTintColor: "#00c896",
        tabBarInactiveTintColor: isLight ? "#8093a3" : "#4d6a85",
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Sante" focused={focused} color={color}/> }}/>
      <Tab.Screen name="Chat" component={ChatScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Medecin" focused={focused} color={color}/> }}/>
      <Tab.Screen name="AI" component={AIScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Forum" focused={focused} color={color}/> }}/>
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Reglages" focused={focused} color={color}/> }}/>
    </Tab.Navigator>
  );
}
export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Vitaux" component={VitauxScreen} />
      <Stack.Screen name="Watch" component={WatchScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
    </Stack.Navigator>
  );
}
