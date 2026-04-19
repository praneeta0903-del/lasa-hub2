import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { checkInventoryAvailability } from "@/context/OrderContext";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { apiPost } from "@/constants/api";

interface ParsedItem { name: string; quantity: string; available: boolean; }

const FALLBACK_ITEMS: ParsedItem[] = [
  { name: "Chilli Powder", quantity: "1 kg", available: true },
  { name: "Turmeric", quantity: "500 gm", available: true },
  { name: "Coconut Oil", quantity: "1 L", available: true },
  { name: "Salt", quantity: "2 kg", available: true },
];

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function getSpeechLang(lang: string) {
  if (lang === "te") return "te-IN";
  if (lang === "hi") return "hi-IN";
  return "en-IN";
}

export default function VoiceOrderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);

  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (Platform.OS === "web") {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      setSpeechSupported(!!SpeechRec);
    }
  }, []);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(withTiming(1.18, { duration: 550 }), -1, true);
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startRecording = () => {
    setIsRecording(true);
    setTranscript("");
    setRecordSeconds(0);
    setParseError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);

    if (Platform.OS === "web") {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = getSpeechLang(language);
        rec.onresult = (e: any) => {
          let final = "";
          for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
          }
          if (final) setTranscript(final.trim());
        };
        rec.start();
        recognitionRef.current = rec;
      }
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    let finalTranscript = transcript;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      await new Promise(r => setTimeout(r, 500));
      finalTranscript = transcript;
    }

    if (!finalTranscript.trim()) {
      // No speech detected — use demo items
      setParseError("No speech detected. Showing demo items.");
      const items = FALLBACK_ITEMS.map(i => ({ ...i, available: checkInventoryAvailability(i.name) }));
      setParsedItems(items);
      return;
    }

    setIsProcessing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const result = await apiPost("/api/ai/parse-voice", { transcript: finalTranscript });
      if (result.items && Array.isArray(result.items) && result.items.length > 0) {
        const items: ParsedItem[] = result.items.map((i: any) => ({
          name: i.name ?? "Item",
          quantity: i.quantity ?? "1",
          available: checkInventoryAvailability(i.name ?? ""),
        }));
        setParsedItems(items);
      } else {
        throw new Error("No items parsed");
      }
    } catch (err: any) {
      setParseError(`AI parsing failed: ${err?.message ?? "unknown error"}. Showing demo data.`);
      const items = FALLBACK_ITEMS.map(i => ({ ...i, available: checkInventoryAvailability(i.name) }));
      setParsedItems(items);
    }
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("voiceTitle")}</Text>
        <View style={{ width: 38 }} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {!parsedItems && !isProcessing ? (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.recordSection}>
            {Platform.OS === "web" && !speechSupported && (
              <View style={[styles.warnBox, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
                <Feather name="alert-triangle" size={16} color="#F59E0B" />
                <Text style={styles.warnText}>Speech recognition not supported in this browser. Try Chrome.</Text>
              </View>
            )}
            <Text style={[styles.instruction, { color: colors.mutedForeground }]}>{t("holdToRecord")}</Text>
            <Text style={[styles.example, { color: colors.mutedForeground }]}>{t("voiceExample")}</Text>

            {transcript ? (
              <View style={[styles.transcriptBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="mic" size={14} color={colors.primary} />
                <Text style={[styles.transcriptText, { color: colors.foreground }]}>{transcript}</Text>
              </View>
            ) : null}

            <View style={styles.micContainer}>
              <Animated.View style={pulseStyle}>
                <TouchableOpacity
                  style={[styles.micBtn, { backgroundColor: isRecording ? colors.destructive : colors.primary }]}
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
                  <Text style={[styles.recordingTime, { color: colors.foreground }]}>{formatTime(recordSeconds)}</Text>
                  <Text style={[styles.recordingHint, { color: colors.mutedForeground }]}>{t("releaseToStop")}</Text>
                </Animated.View>
              ) : (
                <Text style={[styles.micHint, { color: colors.mutedForeground }]}>{t("holdToRecord")}</Text>
              )}
            </View>
          </Animated.View>
        ) : isProcessing ? (
          <Animated.View entering={FadeIn.springify()} style={styles.processingSection}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.processingText, { color: colors.foreground }]}>{t("processing")}</Text>
            <Text style={[styles.processingSubText, { color: colors.mutedForeground }]}>{t("processingSub")}</Text>
            {transcript ? (
              <View style={[styles.transcriptBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.transcriptText, { color: colors.mutedForeground }]}>"{transcript}"</Text>
              </View>
            ) : null}
          </Animated.View>
        ) : parsedItems ? (
          <Animated.View entering={FadeInDown.springify()} style={styles.resultSection}>
            {parseError && (
              <View style={[styles.warnBox, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
                <Feather name="alert-triangle" size={16} color="#F59E0B" />
                <Text style={styles.warnText}>{parseError}</Text>
              </View>
            )}
            <Text style={[styles.resultTitle, { color: colors.foreground }]}>
              {parsedItems.length} {t("itemsFound")}
            </Text>
            {parsedItems.map((item, i) => (
              <View key={i} style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
                </View>
                <View style={[styles.dot, { backgroundColor: item.available ? colors.available : colors.unavailable }]} />
              </View>
            ))}
            <TouchableOpacity style={[styles.proceedBtn, { backgroundColor: colors.primary }]} onPress={handleProceed} activeOpacity={0.85}>
              <Text style={styles.proceedBtnText}>{t("reviewTitle")}</Text>
              <Feather name="arrow-right" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setParsedItems(null); setTranscript(""); setRecordSeconds(0); setParseError(null); }} style={styles.retakeBtn}>
              <Text style={[styles.retakeText, { color: colors.mutedForeground }]}>{t("reRecord")}</Text>
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
  example: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", fontStyle: "italic", paddingHorizontal: 20 },
  warnBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, width: "100%" },
  warnText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#92400E" },
  transcriptBox: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start", width: "100%" },
  transcriptText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic" },
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
