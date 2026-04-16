import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { checkInventoryAvailability } from "@/context/OrderContext";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

const DEMO_ITEMS = [
  { name: "Toor Dal", quantity: "5 kg" },
  { name: "Rice Basmati", quantity: "10 kg" },
  { name: "Sunflower Oil", quantity: "2 L" },
  { name: "Sugar", quantity: "3 kg" },
  { name: "Tea Powder", quantity: "500 gm" },
  { name: "Biscuits Parle-G", quantity: "2 boxes" },
];

interface ParsedItem { name: string; quantity: string; available: boolean; }

export default function ScanOrderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);

  const pickImage = async (fromCamera: boolean) => {
    const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await fn({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setParsedItems(null);
      analyzeImage(uri);
    }
  };

  const analyzeImage = async (_uri: string) => {
    setIsAnalyzing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((r) => setTimeout(r, 2000));
    const items: ParsedItem[] = DEMO_ITEMS.map(i => ({
      ...i,
      available: checkInventoryAvailability(i.name),
    }));
    setParsedItems(items);
    setIsAnalyzing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleProceed = () => {
    if (!parsedItems) return;
    const encoded = encodeURIComponent(JSON.stringify(parsedItems));
    router.push(`/review?items=${encoded}&mode=scan` as any);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        entering={FadeInDown.delay(50).springify()}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), borderBottomColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("takePhotoTitle")}</Text>
        <View style={{ width: 38 }} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {!imageUri ? (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.pickSection}>
            <View style={[styles.previewBox, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
              <Feather name="image" size={64} color={colors.mutedForeground} />
              <Text style={[styles.previewHint, { color: colors.mutedForeground }]}>{t("photoHint")}</Text>
            </View>
            <TouchableOpacity
              style={[styles.cameraBtn, { backgroundColor: colors.primary }]}
              onPress={() => pickImage(true)}
              activeOpacity={0.85}
            >
              <Feather name="camera" size={24} color="#FFF" />
              <Text style={styles.cameraBtnText}>{t("takePhoto")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.galleryBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => pickImage(false)}
              activeOpacity={0.85}
            >
              <Feather name="image" size={20} color={colors.accent} />
              <Text style={[styles.galleryBtnText, { color: colors.accent }]}>{t("chooseGallery")}</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.springify()} style={styles.analyzeSection}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            {isAnalyzing ? (
              <View style={[styles.analyzingBox, { backgroundColor: colors.secondary }]}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={[styles.analyzingText, { color: colors.foreground }]}>{t("analyzing")}</Text>
                <Text style={[styles.analyzingSubText, { color: colors.mutedForeground }]}>{t("analyzingSub")}</Text>
              </View>
            ) : parsedItems ? (
              <Animated.View entering={FadeInDown.springify()}>
                <Text style={[styles.resultTitle, { color: colors.foreground }]}>
                  {parsedItems.length} {t("itemsFound")}
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
                  <Text style={styles.proceedBtnText}>{t("reviewTitle")}</Text>
                  <Feather name="arrow-right" size={20} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setImageUri(null); setParsedItems(null); }}
                  style={styles.retakeBtn}
                >
                  <Text style={[styles.retakeText, { color: colors.mutedForeground }]}>{t("retakePhoto")}</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : null}
          </Animated.View>
        )}
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
  content: { padding: 20, gap: 14 },
  pickSection: { gap: 14 },
  previewBox: { height: 200, borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 12 },
  previewHint: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 20 },
  cameraBtn: { height: 58, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  cameraBtnText: { color: "#FFF", fontSize: 17, fontFamily: "Inter_700Bold" },
  galleryBtn: { height: 52, borderRadius: 16, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  galleryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  analyzeSection: { gap: 14 },
  image: { width: "100%", height: 200, borderRadius: 16 },
  analyzingBox: { borderRadius: 16, padding: 24, alignItems: "center", gap: 10 },
  analyzingText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  analyzingSubText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resultTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemQty: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  proceedBtn: { height: 58, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 },
  proceedBtnText: { color: "#FFF", fontSize: 17, fontFamily: "Inter_700Bold" },
  retakeBtn: { alignItems: "center", paddingVertical: 12 },
  retakeText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
