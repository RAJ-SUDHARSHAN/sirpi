/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class", // This enables dark mode with class
  theme: {
    extend: {
      colors: {
        // Main brand colors
        primary: {
          DEFAULT: "#0070F3", // Blue for primary actions
          dark: "#0050C5",
          light: "#3291FF",
        },
        dark: {
          background: "#0A0A0A",
          surface: "#121212",
          card: "#1E1E1E",
          border: "#2A2A2A",
          text: {
            primary: "#FFFFFF",
            secondary: "#A0A0A0",
            tertiary: "#6A6A6A",
          },
        },
        // Light mode colors
        light: {
          background: "#FFFFFF",
          surface: "#F5F5F5",
          card: "#FFFFFF",
          border: "#EAEAEA",
          text: {
            primary: "#000000",
            secondary: "#666666",
            tertiary: "#8F8F8F",
          },
        },
        // Status colors
        status: {
          success: "#0070F3",
          warning: "#F5A623",
          error: "#EE0000",
          info: "#0070F3",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
