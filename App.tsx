import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { requireNativeModule } from "expo-modules-core";
import { useEffect } from "react";

const Counter = requireNativeModule("counter");

export default function App() {
  useEffect(() => {
    Counter.setCount(10);
  }, []);
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
