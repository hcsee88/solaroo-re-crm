/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Monday.com sidebar navy
        sidebar: {
          DEFAULT: "#1c1f3b",
          hover: "#2a2e52",
          active: "#313560",
          text: "rgba(255,255,255,0.85)",
          "text-muted": "rgba(255,255,255,0.5)",
        },
        // Domain palette — solar (yellow/amber)
        solar: {
          50:  "#fefce8",
          100: "#fef9c3",
          400: "#facc15",
          500: "#eab308",
          600: "#ca8a04",
          700: "#a16207",
        },
        // Domain palette — BESS (blue)
        bess: {
          50:  "#eff6ff",
          100: "#dbeafe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // Monday status colors
        status: {
          green:  "#00ca72",
          orange: "#fdab3d",
          red:    "#e2445c",
          purple: "#a25ddc",
          blue:   "#0073ea",
          gray:   "#c4c4c4",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        // Monday-style card elevation
        card: "0 1px 4px rgba(26,26,67,0.08), 0 0 1px rgba(26,26,67,0.08)",
        "card-hover": "0 4px 12px rgba(26,26,67,0.12), 0 0 1px rgba(26,26,67,0.08)",
        dropdown: "0 8px 24px rgba(26,26,67,0.16)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
