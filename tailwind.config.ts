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
        // Story 8.1 (Epic 8): "Artisanal Warm" / Terracotta & Olive token
        // layer, from DESIGN.md's frontmatter. `brand` above stays until
        // Epic 8's later stories migrate the pages that still reference it.
        cream: "#f7ecd8",
        "cream-deep": "#ecdcc0",
        paper: "#fffdf6",
        "card-border": "#e9dbb9",
        line: "#ddc79f",
        "field-border": "#8a7550",
        terracotta: "#a83f22",
        "terracotta-deep": "#7a2e19",
        "terracotta-light": "#c9673f",
        olive: "#55622f",
        "olive-deep": "#3d4722",
        "olive-light": "#6b7a3c",
        "sage-light": "#dde3c8",
        "selected-wash": "#fdf3ec",
        "sold-out-bg": "#e6dbc0",
        "disabled-outline": "#b9ab8c",
        "placeholder-text": "#78654c",
        ink: "#2b2015",
        "ink-soft": "#5c4d3a",
      },
      // DESIGN.md's two type families. `font-sans` is redefined here rather
      // than left as Tailwind's built-in default because Tailwind's default
      // stack (ui-sans-serif, system-ui, ...) doesn't exactly match
      // DESIGN.md's documented sans list.
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      // DESIGN.md's 19 typography roles. Size/weight/line-height/tracking
      // only - pair with `font-serif` or `font-sans` per DESIGN.md#Typography
      // (headings/titles/lede copy use font-serif, everything functional
      // uses font-sans), and Tailwind's built-in `italic` utility for the
      // two roles DESIGN.md marks fontStyle: italic (body-lede, body-card-desc).
      fontSize: {
        "display-lg": ["52px", { lineHeight: "1.05", letterSpacing: "-0.01em", fontWeight: "400" }],
        "display-md": ["46px", { lineHeight: "1.08", letterSpacing: "-0.01em", fontWeight: "400" }],
        "display-sm": ["40px", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "400" }],
        "display-xs": ["38px", { lineHeight: "1.08", letterSpacing: "-0.01em", fontWeight: "400" }],
        "headline-md": ["28px", { lineHeight: "1.2", fontWeight: "400" }],
        "headline-sm": ["24px", { lineHeight: "1.2", fontWeight: "400" }],
        "card-title": ["24px", { lineHeight: "1.2", fontWeight: "400" }],
        "item-title-lg": ["21px", { lineHeight: "1.25", fontWeight: "400" }],
        "item-title": ["18px", { lineHeight: "1.25", fontWeight: "400" }],
        "total-display": ["30px", { lineHeight: "1.1", fontWeight: "400" }],
        "body-lede": ["18px", { lineHeight: "1.5" }],
        "body-card-desc": ["15px", { lineHeight: "1.5" }],
        "label-caps": ["12px", { fontWeight: "700", letterSpacing: "0.18em" }],
        "label-caps-tight": ["12px", { fontWeight: "700", letterSpacing: "0.14em" }],
        "field-label": ["12px", { fontWeight: "600", lineHeight: "1.4" }],
        "body-ui": ["14px", { fontWeight: "400", lineHeight: "1.4" }],
        "ui-sm": ["13px", { fontWeight: "400", lineHeight: "1.4" }],
        price: ["15px", { fontWeight: "700" }],
        "button-label": ["13px", { fontWeight: "700", letterSpacing: "0.02em" }],
        "badge-label": ["10px", { fontWeight: "700", letterSpacing: "0.1em" }],
      },
      // DESIGN.md's rounded scale. NOTE: these key names intentionally match
      // Tailwind's own default borderRadius scale (sm/DEFAULT/md/lg/xl/full),
      // per the story's own token-to-utility-class mapping convention — see
      // this story's Completion Notes for the resulting site-wide corner-
      // radius side effect on not-yet-restyled pages.
      borderRadius: {
        sm: "10px",
        DEFAULT: "14px",
        md: "16px",
        lg: "18px",
        xl: "20px",
        full: "9999px",
      },
      spacing: {
        gutter: "40px",
        "section-gap": "40px",
        "divider-gap": "30px",
        "list-gap": "16px",
        "grid-gap": "24px",
        "panel-gap": "22px",
        tight: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
