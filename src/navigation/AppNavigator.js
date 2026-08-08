import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import HomeScreen         from '../screens/HomeScreen';
import WatchScreen        from '../screens/WatchScreen';
import WatchPairingScreen from '../screens/WatchPairingScreen';
import ChatScreen         from '../screens/ChatScreen';
import RemindersScreen    from '../screens/RemindersScreen';
import ProfileScreen      from '../screens/ProfileScreen';
import AIScreen           from '../screens/AIScreen';

import { useStore } from '../store/useStore';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ===== ICONES ONGLETS =====
const ICONS = {
  Home:     { on:'🏠', off:'🏠' },
  Watch:    { on:'⌚', off:'⌚' },
  Chat:     { on:'💬', off:'💬' },
  AI:       { on:'🤖', off:'🤖' },
  Profile:  { on:'👤', off:'👤' },
};

// ===== MAIN TABS =====
function MainTabs() {
  const { theme } = useStore();
  const isDark = theme === 'dark';
  const bg     = isDark ? '#0d1829' : '#ffffff';
  const border = isDark ? '#1e3050' : '#eef2f7';
  const active = '#00c896';
  const inactive= isDark ? '#4d6a85' : '#9ca3af';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor:  border,
          borderTopWidth:  1,
          paddingBottom:   6,
          paddingTop:      6,
          height:          62,
        },
        tabBarActiveTintColor:   active,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: { fontSize:10, fontWeight:'700', marginTop:-2 },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: focused?22:18, opacity: focused?1:0.5 }}>
            {ICONS[route.name]?.on || '●'}
          </Text>
        ),
      })}>
      <Tab.Screen name="Home"    component={HomeScreen}    options={{ title:'Accueil' }} />
      <Tab.Screen name="Watch"   component={WatchScreen}   options={{ title:'Montre' }} />
      <Tab.Screen name="Chat"    component={ChatScreen}    options={{ title:'Messages' }} />
      <Tab.Screen name="AI"      component={AIScreen}      options={{ title:'Assistant' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title:'Profil' }} />
    </Tab.Navigator>
  );
}

// ===== APP NAVIGATOR (patient) =====
// NOTE : plus de NavigationContainer ici, et plus de logique d'auth —
// App.js (racine) pose deja le NavigationContainer et decide, via
// onAuthStateChanged + le role Firestore, quand afficher AppNavigator,
// ParentNavigator ou AuthScreen. Le faire ici aussi creait le
// "nested NavigationContainer" et une double ecoute Firebase.
export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown:false }}>
      <Stack.Screen name="MainTabs"    component={MainTabs} />
      <Stack.Screen name="WatchPairing" component={WatchPairingScreen}
        options={{
          headerShown:      true,
          headerTitle:      'Associer la montre',
          headerTintColor:  '#00c896',
          headerTitleStyle: { fontWeight:'800' },
        }}
      />
      <Stack.Screen name="Reminders" component={RemindersScreen}
        options={{
          headerShown:      true,
          headerTitle:      'Mes Rappels',
          headerTintColor:  '#00c896',
          headerTitleStyle: { fontWeight:'800' },
        }}
      />
    </Stack.Navigator>
  );
}