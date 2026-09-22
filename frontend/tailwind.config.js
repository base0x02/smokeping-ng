/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#1a1a19",
          raised: "#212120",
          page: "#0d0d0d",
        },
        ink: {
          primary: "#ffffff",
          secondary: "#c3c2b7",
          muted: "#898781",
        },
        line: {
          hairline: "#2c2c2a",
          baseline: "#383835",
        },
        accent: {
          DEFAULT: "#3987e5",
          soft: "#1c5cab",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
