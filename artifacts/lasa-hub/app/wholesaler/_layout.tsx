import { Stack } from "expo-router";
import React from "react";

export default function WholesalerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
