"use client";

import React, { ReactNode, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

interface RouteGuardProps {
  children: ReactNode;
}

const PUBLIC_PATHS = ["/login", "/"];

export default function RouteGuard({ children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_PATHS.includes(pathname);
    const isHrOnly = pathname.startsWith("/hr");

    if (!user && !isPublic) {
      // Not logged in — send to login
      router.replace("/login");
    } else if (user && isPublic) {
      // Already logged in — leave login / root immediately
      router.replace(user.role === "hr" ? "/hr/dashboard" : "/employee/dashboard");
    }
  }, [user, pathname, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isHrOnly = pathname.startsWith("/hr");

  if (!user && !isPublic) {
    return null;
  }

  // 403 view for non-HR users accessing HR routes
  if (user && isHrOnly && user.role !== "hr") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl shadow-red-500/5">
          <div className="text-red-500 text-6xl mb-4">🛡️</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 mb-2">
            403 Unauthorized
          </h1>
          <p className="text-slate-400 text-sm mb-6">
            Access to this workspace segment is strictly restricted to HR
            Administrators.
          </p>
          <button
            onClick={() => router.push("/employee/dashboard")}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 transition-colors font-semibold text-sm rounded-xl text-white shadow-lg shadow-indigo-500/20"
          >
            Return to Employee Portal
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
