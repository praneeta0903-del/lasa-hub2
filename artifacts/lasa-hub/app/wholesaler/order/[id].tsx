import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StockIndicator } from "@/components/StockIndicator";
import { useLanguage } from "@/context/LanguageContext";
import { useOrders, type OrderStatus } from "@/context/OrderContext";
import { useColors } from "@/hooks/useColors";

const DELIVERY_TIMES = [
  "Tomorrow 9 AM",
  "Tomorrow 12 PM",
  "Tomorrow 5 PM",
  "Day after 9 AM",
  "Within 2 hours",
];

export default function WholesalerOrderDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, updateOrder } = useOrders();
  const { t } = useLanguage();
  const order = orders.find(o => o.id === id);

  const [totalAmount, setTotalAmount] = useState(order?.totalAmount?.toString() ?? "");
  const [discount, setDiscount] = useState(order?.discount?.toString() ?? "");
  const [deliveryTime, setDeliveryTime] = useState(order?.deliveryTime ?? "");
  const [invoiceNote, setInvoiceNote] = useState(order?.invoiceNote ?? "");
  const [isSaving, setIsSaving] = useState(false);

  if (!order) return (
    <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
      <Text style={[{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 16 }]}>
        {t("noOrders")}
      </Text>
    </View>
  );

  const handleStatusChange = async (newStatus: OrderStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateOrder(order.id, { status: newStatus });
  };

  const handleConfirmOrder = async () => {
    if (!totalAmount) {
      Alert.alert(t("fillAmount"), t("fillAmount"));
      return;
    }
    if (!deliveryTime) {
      Alert.alert(t("selectDelivery"), t("selectDelivery"));
      return;
    }
    setIsSaving(true);
    await updateOrder(order.id, {
      status: "confirmed",
      totalAmount: parseFloat(totalAmount) || undefined,
      discount: parseFloat(discount) || undefined,
      deliveryTime,
      invoiceNote,
    });
    setIsSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      t("orderConfirmed"),
      `${order.shopName} ${t("smsSent")}`,
      [{ text: t("ok"), onPress: () => router.back() }]
    );
  };

  const isEditable = order.status === "pending" || order.status === "confirmed";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        entering={FadeInDown.delay(50).springify()}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), borderBottomColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{order.shopName}</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{order.items.length} items</Text>
        </View>
        <View style={{ width: 38 }} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("orderItems")}</Text>
        {order.items.map((item, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(i * 40).springify()}
            style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
            </View>
            <StockIndicator available={item.available} size="sm" />
          </Animated.View>
        ))}

        {order.notes && (
          <View style={[styles.noteBox, { backgroundColor: colors.secondary }]}>
            <Feather name="message-circle" size={15} color={colors.mutedForeground} />
            <Text style={[styles.noteText, { color: colors.foreground }]}>{order.notes}</Text>
          </View>
        )}

        {isEditable && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("confirmOrder")}</Text>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("totalAmount")} (₹)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                  placeholder="1200"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Discount (₹)</Text>
                <TextInput
                  style={[styles.fieldInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  value={discount}
                  onChangeText={setDiscount}
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("deliveryTime")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.timePills}>
              {DELIVERY_TIMES.map(timeOpt => (
                <TouchableOpacity
                  key={timeOpt}
                  style={[styles.timePill, {
                    backgroundColor: deliveryTime === timeOpt ? colors.primary : colors.card,
                    borderColor: deliveryTime === timeOpt ? colors.primary : colors.border,
                  }]}
                  onPress={() => setDeliveryTime(timeOpt)}
                >
                  <Text style={[styles.timePillText, { color: deliveryTime === timeOpt ? "#FFF" : colors.foreground }]}>{timeOpt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{t("deliveryNote")}</Text>
            <TextInput
              style={[styles.notesInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
              placeholder={t("noteHint")}
              placeholderTextColor={colors.mutedForeground}
              multiline
              value={invoiceNote}
              onChangeText={setInvoiceNote}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]}
              onPress={handleConfirmOrder}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Feather name="check-circle" size={22} color="#FFF" />
                  <Text style={styles.confirmBtnText}>{t("confirmOrder")}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {order.status === "confirmed" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#7C3AED" }]}
            onPress={() => handleStatusChange("out_for_delivery")}
            activeOpacity={0.85}
          >
            <Feather name="truck" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>{t("deliverySent")}</Text>
          </TouchableOpacity>
        )}

        {order.status === "out_for_delivery" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.available }]}
            onPress={() => handleStatusChange("delivered")}
            activeOpacity={0.85}
          >
            <Feather name="package" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>{t("delivered")}</Text>
          </TouchableOpacity>
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
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 4 },
  itemCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, padding: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemQty: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  noteBox: { borderRadius: 12, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  noteText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  fieldRow: { flexDirection: "row", gap: 12 },
  fieldHalf: { flex: 1 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  fieldInput: { height: 50, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_500Medium" },
  timePills: { gap: 8, paddingBottom: 4 },
  timePill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, borderWidth: 1.5 },
  timePillText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  notesInput: { borderWidth: 1.5, borderRadius: 14, padding: 14, minHeight: 70, fontSize: 14, fontFamily: "Inter_400Regular" },
  confirmBtn: { height: 62, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  confirmBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  actionBtn: { height: 56, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  actionBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
