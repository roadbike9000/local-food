import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // A warm palette that suits a local-food marketplace.
        brand: {
          DEFAULT: "#c2410c", // terracotta
          light: "#fb923c",
          dark: "#7c2d12",
        },
      },
    },
  },
  plugins: [],
};

export default config;
