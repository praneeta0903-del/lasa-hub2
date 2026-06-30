import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import Animated, { FadeInDown, FadeInUp, Layout } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useOrders, type OrderItem } from "@/context/OrderContext";
import { useWholesalers } from "@/context/WholesalersContext";
import { getItemNameInLanguage, pickName, type Wholesaler } from "@/data/wholesalers";
import { kiranaStockLabel } from "@/utils/stockLabels";
import { findSimilarCatalogItems } from "@/utils/catalogMatch";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useColors } from "@/hooks/useColors";
import { LasaLogo } from "@/components/LasaLogo";

function parseQty(q: string): number {
  const m = q.match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : 1;
}

export default function ReviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { createOrder, orders } = useOrders();
  const { wholesalers, isAvailable, stockFor, rankSuppliers, refresh: refreshWholesalers } = useWholesalers();

  // Pull fresh catalog every time the kirana opens this screen so stock is real-time.
  useEffect(() => { refreshWholesalers(); }, [refreshWholesalers]);

  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const params = useLocalSearchParams<{ items?: string; mode?: string }>();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  // Default delivery address comes from the address captured at
  // registration (user.address). Falls back to shopName then empty
  // so the field is never undefined.
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address ?? user?.shopName ?? "");
  // Track whether the user has overridden the default address this
  // session — used to show "Add new" vs "Edit default" affordance.
  const [addressIsCustom, setAddressIsCustom] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Wholesaler selection
  const [selectedWholesaler, setSelectedWholesaler] = useState<Wholesaler>(wholesalers[0]);
  const [showWholesalerModal, setShowWholesalerModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogWholesaler, setCatalogWholesaler] = useState<Wholesaler>(wholesalers[0]);

  // Keep selection in sync if wholesalers load/refresh.
  useEffect(() => {
    if (!wholesalers.length) return;
    if (!wholesalers.find(w => w.id === selectedWholesaler?.id)) {
      setSelectedWholesaler(wholesalers[0]);
      setCatalogWholesaler(wholesalers[0]);
    }
  }, [wholesalers, selectedWholesaler?.id]);

  // Inline item editing
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editQtyValue, setEditQtyValue] = useState("");
  const [editNameValue, setEditNameValue] = useState("");
  // Wholesaler search query — filters the supplier-picker modal by
  // shop name. Useful once the kirana has 10+ suppliers to choose from.
  const [wsSearch, setWsSearch] = useState("");
  // Memoised filter result so we don't re-filter on every render.
  const filteredWholesalers = React.useMemo(() => {
    const q = wsSearch.trim().toLowerCase();
    if (!q) return wholesalers;
    return wholesalers.filter(w =>
      w.name.toLowerCase().includes(q) ||
      (w.location ?? "").toLowerCase().includes(q) ||
      (w.ownerName ?? "").toLowerCase().includes(q),
    );
  }, [wholesalers, wsSearch]);

  // Add item
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);

  useEffect(() => {
    let baseItems: OrderItem[] = [];
    if (params.mode === "quick") {
      const sorted = [...orders].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const last = sorted[0];
      if (last) {
        baseItems = last.items.map(i => ({
          name: i.name,
          nameTe: i.nameTe,
          nameHi: i.nameHi,
          sourceLanguage: i.sourceLanguage,
          quantity: i.quantity,
          available: true,
        }));
        if (last.wholesalerId) {
          const lastWs = wholesalers.find(w => w.id === last.wholesalerId);
          if (lastWs) setSelectedWholesaler(lastWs);
        }
      }
    } else if (params.items) {
      try { baseItems = JSON.parse(decodeURIComponent(params.items)); } catch {}
    }
    setItems(baseItems.map(i => ({
      ...i,
      available: isAvailable(selectedWholesaler?.id ?? "", i.name),
    })));
  }, [params.items, params.mode, orders, wholesalers]);

  // Re-check availability when wholesaler changes
  useEffect(() => {
    setItems(prev => prev.map(i => ({
      ...i,
      available: isAvailable(selectedWholesaler?.id ?? "", i.name),
    })));
  }, [selectedWholesaler, isAvailable]);

  const removeItem = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const startEdit = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingIdx(idx);
    setEditQtyValue(items[idx].quantity);
    setEditNameValue(items[idx].name);
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    const newName = editNameValue.trim() || items[editingIdx].name;
    setItems(prev => prev.map((item, i) =>
      i === editingIdx
        ? {
            ...item,
            name: newName,
            quantity: editQtyValue,
            // Clear the AI-suggested language variants once the user has
            // manually rewritten the name — they no longer apply.
            ...(newName.toLowerCase() !== item.name.toLowerCase()
              ? { nameTe: undefined, nameHi: undefined }
              : {}),
          }
        : item,
    ));
    setEditingIdx(null);
    setEditQtyValue("");
    setEditNameValue("");
  };

  const addItem = () => {
    if (!newItemName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newItem: OrderItem = {
      name: newItemName.trim(),
      quantity: newItemQty.trim() || "1",
      available: isAvailable(selectedWholesaler?.id ?? "", newItemName.trim()),
    };
    setItems(prev => [...prev, newItem]);
    setNewItemName("");
    setNewItemQty("");
    setShowAddRow(false);
  };

  // Cross-platform alert that works on web (where Alert.alert can be
  // suppressed by some browsers / extensions and used to silently swallow
  // validation feedback). Always logs to the console as a fallback so
  // the user can see what blocked the send from DevTools.
  const tell = (title: string, body?: string) => {
    const msg = body ? `${title}\n\n${body}` : title;
    console.warn("[send-order]", title, body ?? "");
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(msg);
    } else {
      Alert.alert(title, body);
    }
  };

  const handleSendOrder = async () => {
    console.info("[send-order] tapped", {
      hasUser: !!user?.phone,
      items: items.length,
      hasSupplier: !!selectedWholesaler,
      deliveryAddress: deliveryAddress?.length ?? 0,
      minOrderViolations: minOrderViolations.length,
    });
    if (!user?.phone) {
      tell("Please login again before placing an order.");
      return;
    }
    if (items.length === 0) {
      tell(t("addItem"));
      return;
    }
    // Without a supplier we can't build the order — the previous code
    // crashed silently on `selectedWholesaler.id` here.
    if (!selectedWholesaler?.id) {
      tell("Pick a supplier first", "Tap 'Select this Supplier' on the list above.");
      return;
    }
    // Address validation — reject obvious junk (too short, no alphanumerics).
    const addr = deliveryAddress.trim();
    if (!addr) {
      tell("Delivery address is required", "Add your shop address so the supplier knows where to deliver.");
      return;
    }
    if (addr.length < 10 || !/[\w\dऀ-ॿఀ-౿]{3,}/.test(addr)) {
      tell("Address looks too short", "Please enter the full address — house no, street, town, and PIN. At least 10 characters.");
      return;
    }
    if (minOrderViolations.length > 0) {
      const first = minOrderViolations[0];
      const unit = first.catalog?.unit ?? "";
      tell(
        "Minimum order not met",
        `This shop's minimum for ${first.catalog?.name ?? "one item"} is ${first.minOrderQty}${unit ? " " + unit : ""}. Increase the quantity or pick a different shop.`,
      );
      return;
    }
    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Capture the created order so we can hand its ID to /order-sent
      // for a real invoice-style confirmation (instead of the generic
      // "Thank You" page that knew nothing about what the user just
      // ordered).
      const created = await createOrder({
        kiranaPhone: user.phone,
        kiranaName: user?.name ?? "Shop Owner",
        shopName: user?.shopName ?? "My Store",
        wholesalerId: selectedWholesaler.id,
        items,
        status: "pending",
        notes,
        deliveryAddress,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/order-sent?orderId=${encodeURIComponent(created.id)}` as any);
    } catch (err: any) {
      console.error("[send-order] createOrder failed", err);
      tell(
        "Couldn't send the order",
        err?.message
          ? `${err.message}\n\nYour items are still here — tap Send again.`
          : "Network or server error. Your items are still here — tap Send again.",
      );
    } finally {
      // CRITICAL: always reset, even on error. Without this the button
      // stays in the spinner state forever and the user thinks the
      // app is broken.
      setIsSending(false);
    }
  };

  const unavailableCount = items.filter(i => !i.available).length;

  // Live stock check per item against the currently-selected supplier.
  // Pass the RAW quantity string so the catalog comparison can unit-convert
  // (e.g. "500 gm" against a catalog row in kg becomes 0.5 vs 20, not 500 vs 20).
  const itemStocks = items.map(i =>
    stockFor(selectedWholesaler?.id ?? "", i.name, i.quantity, i.nameTe, i.nameHi),
  );

  // Ranked supplier suggestions (real-time from catalog + distance from kirana).
  const suggestions = items.length
    ? rankSuppliers(
        items.map(i => ({ name: i.name, quantity: i.quantity, nameTe: i.nameTe, nameHi: i.nameHi })),
        { lat: user?.lat, lng: user?.lng },
      ).slice(0, 5)
    : [];
  const topSuggestion = suggestions[0];

  // Block send if any item violates the supplier's minimum order quantity.
  const minOrderViolations = itemStocks.filter(s => s.state === "below_min_order");

  // Prefer the catalog version when the item matches (rich, well-curated),
  // otherwise fall back to the kirana's own scanned translation, then English.
  const getItemDisplayName = (item: OrderItem) => {
    if (language === "en") return item.name;
    const w = selectedWholesaler ?? wholesalers[0];
    if (w) {
      const cat = w.catalog.find(c => c.name.toLowerCase() === item.name.toLowerCase());
      if (cat) return getItemNameInLanguage(cat, language);
    }
    return pickName(item, language);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(50).springify()}
        style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), borderBottomColor: colors.border }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("reviewTitle")}</Text>
        <LasaLogo size={42} /* bigger circular logo in top-right keeps brand visible on every screen */ />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Coverage at the selected supplier — restored, but plain English */}
        {items.length > 0 && (() => {
          const inStock = itemStocks.filter(s => s.state === "in_stock").length;
          const low = itemStocks.filter(s => s.state === "low_stock").length;
          const missing = itemStocks.filter(s => s.state === "not_carried" || s.state === "out_of_stock").length;
          const allOk = missing === 0 && low === 0;
          const color = allOk ? colors.available : missing > 0 ? colors.unavailable : "#F59E0B";
          return (
            <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.coverBanner, { backgroundColor: color + "14", borderColor: color + "55" }]}>
              <Feather name={allOk ? "check-circle" : "alert-circle"} size={16} color={color} />
              <Text style={[styles.coverText, { color }]}>
                {inStock}/{items.length} ready at {selectedWholesaler?.name}
                {low > 0 ? `  ·  ${low} low` : ""}
                {missing > 0 ? `  ·  ${missing} not here` : ""}
              </Text>
              {topSuggestion && topSuggestion.wholesaler.id !== selectedWholesaler.id && topSuggestion.inStockCount > inStock && (
                <TouchableOpacity onPress={() => setShowSupplierPicker(true)}>
                  <Text style={[styles.coverLink, { color: colors.primary }]}>Better match →</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          );
        })()}

        {/* Suggested suppliers — horizontal cards, ranked by coverage > price > distance */}
        {items.length > 0 && suggestions.length > 1 && (
          <View>
            <Text style={[styles.suggestTitle, { color: colors.mutedForeground }]}>Suggested shops for this list</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {suggestions.map((q, idx) => {
                const isSelected = q.wholesaler.id === selectedWholesaler.id;
                const isRecommended = idx === 0;
                return (
                  <TouchableOpacity
                    key={q.wholesaler.id}
                    onPress={() => { setSelectedWholesaler(q.wholesaler); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={[styles.suggestCard, {
                      backgroundColor: isSelected ? colors.primary + "10" : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={[styles.suggestName, { color: colors.foreground }]} numberOfLines={1}>{q.wholesaler.name}</Text>
                      {q.wholesaler.verified && <Feather name="shield" size={11} color={colors.available} />}
                    </View>
                    {isRecommended && !isSelected && (
                      <View style={[styles.recommendBadge, { backgroundColor: colors.available + "22" }]}>
                        <Text style={[styles.recommendBadgeText, { color: colors.available }]}>Best match</Text>
                      </View>
                    )}
                    <Text style={[styles.suggestLine, { color: colors.foreground }]}>
                      {q.inStockCount}/{items.length} in stock
                    </Text>
                    <Text style={[styles.suggestSub, { color: colors.mutedForeground }]}>
                      ≈ ₹{q.total.toLocaleString()}
                      {q.distanceKm != null ? `  ·  ${q.distanceKm.toFixed(1)} km` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Wholesaler Selector */}
        <Animated.View entering={FadeInDown.delay(140).springify()} style={[styles.wholesalerCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }]}>
          <View style={styles.wholesalerTop}>
            <View style={[styles.wsIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="truck" size={20} color={colors.primary} />
            </View>
            <View style={styles.wsInfo}>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                <Text style={[styles.wsName, { color: colors.foreground }]}>{selectedWholesaler.name}</Text>
                <VerifiedBadge verified={selectedWholesaler.verified} size="xs" />
              </View>
              <Text style={[styles.wsSub, { color: colors.mutedForeground }]}>
                {selectedWholesaler.distance && selectedWholesaler.distance !== "Unknown" ? `${selectedWholesaler.distance}  •  ` : ""}★ {selectedWholesaler.rating}
              </Text>
              {selectedWholesaler.specialOffer && (
                <View style={[styles.offerBadge, { backgroundColor: colors.available + "18" }]}>
                  <Text style={[styles.offerText, { color: colors.available }]}>{selectedWholesaler.specialOffer}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.wsActions}>
            <TouchableOpacity
              style={[styles.wsBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              onPress={() => { setCatalogWholesaler(selectedWholesaler); setShowCatalogModal(true); }}
            >
              <Feather name="list" size={14} color={colors.accent} />
              <Text style={[styles.wsBtnText, { color: colors.accent }]}>{t("viewCatalog")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.wsBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "14" }]}
              onPress={() => setShowWholesalerModal(true)}
            >
              <Feather name="refresh-cw" size={14} color={colors.primary} />
              <Text style={[styles.wsBtnText, { color: colors.primary }]}>{t("changeWholesaler")}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        {/* Items List */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {t("itemsFound")} ({items.length})
        </Text>

        {items.map((item, i) => (
          <Animated.View
            key={`${item.name}-${i}`}
            entering={FadeInDown.delay(160 + i * 40).springify()}
            layout={Layout.springify()}
          >
            {editingIdx === i ? (
              // Edit mode — both name AND quantity editable now
              <View style={[styles.itemCardEditing, { backgroundColor: colors.primary + "10", borderColor: colors.primary }]}>
                <Text style={[styles.editFieldLabel, { color: colors.mutedForeground }]}>Item name</Text>
                <TextInput
                  style={[styles.editNameInput, { borderColor: colors.primary, color: colors.foreground, backgroundColor: colors.background }]}
                  value={editNameValue}
                  onChangeText={setEditNameValue}
                  placeholder="e.g. Rice, Turmeric, Haldi"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                />
                <Text style={[styles.editFieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Quantity</Text>
                <View style={styles.editRow}>
                  <TextInput
                    style={[styles.editQtyInput, { borderColor: colors.primary, color: colors.foreground, backgroundColor: colors.background }]}
                    value={editQtyValue}
                    onChangeText={setEditQtyValue}
                    placeholder={t("qtyPlaceholder")}
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={saveEdit}>
                    <Text style={styles.saveBtnText}>{t("save")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={() => setEditingIdx(null)}>
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (() => {
              // Live stock state for this item at the selected supplier.
              const s = itemStocks[i];
              const unit = s?.catalog?.unit ?? "";
              const orderedUnit = (() => {
                const m = String(item.quantity ?? "").match(/[a-zA-Zఅ-౿अ-ॿ]+\s*$/);
                return m ? m[0].trim() : "";
              })();
              // Three buckets of state → one of three colors. Used both
              // for the tinted row background AND for the line-total
              // text accent so the visual story stays consistent.
              const isAvailable = s?.state === "in_stock";
              const isPartial = s?.state === "low_stock" || s?.state === "below_min_order" || s?.state === "wrong_unit";
              const stateColor = isAvailable ? colors.available
                : isPartial ? "#F59E0B"
                : colors.unavailable;
              // Whole-row tint (vs the old standalone dot) — soft 14%
              // alpha so text stays readable. Border is the full color
              // for visual edge definition. Avoids needing the dot
              // entirely and is a much louder availability signal at
              // a glance, which is what the user asked for.
              const rowTint = stateColor + "1F"; // ~12% alpha hex
              const rowBorder = stateColor + "66"; // ~40% alpha hex
              const stateLabel = s
                ? kiranaStockLabel(
                    (language as "en" | "te" | "hi") ?? "en",
                    { state: s.state, onHand: s.onHand, needed: s.needed, minOrderQty: s.minOrderQty, unit, orderedUnit },
                  )
                : "";
              // Per-item line economics. Uses the qty ALREADY converted
              // to the catalog's base unit (so "500 gm" → 0.5 against a
              // kg-based catalog) for correct math regardless of what
              // the kirana typed.
              const linePrice = s?.catalog?.pricePerUnit ?? 0;
              const lineNeeded = s?.needed ?? 0;
              const lineSubtotal = isAvailable || isPartial ? linePrice * lineNeeded : 0;
              const lineTaxPct = s?.catalog?.taxPercent ?? selectedWholesaler?.defaultTaxPercent ?? 0;
              const lineTax = lineSubtotal * (lineTaxPct / 100);
              const lineTotal = Math.round(lineSubtotal + lineTax);
              // "Did you mean" suggestions still appear for not_carried
              // items — the user explicitly asked us to keep this feature.
              const suggestions = s?.state === "not_carried" && selectedWholesaler
                ? findSimilarCatalogItems(selectedWholesaler.catalog, item.name, 3)
                : [];
              return (
                <View style={[styles.itemCard, { backgroundColor: rowTint, borderColor: rowBorder, borderLeftWidth: 4, borderLeftColor: stateColor }]}>
                  <View style={styles.itemCenter}>
                    {/* THREE-COLUMN HEADER: name | unit-price+tax | line total */}
                    <View style={styles.itemRowTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: colors.foreground }]}>{getItemDisplayName(item)}</Text>
                        <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
                      </View>
                      {s?.catalog?.pricePerUnit != null && (
                        <View style={{ alignItems: "flex-end", marginRight: 12 }}>
                          <Text style={[styles.itemPriceUnit, { color: colors.foreground }]}>
                            ₹{linePrice}/{s.catalog.unit}
                          </Text>
                          {lineTaxPct > 0 && (
                            <Text style={[styles.itemTaxPct, { color: colors.mutedForeground }]}>
                              +{lineTaxPct}% tax
                            </Text>
                          )}
                        </View>
                      )}
                      {(isAvailable || isPartial) && lineTotal > 0 && (
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[styles.itemLineTotal, { color: stateColor }]}>₹{lineTotal}</Text>
                        </View>
                      )}
                    </View>
                    {/* Min-order hint + state label, compact one-liners */}
                    {s?.catalog && s.minOrderQty > 0 && !isAvailable && (
                      <Text style={[styles.minOrderHint, { color: colors.mutedForeground }]}>
                        min order: {s.minOrderQty} {s.catalog.unit}
                      </Text>
                    )}
                    {!isAvailable && (
                      <Text style={[styles.stockReason, { color: stateColor }]}>{stateLabel}</Text>
                    )}
                    {/* Did-you-mean — kept as-is, it's the user's
                        favourite feature on this screen. */}
                    {suggestions.length > 0 && (
                      <View style={styles.suggestionsRow}>
                        <Text style={[styles.suggestionsLabel, { color: colors.mutedForeground }]}>
                          {language === "hi" ? "क्या आपका मतलब था:" : language === "te" ? "మీరు అడిగినది:" : "Did you mean:"}
                        </Text>
                        <View style={styles.suggestionsChips}>
                          {suggestions.map((sg, sgIdx) => (
                            <TouchableOpacity
                              key={sgIdx}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setItems(prev => prev.map((it, idx) => idx === i ? { ...it, name: sg.name, nameTe: sg.nameTe ?? "", nameHi: sg.nameHi ?? "" } : it));
                              }}
                              style={[styles.suggestionChip, { borderColor: colors.primary + "55", backgroundColor: colors.primary + "10" }]}
                            >
                              <Text style={[styles.suggestionChipText, { color: colors.primary }]}>{sg.name}</Text>
                            </TouchableOpacity>
                          ))}
                          <TouchableOpacity
                            onPress={() => setShowCatalogModal(true)}
                            style={[styles.suggestionChip, { borderColor: colors.border }]}
                          >
                            <Feather name="list" size={11} color={colors.mutedForeground} />
                            <Text style={[styles.suggestionChipText, { color: colors.mutedForeground, marginLeft: 4 }]}>
                              {language === "hi" ? "पूरी सूची देखें" : language === "te" ? "మొత్తం జాబితా" : "see full list"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => startEdit(i)}>
                      <Feather name="edit-2" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => removeItem(i)}>
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </Animated.View>
        ))}

        {/* Add Item Row */}
        {showAddRow ? (
          <Animated.View entering={FadeInDown.springify()} style={[styles.addRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.addInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={t("itemNamePlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <TextInput
              style={[styles.addQtyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={t("qtyPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={newItemQty}
              onChangeText={setNewItemQty}
            />
            <TouchableOpacity style={[styles.addConfirmBtn, { backgroundColor: colors.primary }]} onPress={addItem}>
              <Feather name="plus" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddRow(false)}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={[styles.addItemBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAddRow(true); }}
          >
            <Feather name="plus" size={18} color={colors.primary} />
            <Text style={[styles.addItemBtnText, { color: colors.primary }]}>{t("addItem")}</Text>
          </TouchableOpacity>
        )}

        {/* Notes */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("notes")}</Text>
        <TextInput
          style={[styles.notesInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
          placeholder={t("noteHint")}
          placeholderTextColor={colors.mutedForeground}
          multiline
          value={notes}
          onChangeText={setNotes}
        />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Delivery Address</Text>
        {/* Two visible options the user can tap — the saved default
            (from registration) and an "Add new address" chip. Whichever
            is selected gets the primary color highlight. Editable text
            box appears below — pre-filled with the default, fully
            editable when "Add new" is selected. */}
        {user?.address ? (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDeliveryAddress(user.address ?? "");
                setAddressIsCustom(false);
              }}
              style={[
                styles.addrChip,
                {
                  borderColor: !addressIsCustom ? colors.primary : colors.border,
                  backgroundColor: !addressIsCustom ? colors.primary + "12" : colors.card,
                },
              ]}
            >
              <Feather name="home" size={14} color={!addressIsCustom ? colors.primary : colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.addrChipLabel, { color: !addressIsCustom ? colors.primary : colors.foreground }]}>
                  Default (from profile)
                </Text>
                <Text style={[styles.addrChipPreview, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {user.address}
                </Text>
              </View>
              {!addressIsCustom && <Feather name="check" size={16} color={colors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDeliveryAddress("");
                setAddressIsCustom(true);
              }}
              style={[
                styles.addrChip,
                {
                  borderColor: addressIsCustom ? colors.primary : colors.border,
                  backgroundColor: addressIsCustom ? colors.primary + "12" : colors.card,
                },
              ]}
            >
              <Feather name="plus-circle" size={14} color={addressIsCustom ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.addrChipLabel, { color: addressIsCustom ? colors.primary : colors.foreground }]}>
                Add new address
              </Text>
              {addressIsCustom && <Feather name="check" size={16} color={colors.primary} />}
            </TouchableOpacity>
          </View>
        ) : (
          // No saved default address yet — gentle hint to add one to
          // profile next time so they don't have to retype on every order.
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            Tip: Add a shop address in your profile so it auto-fills on every order.
          </Text>
        )}
        <TextInput
          style={[styles.notesInput, { borderColor: addressIsCustom ? colors.primary : colors.border, backgroundColor: colors.card, color: colors.foreground }]}
          placeholder="House no, street, town, PIN"
          placeholderTextColor={colors.mutedForeground}
          multiline
          value={deliveryAddress}
          onChangeText={(v) => {
            setDeliveryAddress(v);
            if (user?.address && v !== user.address) setAddressIsCustom(true);
          }}
          // Lock the textbox when showing the default so the user
          // doesn't accidentally edit their saved address. Tap the
          // "Add new" chip to start typing.
          editable={addressIsCustom || !user?.address}
        />

        {/* Estimated bill — computed from the selected supplier's catalog. */}
        {items.length > 0 && (() => {
          const me = suggestions.find(s => s.wholesaler.id === selectedWholesaler.id);
          if (!me) return null;
          return (
            <View style={[styles.totalCard, { backgroundColor: colors.primary + "0e", borderColor: colors.primary + "55" }]}>
              <Text style={[styles.totalTitle, { color: colors.foreground }]}>Estimated bill</Text>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Subtotal ({me.inStockCount + me.lowStockCount} of {items.length} items)</Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>₹{me.subtotal.toLocaleString()}</Text>
              </View>
              {me.tax > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>+ Tax</Text>
                  <Text style={[styles.totalValue, { color: colors.foreground }]}>₹{me.tax.toLocaleString()}</Text>
                </View>
              )}
              {me.discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>− Discount</Text>
                  <Text style={[styles.totalValue, { color: colors.available }]}>−₹{me.discount.toLocaleString()}</Text>
                </View>
              )}
              <View style={[styles.totalDivider, { backgroundColor: colors.border }]} />
              <View style={styles.totalRow}>
                <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>Total to pay</Text>
                <Text style={[styles.grandTotalValue, { color: colors.primary }]}>₹{me.total.toLocaleString()}</Text>
              </View>
              {me.missingCount > 0 && (
                <Text style={[styles.totalNote, { color: colors.mutedForeground }]}>
                  {me.missingCount} item{me.missingCount > 1 ? "s" : ""} not at this shop — wholesaler may suggest a substitute or skip.
                </Text>
              )}
            </View>
          );
        })()}

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: isSending ? 0.7 : 1 }]}
          onPress={handleSendOrder}
          disabled={isSending}
          activeOpacity={0.85}
        >
          {isSending ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Feather name="send" size={22} color="#FFF" />
              <Text style={styles.sendBtnText}>{t("sendOrder")}</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={[styles.sendHint, { color: colors.mutedForeground }]}>{t("sendHint")}</Text>
      </ScrollView>

      {/* ── Wholesaler Select Modal ── */}
      <Modal visible={showWholesalerModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("chooseSupplier")}</Text>
            {/* Search box — filters by shop name / location / owner.
                Auto-clears when the modal closes (intentional: most
                kiranas have a small enough supplier list that
                persisting the filter would be confusing). */}
            <View style={[styles.wsSearchWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.wsSearchInput, { color: colors.foreground }]}
                placeholder={language === "te" ? "షాప్ పేరు వెతకండి…" : language === "hi" ? "दुकान का नाम खोजें…" : "Search by shop or area…"}
                placeholderTextColor={colors.mutedForeground}
                value={wsSearch}
                onChangeText={setWsSearch}
                autoCorrect={false}
                returnKeyType="search"
              />
              {wsSearch.length > 0 && (
                <TouchableOpacity onPress={() => setWsSearch("")} style={{ padding: 4 }}>
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            {filteredWholesalers.length === 0 && (
              <Text style={{ color: colors.mutedForeground, textAlign: "center", paddingVertical: 24 }}>
                {language === "te" ? "ఏ షాప్ కనుగొనబడలేదు" : language === "hi" ? "कोई दुकान नहीं मिली" : "No suppliers match your search"}
              </Text>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredWholesalers.map(ws => (
                <TouchableOpacity
                  key={ws.id}
                  style={[
                    styles.wsOptionCard,
                    {
                      backgroundColor: selectedWholesaler.id === ws.id ? colors.primary + "12" : colors.card,
                      borderColor: selectedWholesaler.id === ws.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedWholesaler(ws);
                    setShowWholesalerModal(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.82}
                >
                  <View style={styles.wsOptTop}>
                    <Text style={[styles.wsOptName, { color: colors.foreground }]}>{ws.name}</Text>
                    {selectedWholesaler.id === ws.id && <Feather name="check-circle" size={18} color={colors.primary} />}
                  </View>
                  <Text style={[styles.wsOptLoc, { color: colors.mutedForeground }]}>{ws.location}</Text>
                  <View style={styles.wsOptRow}>
                    <View style={styles.wsOptBadge}>
                      <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.wsOptBadgeText, { color: colors.mutedForeground }]}>{ws.distance}</Text>
                    </View>
                    <View style={styles.wsOptBadge}>
                      <Feather name="star" size={12} color="#F59E0B" />
                      <Text style={[styles.wsOptBadgeText, { color: colors.foreground }]}>{ws.rating}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.catalogBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                      onPress={() => { setCatalogWholesaler(ws); setShowCatalogModal(true); }}
                    >
                      <Text style={[styles.catalogBtnText, { color: colors.accent }]}>{t("viewCatalog")}</Text>
                    </TouchableOpacity>
                  </View>
                  {ws.specialOffer && (
                    <View style={[styles.offerBadge, { backgroundColor: colors.available + "18" }]}>
                      <Feather name="tag" size={12} color={colors.available} />
                      <Text style={[styles.offerText, { color: colors.available }]}>{ws.specialOffer}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => setShowWholesalerModal(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.foreground }]}>{t("cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Catalog Modal ── */}
      <Modal visible={showCatalogModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Everything at {catalogWholesaler.name}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>
              All items this wholesaler stocks. Green dot = in stock, red = out.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {catalogWholesaler.catalog.map((cat, i) => {
                const displayName = getItemNameInLanguage(cat, language);
                return (
                  <View
                    key={i}
                    style={[styles.catRow, { borderBottomColor: colors.border, opacity: cat.available ? 1 : 0.55 }]}
                  >
                    <View style={[styles.catDot, { backgroundColor: cat.available ? colors.available : colors.unavailable }]} />
                    <View style={styles.catInfo}>
                      <Text style={[styles.catName, { color: colors.foreground }]}>{displayName}</Text>
                      {cat.offer && (
                        <View style={[styles.catOfferBadge, { backgroundColor: colors.available + "18" }]}>
                          <Text style={[styles.catOfferText, { color: colors.available }]}>{cat.offer}</Text>
                        </View>
                      )}
                      <Text style={[styles.catMoq, { color: colors.mutedForeground }]}>
                        {t("minOrder")}: {cat.minOrderQty} {cat.unit}
                      </Text>
                    </View>
                    <View style={styles.catPriceBlock}>
                      <Text style={[styles.catPrice, { color: cat.available ? colors.foreground : colors.mutedForeground }]}>
                        ₹{cat.pricePerUnit}
                      </Text>
                      <Text style={[styles.catUnit, { color: colors.mutedForeground }]}>/{cat.unit}</Text>
                      {!cat.available && (
                        <Text style={[styles.noStockLabel, { color: colors.unavailable }]}>{t("noStock")}</Text>
                      )}
                    </View>
                    {/* + Add — drops the item into the order at the shop's
                        minimum-order quantity. Saves the kirana from
                        manually typing the name. Disabled if the shop
                        doesn't have stock. */}
                    {cat.available && (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          // Switch selected supplier to this catalog's
                          // wholesaler if it's not already selected, so
                          // the order resolves stock against the right shop.
                          setSelectedWholesaler(catalogWholesaler);
                          setItems(prev => [
                            ...prev,
                            {
                              name: cat.name,
                              nameTe: cat.nameTe ?? "",
                              nameHi: cat.nameHi ?? "",
                              quantity: `${cat.minOrderQty} ${cat.unit}`,
                              available: true,
                            },
                          ]);
                          setShowCatalogModal(false);
                        }}
                        style={[styles.addToOrderBtn, { backgroundColor: colors.primary }]}
                      >
                        <Feather name="plus" size={16} color="#FFF" />
                        <Text style={styles.addToOrderBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.selectSupplierBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                setSelectedWholesaler(catalogWholesaler);
                setShowCatalogModal(false);
                setShowWholesalerModal(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
            >
              <Text style={styles.selectSupplierBtnText}>{t("selectThisSupplier")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => setShowCatalogModal(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.foreground }]}>{t("cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10 },
  warnBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  warnText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  coverBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  coverText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  coverLink: { fontSize: 13, fontFamily: "Inter_700Bold" },
  suggestTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 4, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  suggestCard: { width: 180, borderRadius: 14, borderWidth: 1.5, padding: 12, gap: 4 },
  suggestName: { fontSize: 14, fontFamily: "Inter_700Bold", flexShrink: 1 },
  suggestLine: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  suggestSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  recommendBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recommendBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  stockReason: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  minOrderHint: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2, fontStyle: "italic" },
  suggestionsRow: { marginTop: 6, gap: 4 },
  suggestionsLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  suggestionsChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestionChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center" },
  suggestionChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  totalCard: { borderWidth: 1.5, borderRadius: 16, padding: 16, gap: 8, marginTop: 6 },
  totalTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  totalValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  totalDivider: { height: 1, marginVertical: 4 },
  grandTotalLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  grandTotalValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  totalNote: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4, fontStyle: "italic" },

  // Wholesaler card
  wholesalerCard: { borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 10 },
  wholesalerTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  wsIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  wsInfo: { flex: 1, gap: 4 },
  wsName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  wsSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  wsActions: { flexDirection: "row", gap: 8 },
  wsBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 9 },
  wsBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Items
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 },
  itemCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 10, marginBottom: 4 },
  // Top row of an item card — flexes name, unit-price, and line-total
  // into a single row so the kirana sees the line economics at a glance.
  itemRowTop: { flexDirection: "row", alignItems: "flex-start" },
  itemPriceUnit: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  itemTaxPct: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  itemLineTotal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  stockDot: { width: 11, height: 11, borderRadius: 6 },
  itemCenter: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemQty: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  itemActions: { flexDirection: "row", gap: 4 },
  actionIconBtn: { padding: 8, borderRadius: 8 },

  // Edit mode
  itemCardEditing: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10, marginBottom: 4 },
  editingName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  editFieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  editNameInput: { height: 42, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontFamily: "Inter_500Medium", fontSize: 15 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editQtyInput: { flex: 1, height: 42, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontFamily: "Inter_500Medium" },
  saveBtn: { height: 42, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  cancelBtn: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // Add item
  addRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 10, gap: 8, marginBottom: 4 },
  addInput: { flex: 2, height: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  addQtyInput: { flex: 1, height: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  addConfirmBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addItemBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", paddingVertical: 14, marginBottom: 4 },
  addItemBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  notesInput: { borderWidth: 1.5, borderRadius: 14, padding: 14, minHeight: 70, fontSize: 14, fontFamily: "Inter_400Regular" },
  sendBtn: { height: 62, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 4 },
  sendBtnText: { color: "#FFF", fontSize: 18, fontFamily: "Inter_700Bold" },
  sendHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },

  // Offer badge
  offerBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start", marginTop: 2 },
  offerText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  compareBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  compareTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  compareSub: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%", gap: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalCloseBtn: { height: 50, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  modalCloseBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Wholesaler option
  wsOptionCard: { borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 8, marginBottom: 10 },
  wsOptTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wsOptName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  wsOptLoc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  wsOptRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  wsOptBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  wsOptBadgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  catalogBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  catalogBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Catalog rows
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  catDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  catInfo: { flex: 1, gap: 3 },
  catName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  catOfferBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  catOfferText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  catMoq: { fontSize: 11, fontFamily: "Inter_400Regular" },
  catPriceBlock: { alignItems: "flex-end" },
  // Compact + Add button at the end of each price-list row.
  addToOrderBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
  addToOrderBtnText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 12 },
  // Address picker chips — two side-by-side rows showing the saved
  // default + an "Add new" option. Each chip is full-width on its
  // own row for clarity (flexBasis: 100%).
  addrChip: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1.5, flexBasis: "100%" },
  addrChipLabel: { fontFamily: "Inter_700Bold", fontSize: 13 },
  addrChipPreview: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  // Search bar at the top of the supplier-picker modal.
  wsSearchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 10 },
  wsSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  catPrice: { fontSize: 16, fontFamily: "Inter_700Bold" },
  catUnit: { fontSize: 11, fontFamily: "Inter_400Regular" },
  noStockLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },

  selectSupplierBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  selectSupplierBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});
