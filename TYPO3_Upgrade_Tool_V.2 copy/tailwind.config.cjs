/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(249, 115, 22)', // Bright orange
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#333333', // Dark gray
          foreground: '#FFFFFF',
        },
        background: "#FFFFFF",
        foreground: "#000000",
        card: "#FFFFFF",
        "card-foreground": "#000000",
        border: "#E5E7EB",
        input: "#E5E7EB",
        ring: "rgb(249, 115, 22)",
        destructive: {
          DEFAULT: "#FF0000",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F3F4F6",
          foreground: "#6B7280",
        },
        accent: {
          DEFAULT: "#F9FAFB",
          foreground: "#000000",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#000000",
        },
      },
    },
  },
  plugins: [],
}

