import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useOrders } from "@/context/OrderContext";
import { useWholesalers } from "@/context/WholesalersContext";
import { useColors } from "@/hooks/useColors";
import { LasaLogo } from "@/components/LasaLogo";
import { OrderTracker, prettyStatus } from "@/components/OrderTracker";

/**
 * Post-send invoice screen. Replaces the old generic "Thank You" page.
 *
 * Shows everything the kirana needs to refer back to:
 *   - Order invoice number (LH-YYMMDD-XXXX) for phone calls with supplier
 *   - Selected wholesaler name (so they remember who's fulfilling)
 *   - Current order status + 4-stage visual tracker
 *   - All items in ONE box (not separate cards) with per-line pricing
 *   - Bill breakdown: subtotal / tax / total
 *   - Delivery address
 *
 * The orderId is read from the route param set by the review screen.
 * The actual order data comes from OrderContext (already loaded — the
 * kirana just placed it, so it's in `orders`).
 */
export default function OrderSentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { orders } = useOrders();
  const { wholesalers, stockFor } = useWholesalers();
  const params = useLocalSearchParams<{ orderId?: string }>();

  // Resolve the order. Falls back to the most-recent kirana order if
  // the param is missing — defensive, since the screen should always
  // have SOMETHING to show even if the navigation lost the param.
  const order = useMemo(() => {
    if (params.orderId) return orders.find(o => o.id === params.orderId) ?? null;
    const mine = orders
      .filter(o => o.kiranaPhone === user?.phone)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return mine[0] ?? null;
  }, [params.orderId, orders, user?.phone]);

  const wholesaler = useMemo(
    () => (order ? wholesalers.find(w => w.id === order.wholesalerId) ?? null : null),
    [order, wholesalers],
  );

  // Compute per-line economics for the invoice. We re-derive instead
  // of trusting the order row's totalAmount because the order row may
  // not have totals filled in yet (wholesaler computes them on accept).
  const lines = useMemo(() => {
    if (!order || !wholesaler) return [];
    return order.items.map(it => {
      const s = stockFor(wholesaler.id, it.name, it.quantity, it.nameTe, it.nameHi);
      const price = s.catalog?.pricePerUnit ?? 0;
      const needed = s.needed ?? 0;
      const sub = price * needed;
      const taxPct = s.catalog?.taxPercent ?? wholesaler.defaultTaxPercent ?? 0;
      const tax = sub * (taxPct / 100);
      return {
        name: it.name,
        qty: it.quantity,
        unit: s.catalog?.unit ?? "",
        price,
        taxPct,
        sub,
        tax,
        total: sub + tax,
        available: s.state === "in_stock",
      };
    });
  }, [order, wholesaler, stockFor]);

  const subtotal = lines.reduce((sum, l) => sum + (l.available ? l.sub : 0), 0);
  const taxTotal = lines.reduce((sum, l) => sum + (l.available ? l.tax : 0), 0);
  const grandTotal = subtotal + taxTotal;

  useEffect(() => {
    // Tiny haptic on land — feels like a confirmation thump.
    // (No-op on web.)
  }, []);

  const labels = {
    invoice: language === "te" ? "ఇన్వాయిస్" : language === "hi" ? "इनवॉयस" : "Invoice",
    placedWith: language === "te" ? "సరఫరాదారు" : language === "hi" ? "थोकदार" : "Supplier",
    status: language === "te" ? "స్థితి" : language === "hi" ? "स्थिति" : "Status",
    items: language === "te" ? "వస్తువులు" : language === "hi" ? "सामान" : "Items",
    subtotal: language === "te" ? "మొత్తం" : language === "hi" ? "उपयोग" : "Subtotal",
    tax: language === "te" ? "పన్ను" : language === "hi" ? "टैक्स" : "Tax",
    total: language === "te" ? "చెల్లించాల్సినది" : language === "hi" ? "कुल देय" : "Total to pay",
    deliverTo: language === "te" ? "డెలివరీ చిరునామా" : language === "hi" ? "डिलीवरी पता" : "Deliver to",
    viewOrders: language === "te" ? "నా ఆర్డర్లు" : language === "hi" ? "मेरे ऑर्डर" : "View My Orders",
    backHome: language === "te" ? "హోమ్" : language === "hi" ? "होम" : "Home",
    notFound: language === "te" ? "ఆర్డర్ కనుగొనబడలేదు" : language === "hi" ? "ऑर्डर नहीं मिला" : "Order not found",
  };

  // If we lost the order somehow, render a graceful fallback rather
  // than a blank screen.
  if (!order) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, padding: 24, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 16 }}>
          {labels.notFound}
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.primaryBtnText}>{labels.backHome}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 24), paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand mark + check-mark, smaller than before to make room
            for the invoice content. */}
        <Animated.View entering={FadeInDown.springify()} style={styles.heroRow}>
          <LasaLogo size={88} />
          <View style={[styles.checkCircle, { backgroundColor: colors.available }]}>
            <Feather name="check" size={22} color="#FFF" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.heroText}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            {language === "te" ? "ఆర్డర్ నమోదు అయింది" : language === "hi" ? "ऑर्डर दर्ज हो गया" : "Order placed"}
          </Text>
          {order.invoiceNumber && (
            <Text style={[styles.invoiceNumber, { color: colors.primary }]}>{order.invoiceNumber}</Text>
          )}
        </Animated.View>

        {/* Two big facts the user asked us to surface at the top: who
            and what stage. Both in one card to keep the eye anchored. */}
        <Animated.View
          entering={FadeInUp.delay(160).springify()}
          style={[styles.bigFactsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.factRow}>
            <Text style={[styles.factLabel, { color: colors.mutedForeground }]}>{labels.placedWith}</Text>
            <Text style={[styles.factValue, { color: colors.foreground }]}>{wholesaler?.name ?? order.shopName}</Text>
          </View>
          <View style={[styles.factDivider, { backgroundColor: colors.border }]} />
          <View style={styles.factRow}>
            <Text style={[styles.factLabel, { color: colors.mutedForeground }]}>{labels.status}</Text>
            <Text style={[styles.factValue, { color: colors.primary }]}>{prettyStatus(order.status, language)}</Text>
          </View>
        </Animated.View>

        {/* 4-stage visual tracker — accepted → packed → dispatched → delivered. */}
        <Animated.View entering={FadeInUp.delay(220).springify()}>
          <OrderTracker status={order.status as any} language={language} />
        </Animated.View>

        {/* Full invoice — single box, all items inside, totals at the bottom. */}
        <Animated.View
          entering={FadeInUp.delay(280).springify()}
          style={[styles.invoiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.invoiceHeader, { color: colors.foreground }]}>{labels.invoice}</Text>

          {lines.map((l, i) => (
            <View key={i} style={[styles.lineRow, i < lines.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.lineName, { color: colors.foreground }]} numberOfLines={1}>{l.name}</Text>
                <Text style={[styles.lineQty, { color: colors.mutedForeground }]}>
                  {l.qty}{l.price > 0 ? `  ·  ₹${l.price}/${l.unit}` : ""}{l.taxPct > 0 ? `  ·  ${l.taxPct}% tax` : ""}
                </Text>
              </View>
              {l.available ? (
                <Text style={[styles.lineTotal, { color: colors.foreground }]}>₹{Math.round(l.total).toLocaleString()}</Text>
              ) : (
                <Text style={[styles.lineTotal, { color: colors.unavailable, fontSize: 12 }]}>
                  {language === "te" ? "లేదు" : language === "hi" ? "नहीं" : "n/a"}
                </Text>
              )}
            </View>
          ))}

          <View style={[styles.totalsBlock, { borderTopColor: colors.border }]}>
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: colors.mutedForeground }]}>{labels.subtotal}</Text>
              <Text style={[styles.totalsValue, { color: colors.foreground }]}>₹{Math.round(subtotal).toLocaleString()}</Text>
            </View>
            {taxTotal > 0 && (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { color: colors.mutedForeground }]}>{labels.tax}</Text>
                <Text style={[styles.totalsValue, { color: colors.foreground }]}>₹{Math.round(taxTotal).toLocaleString()}</Text>
              </View>
            )}
            <View style={[styles.totalsRow, { marginTop: 6 }]}>
              <Text style={[styles.grandLabel, { color: colors.foreground }]}>{labels.total}</Text>
              <Text style={[styles.grandValue, { color: colors.primary }]}>₹{Math.round(grandTotal).toLocaleString()}</Text>
            </View>
          </View>

          {order.deliveryAddress && (
            <View style={[styles.addressBlock, { borderTopColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                <Text style={[styles.addressLabel, { color: colors.mutedForeground }]}>{labels.deliverTo}</Text>
              </View>
              <Text style={[styles.addressText, { color: colors.foreground }]}>{order.deliveryAddress}</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(340).springify()} style={styles.btnBlock}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(tabs)/orders")}
            activeOpacity={0.85}
          >
            <Feather name="list" size={20} color="#FFF" />
            <Text style={styles.primaryBtnText}>{labels.viewOrders}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.85}
          >
            <Feather name="home" size={18} color={colors.foreground} />
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>{labels.backHome}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 16, alignItems: "center" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  heroText: { alignItems: "center", gap: 4 },
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  invoiceNumber: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2 },

  bigFactsCard: { width: "100%", maxWidth: 480, borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  factRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  factLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  factValue: { fontSize: 15, fontFamily: "Inter_700Bold", maxWidth: "60%", textAlign: "right" },
  factDivider: { height: 1 },

  invoiceCard: { width: "100%", maxWidth: 480, borderRadius: 14, borderWidth: 1, padding: 16, gap: 0 },
  invoiceHeader: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" },
  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  lineName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  lineQty: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  lineTotal: { fontSize: 14, fontFamily: "Inter_700Bold" },

  totalsBlock: { borderTopWidth: 1, paddingTop: 12, marginTop: 4, gap: 4 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalsLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  totalsValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  grandLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  grandValue: { fontSize: 22, fontFamily: "Inter_700Bold" },

  addressBlock: { borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  addressLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  addressText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  btnBlock: { width: "100%", maxWidth: 480, gap: 10, marginTop: 8 },
  primaryBtn: { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  secondaryBtn: { height: 48, borderRadius: 14, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
