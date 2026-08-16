import "server-only";
import Mux from "@mux/mux-node";

// Lazily constructed so that `next build` (which loads route modules to
// collect their config without real secrets present) doesn't crash — the
// Mux SDK throws eagerly in its constructor if MUX_TOKEN_ID/SECRET are
// missing. Deferring construction to first use means the crash (if envs
// are genuinely missing) happens at request time instead of build time,
// same as how Stripe is wired up elsewhere in this codebase.
let muxClient: Mux | undefined;

export function getMux(): Mux {
  if (!muxClient) {
    muxClient = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    });
  }
  return muxClient;
}
