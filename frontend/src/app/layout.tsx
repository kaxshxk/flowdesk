import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowDesk - HR-Productivity Hub",
  description: "Secure, real-time HR portal, task audits, activity verification, and workspace management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#F9FAFC] text-[#1E293B] min-h-screen">
        <AuthProvider>
          <RouteGuard>
            {children}
          </RouteGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
