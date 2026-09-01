import type { Config } from "tailwindcss";

// Design tokens — "Vice City neon" direction (Round 11 restyle, replacing
// the earlier "sun-bleached Los Santos" warm/amber palette per direct
// creative direction from a reference mockup): near-black violet-navy
// background, a hot pink -> electric violet gradient as the signature
// accent, cyan reserved for live/success states, a vivid red reserved
// for danger/destructive actions.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0B0712", // page background
          panel: "#170F26", // card/panel background
          line: "#2E2545", // hairline borders
        },
        frost: {
          DEFAULT: "#F5F1FA", // primary text
          muted: "#9C93B8", // secondary text
        },
        neon: {
          pink: "#FF2E93", // primary accent — signature gradient start
          violet: "#7C4DFF", // primary accent — signature gradient end
        },
        live: {
          cyan: "#22D3EE", // reserved: live indicators, success, money-positive
        },
        blood: "#FF3B4E", // reserved: destructive actions, wanted/danger states
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"], // condensed, heavy — headers, nav
        script: ["var(--font-script)", "cursive"], // brush-marker accent — brand wordmark only
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        "neon-gradient": "linear-gradient(135deg, #FF2E93 0%, #7C4DFF 100%)",
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "14px",
        lg: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
