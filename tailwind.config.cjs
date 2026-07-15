/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{html,js}",
    "./.tmp/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        // RGB channels via CSS vars so dark mode remaps tokens site-wide
        primary: "rgb(var(--c-primary) / <alpha-value>)",
        secondary: "rgb(var(--c-secondary) / <alpha-value>)",
        tertiary: "rgb(var(--c-tertiary) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        light: "rgb(var(--c-light) / <alpha-value>)",
        green: "rgb(var(--c-green) / <alpha-value>)",
        text: "rgb(var(--c-text) / <alpha-value>)",
        /** Card / elevated surfaces (was hard-coded white) */
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        /** Page background */
        page: "rgb(var(--c-page) / <alpha-value>)",
        /** Solid navy panels (CTA etc.) — stays dark in both themes */
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        /** Pure white for text/icons on dark panels (never remapped) */
        ink: "#FFFFFF",
        /** Card borders (tuned separately from tertiary fills) */
        border: "rgb(var(--c-border) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["sans-serif"],
      },
      maxWidth: {
        content: "72rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
    },
  },
  plugins: [],
};
