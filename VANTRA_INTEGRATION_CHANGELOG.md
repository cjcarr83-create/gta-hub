# Vantra Studios Brand Integration — Changelog

## GTAHUB-side changes (Part B)

| File | Change |
|---|---|
| `lib/vantra.ts` | New. `VANTRA_STUDIOS_URL` constant, configurable via `NEXT_PUBLIC_VANTRA_STUDIOS_URL`, defaults to `https://vantrastudios.com`. No hard dependency — this is a link destination, never fetched or depended on at runtime. |
| `components/PoweredByVantra.tsx` | New. Small text-link attribution component, per the brand spec's explicit instruction that Vantra attribution stays "small and secondary" inside GTAHUB. |
| `app/about/page.tsx` | New. States what GTAHUB is, the Rockstar/Take-Two non-affiliation disclaimer (carried over from the root layout's existing description), and the Vantra Studios attribution with a link. Includes its own `Metadata` export. |
| `app/profile/[username]/page.tsx` | Added a small "About GTAHUB" link, own-profile-only, below the Garage section. This is the discovery path to the About page — deliberately placed on the profile screen rather than feed/live/video, per the spec's explicit "do not place large Vantra branding over feed/video/live screens." |
| `app/layout.tsx` | Added `creator`/`publisher` metadata fields identifying Vantra Studios, per Part B item 4. Does not change any visible UI. |
| `.env.example` | Added `NEXT_PUBLIC_VANTRA_STUDIOS_URL` with inline documentation. |

**Confirmed:** GTAHUB's own color system, navigation, and logo remain
completely unchanged and dominant throughout the actual app — nothing
above touches `tailwind.config.ts`, `styles/globals.css`, or any
existing component's visual treatment. The only new user-facing surface
is the `/about` page itself and one small link to reach it.

## Vantra Studios website deliverable (Part C)

Delivered as a separate, self-contained folder —
`vantra-site-integration/` — since the actual Vantra Studios website
source wasn't provided. Nothing was patched against unknown files.

Contents:
- `components/GtahubProductShowcase.tsx` — React/Tailwind version
- `components/gtahub-showcase.html` — plain HTML/CSS version
- `README.md` — integration steps, image guidance, accessibility notes,
  and a design flag (see below)

## A decision worth explaining: the concept image wasn't used directly

The supplied `GTAHUB_V2_UI_CONCEPT.png` uses:
1. A "GTAHUB" wordmark treatment that closely echoes the actual *Grand
   Theft Auto* box-art logo styling — closer to trademark-adjacent
   territory than GTAHUB's actual plain-text wordmark.
2. A generic dark-background-plus-neon-purple palette that doesn't match
   what GTAHUB's real app actually looks like (the app uses an original
   "sun-bleached Los Santos" identity — warm asphalt, amber→magenta
   dusk gradient — chosen specifically across earlier build rounds to
   avoid both the generic-look problem and unnecessary closeness to
   Rockstar/Take-Two's actual branding).

Both showcase components use an abstract placeholder for the product
visual instead, with the reasoning documented in
`vantra-site-integration/README.md`. Real GTAHUB screenshots (showing
the actual app, in its actual identity) should replace the placeholder
before this goes live — not the concept art.

The purple/blue glow treatment in the showcase card itself *was* kept,
since `BRAND_ARCHITECTURE.md` explicitly scopes that treatment to the
Vantra Studios showcase context only, not to GTAHUB's own app — that
part of the brief is followed as specified.

## Verification against the spec's own checklist

- **Desktop/mobile behavior documented:** yes, in
  `vantra-site-integration/README.md`.
- **GTAHUB remains technically standalone:** confirmed — the showcase
  component makes no calls to GTAHUB's Supabase/Stripe/Mux
  infrastructure and requires no GTAHUB environment variables.
- **No privileged secrets in the marketing component:** confirmed by
  inspection — `GtahubProductShowcase.tsx` and `gtahub-showcase.html`
  take only a public URL as input.
