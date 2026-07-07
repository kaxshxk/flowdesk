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
        canvasBg:         "#FFF7E6",  // Vanilla Cream – base page backdrop
        contrastText:     "#2D3A47",  // Midnight Lagoon – primary type / icons
        primaryAccent:    "#B46A72",  // Rosewood – buttons, active states, CTAs
        secondaryElement: "#A9B7C6",  // Misty Sky – secondary UI, borders, tags
        softHighlight:    "#F7C8D3",  // Blush Petal – warm accent, hover badges
        successBadge:     "#A8B58A",  // Sage Leaf – success states, clock-in

        // ── Functional Layout Aliases ─────────────────────────────────────────
        cardBacking:    "#A9B7C6",    // Misty Sky  – card / panel backgrounds
        sidebarBacking: "#2D3A47",   // Midnight Lagoon – sidebar / nav shell

        // ── Legacy mappings kept for existing Tailwind classes ────────────────
        "vanilla-cream":    "#FFF7E6",
        "blush-petal":      "#F7C8D3",
        "rosewood":         "#B46A72",
        "sage-leaf":        "#A8B58A",
        "misty-sky":        "#A9B7C6",
        "midnight-lagoon":  "#2D3A47",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
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
