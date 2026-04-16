import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type Step = "role" | "phone" | "otp";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sendOtp, verifyOtp, generatedOtp, selectedRole, setRole } = useAuth();

  const [step, setStep] = useState<Step>("role");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRoleSelect = (role: UserRole) => {
    setRole(role);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep("phone");
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      setError("10 digit mobile number daalo");
      return;
    }
    setError("");
    setLoading(true);
    await sendOtp(phone);
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep("otp");
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 4) {
      setError("4 digit OTP daalo");
      return;
    }
    setError("");
    setLoading(true);
    const ok = await verifyOtp(phone, otp, selectedRole);
    setLoading(false);
    if (!ok) {
      setError("Galat OTP hai. Dobara try karo.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (selectedRole === "wholesaler") {
      router.replace("/wholesaler");
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20), paddingBottom: insets.bottom + 34 }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Feather name="shopping-bag" size={36} color="#FFF" />
          </View>
          <Text style={[styles.appName, { color: colors.primary }]}>Lasa Hub</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Aapka apna order system
          </Text>
        </Animated.View>

        {/* Step: Role Selection */}
        {step === "role" && (
          <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              Aap kaun hain?
            </Text>
            <TouchableOpacity
              style={[styles.roleBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleRoleSelect("kirana")}
              activeOpacity={0.85}
            >
              <Feather name="home" size={28} color="#FFF" />
              <Text style={styles.roleBtnText}>Kirana Dukaan</Text>
              <Text style={styles.roleBtnSub}>Main order karta hoon</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, styles.roleBtnSecondary, { backgroundColor: colors.accent, borderColor: colors.border }]}
              onPress={() => handleRoleSelect("wholesaler")}
              activeOpacity={0.85}
            >
              <Feather name="truck" size={28} color="#FFF" />
              <Text style={styles.roleBtnText}>Wholesale Dukaan</Text>
              <Text style={styles.roleBtnSub}>Main order bharta hoon</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Step: Phone */}
        {step === "phone" && (
          <Animated.View entering={FadeInUp.springify()} style={styles.stepBox}>
            <TouchableOpacity onPress={() => setStep("role")} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              Mobile number daalo
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {selectedRole === "kirana" ? "Kirana dukaan" : "Wholesale dukaan"} ke liye OTP bhejenge
            </Text>
            <View style={[styles.phoneInputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.countryCode, { color: colors.foreground }]}>+91</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TextInput
                style={[styles.phoneInput, { color: colors.foreground }]}
                placeholder="Mobile number"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(t) => { setPhone(t); setError(""); }}
                autoFocus
              />
            </View>
            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSendOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>OTP Bhejo</Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Test: koi bhi 10 digit number use karo, OTP: 1234
            </Text>
          </Animated.View>
        )}

        {/* Step: OTP */}
        {step === "otp" && (
          <Animated.View entering={FadeInUp.springify()} style={styles.stepBox}>
            <TouchableOpacity onPress={() => setStep("phone")} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>OTP daalo</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              +91 {phone} pe 4-digit code bheja gaya
            </Text>
            {generatedOtp ? (
              <View style={[styles.otpPreviewBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.otpPreviewLabel, { color: colors.mutedForeground }]}>Demo OTP:</Text>
                <Text style={[styles.otpPreviewCode, { color: colors.primary }]}>{generatedOtp}</Text>
              </View>
            ) : null}
            <TextInput
              style={[styles.otpInput, { borderColor: colors.primary, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="- - - -"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={4}
              value={otp}
              onChangeText={(t) => { setOtp(t); setError(""); }}
              textAlign="center"
              autoFocus
            />
            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleVerifyOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Login Karo</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSendOtp} style={styles.resendBtn}>
              <Text style={[styles.resendText, { color: colors.primary }]}>Dobara OTP bhejo</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center" },
  logoSection: { alignItems: "center", marginBottom: 48 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  appName: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  stepBox: { gap: 14 },
  backBtn: { marginBottom: 4, alignSelf: "flex-start" },
  stepTitle: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 30 },
  stepSub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  roleBtn: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  roleBtnSecondary: {},
  roleBtnText: { color: "#FFF", fontSize: 20, fontFamily: "Inter_700Bold" },
  roleBtnSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular" },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    height: 60,
    paddingHorizontal: 16,
  },
  countryCode: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  divider: { width: 1, height: 28, marginHorizontal: 12 },
  phoneInput: { flex: 1, fontSize: 20, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  primaryBtn: {
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: "#FFF", fontSize: 18, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  otpPreviewBox: { borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  otpPreviewLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  otpPreviewCode: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 4 },
  otpInput: {
    height: 72,
    borderWidth: 2,
    borderRadius: 16,
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: 12,
  },
  resendBtn: { alignItems: "center", paddingVertical: 8 },
  resendText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
