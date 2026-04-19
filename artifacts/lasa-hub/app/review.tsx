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
import { checkInventoryAvailability, useOrders, type OrderItem } from "@/context/OrderContext";
import { WHOLESALERS, getItemAvailability, getItemNameInLanguage, type Wholesaler } from "@/data/wholesalers";
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
  const { t, language } = useLanguage();
  const { createOrder } = useOrders();
  const params = useLocalSearchParams<{ items?: string; mode?: string }>();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Wholesaler selection
  const [selectedWholesaler, setSelectedWholesaler] = useState<Wholesaler>(WHOLESALERS[0]);
  const [showWholesalerModal, setShowWholesalerModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogWholesaler, setCatalogWholesaler] = useState<Wholesaler>(WHOLESALERS[0]);

  // Inline item editing
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editQtyValue, setEditQtyValue] = useState("");

  // Add item
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);

  useEffect(() => {
    let baseItems: OrderItem[] = [];
    if (params.mode === "quick") {
      baseItems = QUICK_REORDER_ITEMS;
    } else if (params.items) {
      try { baseItems = JSON.parse(decodeURIComponent(params.items)); } catch {}
    }
    // Re-check availability against selected wholesaler
    setItems(baseItems.map(i => ({
      ...i,
      available: getItemAvailability(selectedWholesaler.id, i.name),
    })));
  }, [params.items, params.mode]);

  // Re-check availability when wholesaler changes
  useEffect(() => {
    setItems(prev => prev.map(i => ({
      ...i,
      available: getItemAvailability(selectedWholesaler.id, i.name),
    })));
  }, [selectedWholesaler]);

  const removeItem = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const startEdit = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingIdx(idx);
    setEditQtyValue(items[idx].quantity);
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    setItems(prev => prev.map((item, i) =>
      i === editingIdx ? { ...item, quantity: editQtyValue } : item
    ));
    setEditingIdx(null);
    setEditQtyValue("");
  };

  const addItem = () => {
    if (!newItemName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newItem: OrderItem = {
      name: newItemName.trim(),
      quantity: newItemQty.trim() || "1",
      available: getItemAvailability(selectedWholesaler.id, newItemName.trim()),
    };
    setItems(prev => [...prev, newItem]);
    setNewItemName("");
    setNewItemQty("");
    setShowAddRow(false);
  };

  const handleSendOrder = async () => {
    if (items.length === 0) {
      Alert.alert("", t("addItem"));
      return;
    }
    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await createOrder({
      kiranaPhone: user?.phone ?? "0000000000",
      kiranaName: user?.name ?? "Shop Owner",
      shopName: user?.shopName ?? "My Store",
      wholesalerId: selectedWholesaler.id,
      items,
      status: "pending",
      notes,
    });
    setIsSending(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/order-sent" as any);
  };

  const availableCount = items.filter(i => i.available).length;
  const unavailableCount = items.filter(i => !i.available).length;

  const getItemDisplayName = (name: string) => {
    if (language === "en") return name;
    const w = WHOLESALERS[0];
    const cat = w.catalog.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!cat) return name;
    return getItemNameInLanguage(cat, language);
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
        <View style={{ width: 38 }} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.available + "18" }]}>
            <Text style={[styles.statNum, { color: colors.available }]}>{availableCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("available")}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.unavailable + "18" }]}>
            <Text style={[styles.statNum, { color: colors.unavailable }]}>{unavailableCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("unavailable")}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.primary + "18" }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{items.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("total")}</Text>
          </View>
        </Animated.View>

        {/* Wholesaler Selector */}
        <Animated.View entering={FadeInDown.delay(140).springify()} style={[styles.wholesalerCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }]}>
          <View style={styles.wholesalerTop}>
            <View style={[styles.wsIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="truck" size={20} color={colors.primary} />
            </View>
            <View style={styles.wsInfo}>
              <Text style={[styles.wsName, { color: colors.foreground }]}>{selectedWholesaler.name}</Text>
              <Text style={[styles.wsSub, { color: colors.mutedForeground }]}>
                {selectedWholesaler.distance}  •  ★ {selectedWholesaler.rating}
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
              // Edit mode
              <View style={[styles.itemCardEditing, { backgroundColor: colors.primary + "10", borderColor: colors.primary }]}>
                <Text style={[styles.editingName, { color: colors.foreground }]}>{getItemDisplayName(item.name)}</Text>
                <View style={styles.editRow}>
                  <TextInput
                    style={[styles.editQtyInput, { borderColor: colors.primary, color: colors.foreground, backgroundColor: colors.background }]}
                    value={editQtyValue}
                    onChangeText={setEditQtyValue}
                    placeholder={t("qtyPlaceholder")}
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus
                  />
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={saveEdit}>
                    <Text style={styles.saveBtnText}>{t("save")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={() => setEditingIdx(null)}>
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Normal mode
              <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.stockDot, { backgroundColor: item.available ? colors.available : colors.unavailable }]} />
                <View style={styles.itemCenter}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{getItemDisplayName(item.name)}</Text>
                  <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
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
            )}
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
            <ScrollView showsVerticalScrollIndicator={false}>
              {WHOLESALERS.map(ws => (
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
              {catalogWholesaler.name} — {t("catalog")}
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
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 2 },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },

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
  stockDot: { width: 11, height: 11, borderRadius: 6 },
  itemCenter: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemQty: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  itemActions: { flexDirection: "row", gap: 4 },
  actionIconBtn: { padding: 8, borderRadius: 8 },

  // Edit mode
  itemCardEditing: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10, marginBottom: 4 },
  editingName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
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
  catPrice: { fontSize: 16, fontFamily: "Inter_700Bold" },
  catUnit: { fontSize: 11, fontFamily: "Inter_400Regular" },
  noStockLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },

  selectSupplierBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  selectSupplierBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});
