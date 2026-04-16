import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StockIndicator } from "@/components/StockIndicator";
import { useAuth } from "@/context/AuthContext";
import { checkInventoryAvailability, useOrders, type OrderItem } from "@/context/OrderContext";
import { useColors } from "@/hooks/useColors";

const QUICK_REORDER_ITEMS: OrderItem[] = [
  { name: "Toor Dal", quantity: "5 kg", available: true },
  { name: "Rice Basmati", quantity: "10 kg", available: true },
  { name: "Sugar", quantity: "3 kg", available: true },
  { name: "Tea Powder", quantity: "500 gm", available: true },
];

export default function ReviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createOrder } = useOrders();
  const params = useLocalSearchParams<{ items?: string; mode?: string }>();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (params.mode === "quick") {
      setItems(QUICK_REORDER_ITEMS.map(i => ({ ...i, available: checkInventoryAvailability(i.name) })));
    } else if (params.items) {
      try {
        setItems(JSON.parse(decodeURIComponent(params.items)));
      } catch {}
    }
  }, [params.items, params.mode]);

  const removeItem = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSendOrder = async () => {
    if (items.length === 0) {
      Alert.alert("Koi item nahi", "Kuch to daalo order mein");
      return;
    }
    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await createOrder({
      kiranaPhone: user?.phone ?? "0000000000",
      kiranaName: user?.name ?? "Shop Owner",
      shopName: user?.shopName ?? "My Store",
      wholesalerId: user?.trustedWholesalerId ?? "w001",
      items,
      status: "pending",
      notes,
    });
    setIsSending(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Order Bheja Gaya!",
      "Aapka order supplier ko pahunch gaya. Confirmation SMS milegi.",
      [{ text: "Theek hai", onPress: () => router.replace("/(tabs)/orders") }]
    );
  };

  const availableCount = items.filter(i => i.available).length;
  const unavailableCount = items.filter(i => !i.available).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        entering={FadeInDown.delay(50).springify()}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), borderBottomColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Order Check Karo</Text>
        <View style={{ width: 38 }} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Row */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.available + "15" }]}>
            <Text style={[styles.statNum, { color: colors.available }]}>{availableCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Available</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.unavailable + "15" }]}>
            <Text style={[styles.statNum, { color: colors.unavailable }]}>{unavailableCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Nahi hai</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.primary + "15" }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{items.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total</Text>
          </View>
        </Animated.View>

        {/* Items List */}
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="shopping-bag" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Koi item nahi</Text>
          </View>
        ) : (
          items.map((item, i) => (
            <Animated.View
              key={`${item.name}-${i}`}
              entering={FadeInDown.delay(i * 50).springify()}
              style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
                <StockIndicator available={item.available} size="sm" />
              </View>
              <TouchableOpacity onPress={() => removeItem(i)} style={styles.removeBtn}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </Animated.View>
          ))
        )}

        {/* Notes */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={[styles.notesLabel, { color: colors.foreground }]}>Notes (Optional)</Text>
          <TextInput
            style={[styles.notesInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
            placeholder="Kuch aur kehna hai? Jaise: urgent, special packing..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </Animated.View>

        {/* Send Button */}
        <Animated.View entering={FadeInDown.delay(360).springify()}>
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: isSending ? 0.7 : 1 }]}
            onPress={handleSendOrder}
            disabled={isSending}
            activeOpacity={0.85}
          >
            {isSending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Feather name="send" size={22} color="#FFF" />
                <Text style={styles.sendBtnText}>Order Bhejo</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={[styles.sendHint, { color: colors.mutedForeground }]}>
            Bhejne ke baad supplier ko SMS milega
          </Text>
        </Animated.View>
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
  content: { padding: 20, gap: 12 },
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 4 },
  statNum: { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  itemCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14 },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemQty: { fontSize: 13, fontFamily: "Inter_400Regular" },
  removeBtn: { padding: 8 },
  notesLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  notesInput: { borderWidth: 1.5, borderRadius: 14, padding: 14, minHeight: 80, fontSize: 14, fontFamily: "Inter_400Regular" },
  sendBtn: { height: 62, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  sendBtnText: { color: "#FFF", fontSize: 19, fontFamily: "Inter_700Bold" },
  sendHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 },
});
