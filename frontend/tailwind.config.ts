import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── FlowDesk Brand Tokens ──────────────────────────────────────────────
        canvasBg:         "#F8FAFC",  // Off-white/slate-50 canvas
        contrastText:     "#0F172A",  // Slate-900 primary text
        primaryAccent:    "#8B5CF6",  // Lavender-purple
        secondaryElement: "#E2E8F0",  // Slate-200 dividers
        softHighlight:    "#EDE9FE",  // Soft lavender highlight
        successBadge:     "#10B981",  // Emerald

        // ── Functional Layout Aliases ─────────────────────────────────────────
        cardBacking:    "#FFFFFF",    // White cards
        sidebarBacking: "#F1F5F9",    // Light slate sidebar

        // ── Legacy mappings kept for existing Tailwind classes ────────────────
        "vanilla-cream":    "#F8FAFC",
        "blush-petal":      "#EDE9FE",
        "rosewood":         "#8B5CF6",
        "sage-leaf":        "#10B981",
        "misty-sky":        "#E2E8F0",
        "midnight-lagoon":  "#0F172A",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
