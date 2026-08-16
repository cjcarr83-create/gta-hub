import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// M16 fix (Round 4 audit): next lint was removed in Next.js 16 —
// confirmed via nextjs.org/docs/app/guides/upgrading/version-16 — and
// next build no longer runs linting automatically either. Both
// eslint-config-next/core-web-vitals and /typescript export a plain
// Linter.Config[] (verified against the installed package's .d.ts,
// export = config), so they spread directly into this array.
const eslintConfig = [...nextCoreWebVitals, ...nextTypescript];

export default eslintConfig;
