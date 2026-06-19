import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Text style={styles.title}>ASTHMA MONITORING</Text>
        <Text style={styles.sub}>App connectee avec succes !</Text>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1565C0" },
  title: { fontSize: 24, fontWeight: "bold", color: "#FFF", marginBottom: 10 },
  sub: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
});
