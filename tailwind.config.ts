import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": { from: { opacity: "0", transform: "scale(.96)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        aurora: { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
        float: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(30px,-24px) scale(1.08)" } },
        "pulse-ring": { "0%": { boxShadow: "0 0 0 0 hsl(var(--accent) / .45)" }, "100%": { boxShadow: "0 0 0 10px hsl(var(--accent) / 0)" } },
        "pop": { "0%": { transform: "scale(.6)", opacity: "0" }, "70%": { transform: "scale(1.15)" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: {
        "fade-up": "fade-up .5s cubic-bezier(.2,.7,.2,1) both",
        "fade-in": "fade-in .4s ease both",
        "scale-in": "scale-in .35s cubic-bezier(.2,.7,.2,1) both",
        shimmer: "shimmer 1.6s linear infinite",
        aurora: "aurora 6s ease infinite",
        float: "float 14s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.2s ease-out infinite",
        pop: "pop .35s cubic-bezier(.2,.7,.2,1) both",
      },
      fontFamily:{ sans: ["var(--font-sans)"], display: ["var(--font-display)"], serif: ["var(--font-serif)"] },
    },
  },
  plugins: [],
} satisfies Config;
