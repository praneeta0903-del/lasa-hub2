import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { checkInventoryAvailability } from "@/context/OrderContext";
import { useColors } from "@/hooks/useColors";

interface ParsedItem { name: string; quantity: string; available: boolean; }

const SAMPLE_VOICE_ITEMS: ParsedItem[] = [
  { name: "Chilli Powder", quantity: "1 kg", available: true },
  { name: "Turmeric", quantity: "500 gm", available: true },
  { name: "Coconut Oil", quantity: "1 L", available: true },
  { name: "Salt", quantity: "2 kg", available: true },
  { name: "Milk Packet", quantity: "5 packets", available: false },
];

export default function VoiceOrderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(withTiming(1.15, { duration: 600 }), -1, true);
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startRecording = () => {
    setIsRecording(true);
    setRecordSeconds(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsProcessing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise((r) => setTimeout(r, 2000));
    const items = SAMPLE_VOICE_ITEMS.map(i => ({
      ...i,
      available: checkInventoryAvailability(i.name),
    }));
    setParsedItems(items);
    setIsProcessing(false);
  };

  const handleProceed = () => {
    if (!parsedItems) return;
    const encoded = encodeURIComponent(JSON.stringify(parsedItems));
    router.push(`/review?items=${encoded}&mode=voice` as any);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        entering={FadeInDown.delay(50).springify()}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), borderBottomColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Awaaz mein Bolo</Text>
        <View style={{ width: 38 }} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {!parsedItems && !isProcessing ? (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.recordSection}>
            <Text style={[styles.instruction, { color: colors.mutedForeground }]}>
              Button dabao aur order bolna shuru karo
            </Text>
            <Text style={[styles.example, { color: colors.mutedForeground }]}>
              Jaise: "5 kg dal, 2 liter tel, 3 kg cheeni..."
            </Text>

            <View style={styles.micContainer}>
              <Animated.View style={pulseStyle}>
                <TouchableOpacity
                  style={[
                    styles.micBtn,
                    { backgroundColor: isRecording ? colors.destructive : colors.primary },
                  ]}
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                  activeOpacity={0.9}
                >
                  <Feather name={isRecording ? "stop-circle" : "mic"} size={52} color="#FFF" />
                </TouchableOpacity>
              </Animated.View>
              {isRecording ? (
                <Animated.View entering={FadeIn.springify()} style={styles.recordingInfo}>
                  <View style={[styles.redDot, { backgroundColor: colors.destructive }]} />
                  <Text style={[styles.recordingTime, { color: colors.foreground }]}>
                    {formatTime(recordSeconds)}
                  </Text>
                  <Text style={[styles.recordingHint, { color: colors.mutedForeground }]}>
                    Bolna band karne ke liye chod do
                  </Text>
                </Animated.View>
              ) : (
                <Text style={[styles.micHint, { color: colors.mutedForeground }]}>
                  Dabaa ke rakhein aur bolein
                </Text>
              )}
            </View>
          </Animated.View>
        ) : isProcessing ? (
          <Animated.View entering={FadeIn.springify()} style={styles.processingSection}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.processingText, { color: colors.foreground }]}>
              AI sun raha hai...
            </Text>
            <Text style={[styles.processingSubText, { color: colors.mutedForeground }]}>
              Items list bana raha hai
            </Text>
          </Animated.View>
        ) : parsedItems ? (
          <Animated.View entering={FadeInDown.springify()} style={styles.resultSection}>
            <Text style={[styles.resultTitle, { color: colors.foreground }]}>
              {parsedItems.length} items mile
            </Text>
            {parsedItems.map((item, i) => (
              <View
                key={i}
                style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
                </View>
                <View style={[styles.dot, { backgroundColor: item.available ? colors.available : colors.unavailable }]} />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.proceedBtn, { backgroundColor: colors.primary }]}
              onPress={handleProceed}
              activeOpacity={0.85}
            >
              <Text style={styles.proceedBtnText}>Order Review Karo</Text>
              <Feather name="arrow-right" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setParsedItems(null); setRecordSeconds(0); }}
              style={styles.retakeBtn}
            >
              <Text style={[styles.retakeText, { color: colors.mutedForeground }]}>Dobara Record Karo</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16 },
  recordSection: { alignItems: "center", gap: 16 },
  instruction: { fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "center" },
  example: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", fontStyle: "italic" },
  micContainer: { alignItems: "center", gap: 20, marginTop: 20 },
  micBtn: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
  recordingInfo: { alignItems: "center", gap: 6 },
  redDot: { width: 10, height: 10, borderRadius: 5 },
  recordingTime: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  recordingHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  micHint: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 8 },
  processingSection: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, minHeight: 300 },
  processingText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  processingSubText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  resultSection: { gap: 10 },
  resultTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 4 },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemQty: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  proceedBtn: { height: 58, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 },
  proceedBtnText: { color: "#FFF", fontSize: 17, fontFamily: "Inter_700Bold" },
  retakeBtn: { alignItems: "center", paddingVertical: 12 },
  retakeText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
