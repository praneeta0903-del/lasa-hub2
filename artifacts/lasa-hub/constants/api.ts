import { Platform } from "react-native";

function getApiBase(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.includes("replit.dev") || host.includes("janeway")) {
      // Replit URL pattern: {UUID}-{PORT}-{suffix}.{domain}
      // UUID is standard 8-4-4-4-12 hex format, followed by port number, then suffix
      const match = host.match(
        /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d+)-(.+)$/i
      );
      if (match) {
        // match[1] = REPL_ID, match[2] = current port, match[3] = suffix.domain
        return `https://${match[1]}-8080-${match[3]}`;
      }
    }
  }
  return "http://localhost:8080";
}

export const API_BASE = getApiBase();

export async function apiPost(path: string, body: Record<string, unknown>) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}
