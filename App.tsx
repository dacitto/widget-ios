import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import Counter from "./modules/counter";

export default function App() {
  const [count, setCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncCount = async (nextCount: number) => {
    setCount(nextCount);
    setSyncError(null);

    try {
      await Counter.setCount(nextCount);
    } catch (error) {
      setSyncError("Sync failed. Please try again.");
      console.error("Failed to sync counter to widget:", error);
    }
  };

  useEffect(() => {
    const initializeCounter = async () => {
      try {
        const initialCount = await Counter.getCount();
        setCount(typeof initialCount === "number" ? initialCount : 0);
      } catch (error) {
        setCount(0);
        console.error("Failed to load counter from shared storage:", error);
      }
    };

    initializeCounter();
  }, []);

  const handleIncrement = async () => {
    await syncCount(count + 1);
  };

  const handleDecrement = async () => {
    await syncCount(Math.max(0, count - 1));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.count}>{count}</Text>
      <View style={styles.controls}>
        <Pressable
          style={[styles.button, count === 0 && styles.buttonDisabled]}
          onPress={handleDecrement}
          disabled={count === 0}
        >
          <Text style={styles.buttonText}>-</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={handleIncrement}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
      {syncError ? <Text style={styles.errorText}>{syncError}</Text> : null}
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
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  count: {
    fontSize: 64,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "#46b3a8",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    color: "#fff",
    fontSize: 36,
    lineHeight: 40,
  },
  errorText: {
    color: "#b00020",
    fontSize: 14,
  },
});
