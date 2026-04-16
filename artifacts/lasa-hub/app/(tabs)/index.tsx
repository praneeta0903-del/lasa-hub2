import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function KiranaHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Suprabhatam" : hour < 17 ? "Namaste" : "Shubh Sham";

  const handleScanList = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/scan-order" as any);
  };

  const handleVoiceOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/voice-order" as any);
  };

  const handleQuickOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/review?mode=quick" as any);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(50).springify()}
        style={[
          styles.header,
          {
            backgroundColor: colors.primary,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.shopNameText}>{user?.shopName ?? "Aapki Dukaan"}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Feather name="log-out" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
        <View style={styles.supplierRow}>
          <Feather name="truck" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.supplierText}>Supplier: Suresh Wholesale</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Action Label */}
        <Animated.Text
          entering={FadeInDown.delay(150).springify()}
          style={[styles.sectionLabel, { color: colors.foreground }]}
        >
          Order kaise dena hai?
        </Animated.Text>

        {/* Big Action Buttons */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleScanList}
            activeOpacity={0.82}
          >
            <View style={[styles.bigBtnIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="camera" size={44} color={colors.primary} />
            </View>
            <Text style={[styles.bigBtnTitle, { color: colors.foreground }]}>
              List ka Photo Lo
            </Text>
            <Text style={[styles.bigBtnSub, { color: colors.mutedForeground }]}>
              Haath se likhi list photo karo
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).springify()}>
          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleVoiceOrder}
            activeOpacity={0.82}
          >
            <View style={[styles.bigBtnIcon, { backgroundColor: colors.accent + "18" }]}>
              <Feather name="mic" size={44} color={colors.accent} />
            </View>
            <Text style={[styles.bigBtnTitle, { color: colors.foreground }]}>
              Awaaz mein Bolo
            </Text>
            <Text style={[styles.bigBtnSub, { color: colors.mutedForeground }]}>
              Microphone pe bolkar order karo
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Reorder */}
        <Animated.View entering={FadeInUp.delay(360).springify()}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={handleQuickOrder}
            activeOpacity={0.82}
          >
            <Feather name="refresh-cw" size={20} color={colors.accent} />
            <Text style={[styles.quickBtnText, { color: colors.accent }]}>
              Pichle order se dobara order karo
            </Text>
            <Feather name="chevron-right" size={18} color={colors.accent} />
          </TouchableOpacity>
        </Animated.View>

        {/* Tips */}
        <Animated.View entering={FadeInUp.delay(420).springify()} style={[styles.tipBox, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={16} color={colors.mutedForeground} />
          <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
            Order bhejne ke baad aapko SMS milega jab supplier confirm karega
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Voice Feedback FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent, bottom: insets.bottom + (Platform.OS === "web" ? 100 : 80) }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
        activeOpacity={0.85}
      >
        <Feather name="message-circle" size={24} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greetingText: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_400Regular" },
  shopNameText: { color: "#FFF", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  logoutBtn: { padding: 8 },
  supplierRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  supplierText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 12 },
  sectionLabel: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  bigBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  bigBtnIcon: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  bigBtnTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  bigBtnSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  quickBtn: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickBtnText: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  tipBox: { borderRadius: 12, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
