import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type UserRole = "kirana" | "wholesaler";

export interface User {
  phone: string;
  role: UserRole;
  name: string;
  shopName: string;
  trustedWholesalerId?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  generatedOtp: string | null;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string, role: UserRole) => Promise<boolean>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  selectedRole: UserRole;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_USERS: Record<string, User> = {
  "9999999999": { phone: "9999999999", role: "kirana", name: "Raju Reddy", shopName: "Raju Kirana Store", trustedWholesalerId: "w001" },
  "8888888888": { phone: "8888888888", role: "wholesaler", name: "Suresh Guptha", shopName: "Suresh Wholesale" },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("kirana");

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("lasa_user");
        if (stored) setUser(JSON.parse(stored));
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(otp);
    console.log(`OTP for ${phone}: ${otp}`);
    await new Promise((r) => setTimeout(r, 500));
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string, role: UserRole): Promise<boolean> => {
    if (otp !== generatedOtp && otp !== "1234") return false;
    const existing = DEMO_USERS[phone];
    const newUser: User = existing ?? {
      phone,
      role,
      name: role === "wholesaler" ? "Wholesaler" : "Shop Owner",
      shopName: role === "wholesaler" ? "My Wholesale" : "My Kirana Store",
    };
    newUser.role = role;
    await AsyncStorage.setItem("lasa_user", JSON.stringify(newUser));
    setUser(newUser);
    setGeneratedOtp(null);
    return true;
  }, [generatedOtp]);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("lasa_user");
    setUser(null);
  }, []);

  const setRole = useCallback((role: UserRole) => {
    setSelectedRole(role);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, generatedOtp, sendOtp, verifyOtp, logout, setRole, selectedRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
