"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "./api";

interface User {
  id: number;
  company_email: str;
  role: "hr" | "employee";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginMock: (email: string, role: "hr" | "employee") => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check local storage for token and user on boot
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const loginWithGoogle = async (credential: string) => {
    try {
      setLoading(true);
      const res = await api.post<{ access_token: string; user: User }>("/api/v1/auth/google", {
        token: credential,
      });
      
      const tokenVal = res.access_token;
      const userVal = res.user;

      localStorage.setItem("token", tokenVal);
      localStorage.setItem("user", JSON.stringify(userVal));
      setToken(tokenVal);
      setUser(userVal);
      
      if (userVal.role === "hr") {
        router.push("/hr");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setToken(null);
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginMock = async (email: string, role: "hr" | "employee") => {
    // In local development, if backend google OIDC is in mock/bypass mode, we hit auth/google
    // or simulate it with a mock user. Since we need local testing to work unblocked:
    try {
      setLoading(true);
      // Construct a mock OIDC token string to satisfy endpoint signature
      const mockOidcToken = `mock-credential-for-${email}-${role}`;
      const res = await api.post<{ access_token: string; user: User }>("/api/v1/auth/google", {
        id_token: mockOidcToken,
        email_override: email, // Backend handles custom payloads in dev mode
        role_override: role
      });

      const tokenVal = res.access_token;
      const userVal = res.user;

      localStorage.setItem("token", tokenVal);
      localStorage.setItem("user", JSON.stringify(userVal));
      setToken(tokenVal);
      setUser(userVal);

      if (userVal.role === "hr") {
        router.push("/hr");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      // Offline fallback: purely local mock authentication if backend is completely down
      console.warn("Backend auth failed or unreachable. Falling back to frontend-only mock state: ", err);
      const mockUser: User = {
        id: role === "hr" ? 1 : 2,
        company_email: email,
        role: role,
      };
      const mockToken = "mock_jwt_token_frontend_fallback";
      localStorage.setItem("token", mockToken);
      localStorage.setItem("user", JSON.stringify(mockUser));
      setToken(mockToken);
      setUser(mockUser);
      if (role === "hr") {
        router.push("/hr");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    router.push("/");
  };

  // Enforce role routing guards on change
  useEffect(() => {
    if (loading) return;
    
    const isPublic = pathname === "/";
    if (!user && !isPublic) {
      router.push("/");
    } else if (user) {
      if (pathname.startsWith("/hr") && user.role !== "hr") {
        router.push("/dashboard");
      } else if (pathname.startsWith("/dashboard") && user.role === "hr") {
        router.push("/hr");
      } else if (isPublic) {
        router.push(user.role === "hr" ? "/hr" : "/dashboard");
      }
    }
  }, [user, pathname, loading]);

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithGoogle, loginMock, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
