"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface User {
  id: number;
  email: string;
  role: "hr" | "employee";
}

export interface AuthResult {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** Exchange a Google OIDC credential for a backend JWT and persist the session. */
  loginWithCredential: (credential: string) => Promise<void>;
  /** Drop the active session and return to /login. */
  logout: () => void;
}

/* ------------------------------------------------------------------ */
/*  JWT helper (lightweight – no library needed)                       */
/* ------------------------------------------------------------------ */

function parseJwt<T = Record<string, unknown>>(token: string): T | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Only redirect on an explicit login action, not on localStorage hydration
  const justLoggedIn = useRef(false);

  /* ---- Hydrate session from localStorage on first mount ---- */
  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      const payload = parseJwt<{ sub?: string; email?: string; role?: string }>(
        stored
      );
      if (payload) {
        setToken(stored);
        setUser({
          id: payload.sub ? parseInt(payload.sub, 10) : 0,
          email: payload.email ?? "",
          role: (payload.role as "hr" | "employee") ?? "employee",
        });
      } else {
        localStorage.removeItem("token");
      }
    }
    setLoading(false);
  }, []);

  /* ---- Core Google credential exchange ---- */
  const loginWithCredential = useCallback(
    async (credential: string) => {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: credential }),
      });

      if (!res.ok) {
        let detail = "Authentication failed. Please try again.";
        try {
          const data = await res.json();
          detail = data.detail || detail;
        } catch {
          /* keep default message */
        }
        const err = new Error(detail) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }

      const data: AuthResult = await res.json();

      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      justLoggedIn.current = true;
      setUser({
        id: data.user_id,
        email: data.email,
        role: data.role as "hr" | "employee",
      });
      // Redirect immediately here rather than in a side-effect
      router.push(data.role === "hr" ? "/hr/dashboard" : "/employee/dashboard");
    },
    [router]
  );

  /* ---- Redirect only on explicit login (not on localStorage hydration) ---- */
  useEffect(() => {
    if (!user || !justLoggedIn.current) return;
    justLoggedIn.current = false;
  }, [user]);

  /* ---- Logout ---- */
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, loginWithCredential, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
