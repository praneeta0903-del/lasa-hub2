import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { LANGUAGES, type Language } from "@/constants/translations";
import { LasaLogo } from "@/components/LasaLogo";

type Step = "language" | "auth_choice" | "role" | "phone" | "otp" | "name";
type AuthIntent = "login" | "register" | null;

/**
 * Strip everything that isn't a digit. Used as the gatekeeper on the
 * phone input so alphabets / spaces / symbols never reach state.
 * Also caps at 10 because India mobile numbers are exactly 10 digits.
 */
function digitsOnly(raw: string, max = 10): string {
  return String(raw ?? "").replace(/\D/g, "").slice(0, max);
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sendOtp, verifyOtp, completeProfile, loginExistingUser, generatedOtp, otpDeliveryStatus, selectedRole, setRole } = useAuth();
  const { setLanguage, t, language } = useLanguage();

  const [step, setStep] = useState<Step>("language");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  // Shop / delivery address captured during registration. Becomes
  // the default delivery address on the review screen forever after.
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Track whether the user has explicitly tapped a language tile this
  // session. The LanguageContext defaults to "te" so it can render
  // strings before the user picks, but the visual highlight should
  // only appear AFTER an explicit tap — never on first load.
  const [hasPickedLanguage, setHasPickedLanguage] = useState(false);
  // Whether the user wants to log in (existing account) or register
  // (new account). Drives whether we show the role picker (register
  // only) and whether we show "not found / already exists" hints
  // after the OTP step.
  const [intent, setIntent] = useState<AuthIntent>(null);

  const handleLanguageSelect = async (lang: Language) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHasPickedLanguage(true);
    await setLanguage(lang);
    setStep("auth_choice");
  };

  const handleAuthChoice = (which: "login" | "register") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIntent(which);
    // Login flow skips role selection — the role comes from the
    // existing user record. Register flow needs the role first
    // so completeProfile knows whether to create a kirana or wholesaler.
    setStep(which === "login" ? "phone" : "role");
  };

  const handleRoleSelect = (role: UserRole) => {
    setRole(role);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep("phone");
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      setError(t("enterMobile"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await sendOtp(phone);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("otp");
    } catch (err: any) {
      // Server returns a precise message + retryAfterSec for each rate-limit
      // reason (cooldown / phone_limit / ip_limit). Prefer the server message
      // verbatim — it's already user-friendly and tells the user exactly how
      // long to wait. Only fall back to a generic message when nothing came
      // through (e.g. network down).
      const msg = String(err?.message ?? "");
      if (msg) {
        setError(msg);
      } else if (/network|fetch|failed to fetch/i.test(msg)) {
        setError("Couldn't reach the server. Check your internet and try again.");
      } else {
        setError("Couldn't send OTP. Please try again.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 4) {
      setError(t("enterOtp"));
      return;
    }
    setError("");
    setLoading(true);
    const ok = await verifyOtp(phone, otp, selectedRole);
    if (!ok) {
      setLoading(false);
      setError(t("wrongOtp"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // After OTP verifies, check whether an account already exists for
    // this phone. Then branch on `intent`:
    //   - "login"    : an account MUST exist. If it doesn't, prompt
    //                  the user to Register instead.
    //   - "register" : if the account already exists, log them in
    //                  (forgive the wrong button — better UX than
    //                  blocking). Otherwise continue to name step.
    let existingUser: import("@/context/AuthContext").User | null = null;
    try {
      const result = await import("@/constants/api").then(m =>
        m.apiGet<{ user: import("@/context/AuthContext").User }>(`/api/users/${encodeURIComponent(phone)}`),
      );
      existingUser = result.user ?? null;
    } catch {
      // 404 = user doesn't exist. Other errors = network — treat as
      // "no user" so we don't get stuck.
      existingUser = null;
    }

    if (existingUser) {
      // Role mismatch always blocks regardless of intent.
      if (intent === "register" && existingUser.role !== selectedRole) {
        setLoading(false);
        setError(`This number is already registered as a ${existingUser.role}. Tap Login instead.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      // Login flow: just use the stored role from the server, ignore
      // selectedRole (which was never set for the login intent path).
      await loginExistingUser(existingUser);
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(existingUser.role === "wholesaler" ? "/wholesaler" as any : "/(tabs)");
      return;
    }

    // No existing user. If they tapped Login, they're in the wrong flow.
    if (intent === "login") {
      setLoading(false);
      setError("No account found for this number. Please go back and tap Register instead.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Register flow + no existing user → continue to name step.
    setLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep("name");
  };

  const handleCompleteName = async () => {
    if (!name.trim()) {
      setError(language === "te" ? "మీ పేరు వేయండి" : language === "hi" ? "अपना नाम डालें" : "Please enter your name");
      return;
    }
    // Address validation: must be at least 10 chars AND contain at
    // least one digit OR three alphabetic chars. Catches the
    // "...... " / "aa" / "1" junk cases without being so strict that
    // a 3-line Telugu address fails.
    const addrTrimmed = address.trim();
    if (!addrTrimmed || addrTrimmed.length < 10 || !/[\w\dऀ-ॿఀ-౿]{3,}/.test(addrTrimmed)) {
      setError(
        language === "te" ? "మీ షాప్ చిరునామా వేయండి (కనీసం 10 అక్షరాలు)"
        : language === "hi" ? "अपना दुकान का पता डालें (कम से कम 10 अक्षर)"
        : "Please enter your shop address (at least 10 characters)",
      );
      return;
    }
    setLoading(true);
    await completeProfile(phone, selectedRole, name.trim(), addrTrimmed);
    setLoading(false);
    if (selectedRole === "wholesaler") {
      router.replace("/wholesaler" as any);
    } else {
      router.replace("/(tabs)");
    }
  };

  const nameLabel = language === "te" ? "మీ పేరు" : language === "hi" ? "आपका नाम" : "Your Name";
  const namePlaceholder = language === "te" ? "పేరు వేయండి" : language === "hi" ? "नाम डालें" : "Enter your name";
  const nameBtn = language === "te" ? "ముందుకు వెళ్ళండి" : language === "hi" ? "आगे बढ़ें" : "Continue";
  const nameGreeting = language === "te" ? "OTP ధృవీకరించబడింది! మీ పేరు వేయండి." : language === "hi" ? "OTP सही है! अपना नाम डालें।" : "OTP verified! Please enter your name.";

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24), paddingBottom: insets.bottom + 34 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo — extra-large on the language step (the very first
            screen a new user sees) and still generous on subsequent
            steps. Sizes are bumped beyond the visible artwork because
            the JPEG has white padding around the sticker that
            resizeMode="contain" preserves — so a 220px container only
            shows ~140px of actual red sticker. Tune these numbers if
            the source artwork is ever re-exported with a tighter crop. */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.logoSection}>
          <LasaLogo size={step === "language" ? 220 : 150} />
          <Text style={[styles.appName, { color: colors.primary }]}>Lasa Hub</Text>
          {step !== "language" && (
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>{t("appTagline")}</Text>
          )}
        </Animated.View>

        {/* ── Step 0: Language ── */}
        {step === "language" && (
          <Animated.View entering={FadeInUp.delay(160).springify()} style={styles.stepBox}>
            <Text style={[styles.langTitle, { color: colors.foreground }]}>
              Choose language / भाषा / భాష
            </Text>
            {LANGUAGES.map((lang, i) => (
              <Animated.View key={lang.code} entering={FadeInDown.delay(220 + i * 80).springify()}>
                <TouchableOpacity
                  style={[
                    styles.langBtn,
                    {
                      // Only highlight a tile if the user has explicitly
                      // tapped one this session. Otherwise we'd auto-show
                      // the LanguageContext default (Telugu) or whatever
                      // was last stored in AsyncStorage — both look like
                      // we're pre-deciding for the user.
                      backgroundColor: hasPickedLanguage && language === lang.code ? colors.primary : colors.card,
                      borderColor: hasPickedLanguage && language === lang.code ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleLanguageSelect(lang.code)}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.langNative, { color: hasPickedLanguage && language === lang.code ? "#FFF" : colors.foreground }]}>
                    {lang.native}
                  </Text>
                  <Text style={[styles.langEnglish, { color: hasPickedLanguage && language === lang.code ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
                    {lang.label}
                  </Text>
                  {hasPickedLanguage && language === lang.code && <Feather name="check" size={20} color="#FFF" />}
                </TouchableOpacity>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {/* ── Step 0.5: Login or Register ── */}
        {step === "auth_choice" && (
          <Animated.View entering={FadeInUp.springify()} style={styles.stepBox}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              {language === "te" ? "మీరు ఇప్పటికే ఖాతా కలిగి ఉన్నారా?" : language === "hi" ? "क्या आपका पहले से अकाउंट है?" : "Welcome to Lasa Hub"}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {language === "te" ? "మీ ఖాతా లేకుంటే 'రిజిస్టర్' నొక్కండి" : language === "hi" ? "नया अकाउंट बनाने के लिए 'रजिस्टर' दबाएं" : "Tap Login if you already have an account, Register if you're new"}
            </Text>
            {/* LOGIN — existing user, skips role + name step. Server
                lookup after OTP decides which dashboard to send them to. */}
            <TouchableOpacity
              style={[styles.roleBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleAuthChoice("login")}
              activeOpacity={0.85}
            >
              <Feather name="log-in" size={28} color="#FFF" />
              <Text style={styles.roleBtnText}>
                {language === "te" ? "లాగిన్" : language === "hi" ? "लॉगिन" : "Login"}
              </Text>
              <Text style={styles.roleBtnSub}>
                {language === "te" ? "నాకు ఇప్పటికే ఖాతా ఉంది" : language === "hi" ? "मेरा अकाउंट है" : "I already have an account"}
              </Text>
            </TouchableOpacity>
            {/* REGISTER — new user, goes through role → phone → OTP → name. */}
            <TouchableOpacity
              style={[styles.roleBtn, { backgroundColor: colors.accent }]}
              onPress={() => handleAuthChoice("register")}
              activeOpacity={0.85}
            >
              <Feather name="user-plus" size={28} color="#FFF" />
              <Text style={styles.roleBtnText}>
                {language === "te" ? "రిజిస్టర్" : language === "hi" ? "रजिस्टर" : "Register"}
              </Text>
              <Text style={styles.roleBtnSub}>
                {language === "te" ? "నేను కొత్తవాడిని" : language === "hi" ? "मैं नया हूँ" : "I'm new here"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep("language")} style={styles.backLink}>
              <Feather name="globe" size={14} color={colors.mutedForeground} />
              <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>
                {language === "te" ? "భాష మార్చు" : language === "hi" ? "भाषा बदलें" : "Change language"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Step 1: Role ── (register flow only — login flow skips this) */}
        {step === "role" && (
          <Animated.View entering={FadeInUp.springify()} style={styles.stepBox}>
            <TouchableOpacity onPress={() => setStep("auth_choice")} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>{t("whoAreYou")}</Text>
            <TouchableOpacity
              style={[styles.roleBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleRoleSelect("kirana")}
              activeOpacity={0.85}
            >
              <Feather name="home" size={30} color="#FFF" />
              <Text style={styles.roleBtnText}>{t("kiranaDukaan")}</Text>
              <Text style={styles.roleBtnSub}>{t("iOrderGoods")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, { backgroundColor: colors.accent }]}
              onPress={() => handleRoleSelect("wholesaler")}
              activeOpacity={0.85}
            >
              <Feather name="truck" size={30} color="#FFF" />
              <Text style={styles.roleBtnText}>{t("wholesaleDukaan")}</Text>
              <Text style={styles.roleBtnSub}>{t("iFulfillOrders")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep("language")} style={styles.backLink}>
              <Feather name="globe" size={14} color={colors.mutedForeground} />
              <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>
                {language === "te" ? "భాష మార్చు" : language === "hi" ? "भाषा बदलें" : "Change language"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Step 2: Phone ── */}
        {step === "phone" && (
          <Animated.View entering={FadeInUp.springify()} style={styles.stepBox}>
            <TouchableOpacity
              onPress={() => {
                // Login flow never visited the role step, so back goes
                // to the auth choice. Register flow goes back to role.
                setStep(intent === "login" ? "auth_choice" : "role");
              }}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>{t("enterMobile")}</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>{t("otpWillBeSent")}</Text>
            <View style={[styles.phoneInputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.countryCode, { color: colors.foreground }]}>+91</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TextInput
                style={[styles.phoneInput, { color: colors.foreground }]}
                placeholder="XXXXXXXXXX"
                placeholderTextColor={colors.mutedForeground}
                // number-pad blocks the letter row on iOS soft keyboards.
                // phone-pad still allows letters on some Android variants;
                // the digitsOnly sanitizer below is the real guarantee.
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChangeText={(v) => {
                  // Strip non-digits and cap at 10 — this is the only place
                  // the state ever changes, so even paste / autofill / web
                  // keyboards that ignore keyboardType can't sneak in junk.
                  const cleaned = digitsOnly(v, 10);
                  setPhone(cleaned);
                  setError("");
                }}
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
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{t("sendOtp")}</Text>}
            </TouchableOpacity>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t("testHint")}</Text>
          </Animated.View>
        )}

        {/* ── Step 3: OTP ── */}
        {step === "otp" && (
          <Animated.View entering={FadeInUp.springify()} style={styles.stepBox}>
            <TouchableOpacity onPress={() => setStep("phone")} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>{t("enterOtp")}</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {t("otpSentTo")} +91 {phone}
            </Text>
            {generatedOtp ? (
              <Animated.View entering={FadeIn.springify()} style={[styles.otpPreviewBox, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B", borderWidth: 1 }]}>
                {/* TOP LINE — describes what just happened. The previous
                    version was a hardcoded "Couldn't send SMS" which
                    looked like a contradiction when Twilio actually
                    accepted the message. Now it's truthful per status. */}
                <Text style={[styles.otpPreviewLabel, { color: "#92400E" }]}>
                  {otpDeliveryStatus === "sent"
                    ? language === "te"
                      ? "SMS పంపబడింది. టెస్ట్ కోసం OTP కూడా ఇక్కడ చూపబడింది:"
                      : language === "hi"
                      ? "SMS भेज दिया गया। टेस्ट के लिए OTP यहाँ भी दिखाया जा रहा है:"
                      : "SMS was sent. OTP is also shown here for testing:"
                    : language === "te"
                    ? "SMS పంపలేకపోయాము — టెస్ట్ కోసం OTP:"
                    : language === "hi"
                    ? "SMS नहीं भेज सके — टेस्ट के लिए OTP:"
                    : "Couldn't send SMS — fallback OTP for testing:"}
                </Text>
                <Text style={[styles.otpPreviewCode, { color: "#92400E" }]}>{generatedOtp}</Text>
                {/* BOTTOM LINE — what to do about it. Each branch points
                    the operator at the actual fix location so launches
                    debug faster. */}
                <Text style={{ fontSize: 10, color: "#92400E", marginTop: 4, fontFamily: "Inter_400Regular" }}>
                  {otpDeliveryStatus === "skipped"
                    ? "Server hasn't been given Twilio credentials yet — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER on the backend host."
                    : otpDeliveryStatus === "failed"
                    ? "Twilio rejected the send. Common causes: trial account (the number isn't in Verified Caller IDs), DLT template not registered for India SMS, or the From number is wrong. Check Twilio Console → Monitor → Logs."
                    : otpDeliveryStatus === "quota"
                    ? "Server-side daily Twilio cap reached. Raise TWILIO_DAILY_LIMIT env var on the backend, or wait until tomorrow."
                    : otpDeliveryStatus === "sent"
                    ? "Dev mode: OTP is shown above for testing because SHOW_OTP_IN_RESPONSE is true on the server. Set it to false in production so only the SMS contains the OTP."
                    : "Showing fallback OTP because SHOW_OTP_IN_RESPONSE is enabled on the server. Set it to false in production once SMS works."}
                </Text>
              </Animated.View>
            ) : null}
            <TextInput
              style={[styles.otpInput, { borderColor: colors.primary, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="- - - -"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={4}
              value={otp}
              onChangeText={(v) => { setOtp(v); setError(""); }}
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
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{t("loginBtn")}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSendOtp} style={styles.resendBtn}>
              <Text style={[styles.resendText, { color: colors.primary }]}>{t("resendOtp")}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Step 4: Name ── */}
        {step === "name" && (
          <Animated.View entering={FadeInUp.springify()} style={styles.stepBox}>
            <View style={[styles.nameSuccessIcon, { backgroundColor: colors.available + "18" }]}>
              <Feather name="check-circle" size={40} color={colors.available} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>{nameLabel}</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>{nameGreeting}</Text>
            <TextInput
              style={[styles.nameInput, { borderColor: colors.primary, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder={namePlaceholder}
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={(v) => { setName(v); setError(""); }}
              autoFocus
              returnKeyType="next"
            />
            {/* Shop / delivery address — required during registration.
                Becomes the default delivery address on every future
                order so the kirana doesn't retype it. Multi-line so
                long Telugu / Hindi addresses fit. */}
            <TextInput
              style={[styles.nameInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, minHeight: 80, paddingTop: 14, textAlignVertical: "top" }]}
              placeholder={language === "te" ? "షాప్ చిరునామా (ఇంటి నంబర్, వీధి, ఊరు, పిన్)"
                : language === "hi" ? "दुकान का पूरा पता (मकान न, गली, गाँव, पिन)"
                : "Shop address (house no, street, town, PIN)"}
              placeholderTextColor={colors.mutedForeground}
              value={address}
              onChangeText={(v) => { setAddress(v); setError(""); }}
              multiline
              numberOfLines={3}
              returnKeyType="done"
              onSubmitEditing={handleCompleteName}
            />
            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleCompleteName}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Text style={styles.primaryBtnText}>{nameBtn}</Text>
                  <Feather name="arrow-right" size={20} color="#FFF" />
                </>
              )}
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
  logoSection: { alignItems: "center", marginBottom: 40 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  appName: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  stepBox: { gap: 14 },
  langTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 8 },
  langBtn: { borderRadius: 16, borderWidth: 1.5, padding: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  langNative: { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  langEnglish: { fontSize: 14, fontFamily: "Inter_400Regular" },
  backBtn: { marginBottom: 4, alignSelf: "flex-start" },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingTop: 4 },
  backLinkText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  stepTitle: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 32 },
  stepSub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  roleBtn: { borderRadius: 16, padding: 22, alignItems: "center", gap: 8 },
  roleBtnText: { color: "#FFF", fontSize: 20, fontFamily: "Inter_700Bold" },
  roleBtnSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular" },
  phoneInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 14, height: 60, paddingHorizontal: 16 },
  countryCode: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  divider: { width: 1, height: 28, marginHorizontal: 12 },
  phoneInput: { flex: 1, fontSize: 20, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  primaryBtn: { height: 58, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 4 },
  primaryBtnText: { color: "#FFF", fontSize: 18, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  otpPreviewBox: { borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  otpPreviewLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  otpPreviewCode: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 4 },
  otpInput: { height: 72, borderWidth: 2, borderRadius: 16, fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: 12 },
  resendBtn: { alignItems: "center", paddingVertical: 8 },
  resendText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  nameSuccessIcon: { alignSelf: "center", width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  nameInput: { height: 60, borderWidth: 2, borderRadius: 16, fontSize: 20, fontFamily: "Inter_600SemiBold", paddingHorizontal: 20 },
});
