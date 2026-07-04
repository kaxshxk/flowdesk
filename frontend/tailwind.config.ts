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
        background: "var(--background)",
        foreground: "var(--foreground)",
        teams: {
          brand: "#4F46E5", // Indigo / Teams-like color
          brandHover: "#4338CA",
          sidebar: "#201F1F",
          topbar: "#292828",
          darkBg: "#11100F",
          card: "#2F2F2F"
        }
      },
    },
  },
  plugins: [],
};
export default config;
