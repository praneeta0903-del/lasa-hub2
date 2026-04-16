import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  available: boolean;
  size?: "sm" | "md";
}

export function StockIndicator({ available, size = "md" }: Props) {
  const colors = useColors();
  const dotSize = size === "sm" ? 8 : 11;
  const fontSize = size === "sm" ? 11 : 13;

  return (
    <View style={styles.row}>
      <View style={[
        styles.dot,
        { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
        { backgroundColor: available ? colors.available : colors.unavailable }
      ]} />
      <Text style={[styles.label, { fontSize, color: available ? colors.available : colors.unavailable }]}>
        {available ? "Stock hai" : "Stock nahi"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { },
  label: { fontFamily: "Inter_500Medium" },
});
