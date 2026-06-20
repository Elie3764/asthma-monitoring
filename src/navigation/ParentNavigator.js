import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View } from "react-native";
import { useStore } from "../store/useStore";
import ParentDashboardScreen from "../screens/ParentDashboardScreen";
import ParentForumScreen from "../screens/ParentForumScreen";
import ParentAlertsScreen from "../screens/ParentAlertsScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused, color }) {
  const icons = { "Suivi":"S", "Forum":"F", "Alertes":"A" };
  return (
    <View style={{ alignItems:"center", gap:2, paddingTop:4 }}>
      <View style={{ width:28, height:28, borderRadius:8, backgroundColor:focused?"#00c89620":"transparent", alignItems:"center", justifyContent:"center" }}>
        <Text style={{ fontSize:12, fontWeight:"900", color:focused?"#00c896":color }}>{icons[label]}</Text>
      </View>
      <Text style={{ fontSize:9, fontWeight:focused?"800":"500", color:focused?"#00c896":color }}>{label}</Text>
    </View>
  );
}

export default function ParentNavigator() {
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
      <Tab.Screen name="Suivi" component={ParentDashboardScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Suivi" focused={focused} color={color}/> }}/>
      <Tab.Screen name="Forum" component={ParentForumScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Forum" focused={focused} color={color}/> }}/>
      <Tab.Screen name="Alertes" component={ParentAlertsScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon label="Alertes" focused={focused} color={color}/> }}/>
    </Tab.Navigator>
  );
}
