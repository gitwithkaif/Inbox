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
        cream: "#f4f1ec",
        navy: {
          DEFAULT: "#14161f",
          hover: "#222533",
          light: "#2a2e40",
        },
        orange: {
          accent: "#e08a3c",
          hover: "#cf7a2c",
          light: "#fef3e9",
        },
        card: {
          border: "#e5e0d8",
          DEFAULT: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
