import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type OrderStatus = "pending" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled";

export interface OrderItem {
  name: string;
  quantity: string;
  available: boolean;
}

export interface Order {
  id: string;
  kiranaPhone: string;
  kiranaName: string;
  shopName: string;
  wholesalerId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount?: number;
  discount?: number;
  deliveryTime?: string;
  invoiceNote?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

interface OrderContextType {
  orders: Order[];
  isLoading: boolean;
  createOrder: (order: Omit<Order, "id" | "createdAt" | "updatedAt">) => Promise<Order>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>;
  getOrdersByKirana: (phone: string) => Order[];
  getOrdersByWholesaler: (id: string) => Order[];
  refreshOrders: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType | null>(null);

const DEMO_ORDERS: Order[] = [
  {
    id: "ord_001",
    kiranaPhone: "9999999999",
    kiranaName: "Raju Reddy",
    shopName: "Raju Kirana Store",
    wholesalerId: "w001",
    items: [
      { name: "Toor Dal", quantity: "5 kg", available: true },
      { name: "Rice Basmati", quantity: "10 kg", available: true },
      { name: "Sunflower Oil", quantity: "2 L", available: false },
      { name: "Sugar", quantity: "3 kg", available: true },
    ],
    status: "confirmed",
    totalAmount: 1850,
    discount: 50,
    deliveryTime: "Tomorrow 10 AM",
    invoiceNote: "Payment due on delivery",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 82800000).toISOString(),
  },
  {
    id: "ord_002",
    kiranaPhone: "9999999999",
    kiranaName: "Raju Reddy",
    shopName: "Raju Kirana Store",
    wholesalerId: "w001",
    items: [
      { name: "Biscuits Parle-G", quantity: "4 boxes", available: true },
      { name: "Tea Powder", quantity: "1 kg", available: true },
      { name: "Salt", quantity: "2 kg", available: true },
    ],
    status: "delivered",
    totalAmount: 620,
    deliveryTime: "Yesterday",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const DEMO_INVENTORY: Record<string, boolean> = {
  "Toor Dal": true,
  "Rice Basmati": true,
  "Sunflower Oil": false,
  "Sugar": true,
  "Wheat Flour": true,
  "Biscuits Parle-G": true,
  "Tea Powder": true,
  "Salt": true,
  "Chilli Powder": true,
  "Turmeric": true,
  "Milk Packet": false,
  "Coconut Oil": true,
  "Groundnut Oil": false,
  "Soap": true,
  "Shampoo": true,
  "Toothpaste": true,
  "Detergent": true,
  "Matches": true,
  "Candles": false,
  "Batteries": true,
};

export function checkInventoryAvailability(itemName: string): boolean {
  const normalized = itemName.trim();
  const key = Object.keys(DEMO_INVENTORY).find(
    k => k.toLowerCase() === normalized.toLowerCase()
  );
  if (key !== undefined) return DEMO_INVENTORY[key];
  return Math.random() > 0.25;
}

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("lasa_orders");
      if (stored) {
        setOrders(JSON.parse(stored));
      } else {
        setOrders(DEMO_ORDERS);
        await AsyncStorage.setItem("lasa_orders", JSON.stringify(DEMO_ORDERS));
      }
    } catch {
      setOrders(DEMO_ORDERS);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const saveOrders = useCallback(async (newOrders: Order[]) => {
    await AsyncStorage.setItem("lasa_orders", JSON.stringify(newOrders));
    setOrders(newOrders);
  }, []);

  const createOrder = useCallback(async (order: Omit<Order, "id" | "createdAt" | "updatedAt">) => {
    const newOrder: Order = {
      ...order,
      id: `ord_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newOrder, ...orders];
    await saveOrders(updated);
    return newOrder;
  }, [orders, saveOrders]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    const updated = orders.map(o =>
      o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
    );
    await saveOrders(updated);
  }, [orders, saveOrders]);

  const getOrdersByKirana = useCallback((phone: string) =>
    orders.filter(o => o.kiranaPhone === phone).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ), [orders]);

  const getOrdersByWholesaler = useCallback((id: string) =>
    orders.filter(o => o.wholesalerId === id).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ), [orders]);

  return (
    <OrderContext.Provider value={{ orders, isLoading, createOrder, updateOrder, getOrdersByKirana, getOrdersByWholesaler, refreshOrders: loadOrders }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be inside OrderProvider");
  return ctx;
}
