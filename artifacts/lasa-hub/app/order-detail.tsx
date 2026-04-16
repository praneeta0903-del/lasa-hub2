import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StockIndicator } from "@/components/StockIndicator";
import { useOrders, type OrderStatus } from "@/context/OrderContext";
import { useColors } from "@/hooks/useColors";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Bheja gaya - Confirm ka wait",
  confirmed: "Supplier ne confirm kiya",
  out_for_delivery: "Delivery ke raste mein",
  delivered: "Pahuch gaya",
  cancelled: "Cancel ho gaya",
};
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "#D97706",
  confirmed: "#2563EB",
  out_for_delivery: "#7C3AED",
  delivered: "#16A34A",
  cancelled: "#DC2626",
};
const STATUS_ICONS: Record<OrderStatus, string> = {
  pending: "clock",
  confirmed: "check-circle",
  out_for_delivery: "truck",
  delivered: "package",
  cancelled: "x-circle",
};

export default function OrderDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders } = useOrders();
  const order = orders.find(o => o.id === id);

  if (!order) return (
    <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
      <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Order nahi mila</Text>
    </View>
  );

  const statusColor = STATUS_COLORS[order.status];
  const date = new Date(order.createdAt);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        entering={FadeInDown.delay(50).springify()}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), borderBottomColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Order Detail</Text>
        <View style={{ width: 38 }} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={[styles.statusBanner, { backgroundColor: statusColor + "18", borderColor: statusColor + "40" }]}
        >
          <Feather name={STATUS_ICONS[order.status] as any} size={24} color={statusColor} />
          <View style={styles.statusTextBlock}>
            <Text style={[styles.statusMain, { color: statusColor }]}>{STATUS_LABELS[order.status]}</Text>
            <Text style={[styles.statusDate, { color: colors.mutedForeground }]}>
              {date.toLocaleDateString("en-IN", { day: "numeric", month: "long" })} • {date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </Animated.View>

        {/* Delivery & Amount */}
        {(order.deliveryTime || order.totalAmount) && (
          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {order.deliveryTime && (
              <View style={styles.infoItem}>
                <Feather name="clock" size={16} color={colors.mutedForeground} />
                <View>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Delivery Time</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>{order.deliveryTime}</Text>
                </View>
              </View>
            )}
            {order.totalAmount && (
              <View style={styles.infoItem}>
                <Feather name="tag" size={16} color={colors.mutedForeground} />
                <View>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Total Amount</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    ₹{order.totalAmount}
                    {order.discount ? ` (₹${order.discount} off)` : ""}
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Supplier Note */}
        {order.invoiceNote && (
          <Animated.View
            entering={FadeInDown.delay(180).springify()}
            style={[styles.noteBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Feather name="file-text" size={16} color={colors.accent} />
            <Text style={[styles.noteText, { color: colors.foreground }]}>{order.invoiceNote}</Text>
          </Animated.View>
        )}

        {/* Items */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Items ({order.items.length})</Text>
        {order.items.map((item, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(200 + i * 40).springify()}
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
          <View style={[styles.noteBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.noteLabel, { color: colors.mutedForeground }]}>Aapka note:</Text>
            <Text style={[styles.noteText, { color: colors.foreground }]}>{order.notes}</Text>
          </View>
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
  content: { padding: 20, gap: 12 },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 16 },
  statusTextBlock: { flex: 1 },
  statusMain: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoRow: { flexDirection: "row", gap: 16, borderRadius: 14, borderWidth: 1, padding: 16 },
  infoItem: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 4 },
  itemCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, padding: 14 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemQty: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  noteBox: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  noteLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 2 },
  noteText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  errorText: { fontSize: 16, fontFamily: "Inter_400Regular" },
});
