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
        // Light mode colors
        "light-background": "var(--light-background)",
        "light-surface": "var(--light-surface)",
        "light-card": "var(--light-card)",
        "light-border": "var(--light-border)",
        "light-border-hover": "var(--light-border-hover)",
        "light-text-primary": "var(--light-text-primary)",
        "light-text-secondary": "var(--light-text-secondary)",
        "light-text-tertiary": "var(--light-text-tertiary)",

        // Dark mode colors
        "dark-background": "var(--dark-background)",
        "dark-surface": "var(--dark-surface)",
        "dark-card": "var(--dark-card)",
        "dark-border": "var(--dark-border)",
        "dark-border-hover": "var(--dark-border-hover)",
        "dark-text-primary": "var(--dark-text-primary)",
        "dark-text-secondary": "var(--dark-text-secondary)",
        "dark-text-tertiary": "var(--dark-text-tertiary)",

        // Brand colors
        primary: "var(--primary)",
        "primary-dark": "var(--primary-dark)",
        "primary-light": "var(--primary-light)",
        "primary-foreground": "var(--primary-foreground)",

        // Status colors
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
        info: "var(--info)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  darkMode: "class",
  plugins: [],
};

export default config;
