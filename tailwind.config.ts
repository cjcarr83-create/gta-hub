import type { Config } from "tailwindcss";

// Design tokens — "sun-bleached Los Santos" direction.
// Deliberately not the generic near-black + single neon accent look:
// warm asphalt background, dusk-gradient accents (amber -> magenta),
// a muted palm-teal reserved for live/success states only.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        asphalt: {
          DEFAULT: "#14120F", // page background
          panel: "#1E1B17", // card/panel background
          line: "#2C2822", // hairline borders
        },
        sand: {
          DEFAULT: "#EDE6D6", // primary text
          muted: "#9C9384", // secondary text
        },
        sunset: {
          amber: "#F2A93B", // primary accent — signature gradient start
          magenta: "#E14F63", // primary accent — signature gradient end
        },
        palm: {
          teal: "#2FA89A", // reserved: live indicators, success, money-positive
        },
        blood: "#C1373F", // reserved: destructive actions, wanted/danger states
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"], // condensed stencil-style headers
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        "dusk-gradient": "linear-gradient(135deg, #F2A93B 0%, #E14F63 100%)",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        lg: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
