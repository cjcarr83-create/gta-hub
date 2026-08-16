// Configurable per the brand integration spec — GTAHUB has no hard
// dependency on the Vantra Studios site being reachable; this is just a
// link destination, never an API call or data dependency.
export const VANTRA_STUDIOS_URL =
  process.env.NEXT_PUBLIC_VANTRA_STUDIOS_URL ?? "https://vantrastudios.com";
