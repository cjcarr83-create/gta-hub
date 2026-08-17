import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Used in Client Components. Anon key only — RLS enforces access.
//
// NOTE: not parameterized with a generated Database type yet — the
// hand-written type in lib/database.types.ts describes row shapes for
// app code to import directly, but isn't a full Supabase schema
// generic. Once this runs against a real project, regenerate with
// `npx supabase gen types typescript` and parameterize this client
// with it for full query-builder type inference.
//
// Cached as a singleton (same lazy pattern as lib/mux.ts's getMux())
// so components that call createClient() on every render — e.g. a
// form that re-renders on each keystroke — don't spin up a fresh
// GoTrueClient each time. Supabase itself warns about this: multiple
// concurrent GoTrueClient instances in one browser context race over
// the same storage key and can leave auth state inconsistent.
let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
