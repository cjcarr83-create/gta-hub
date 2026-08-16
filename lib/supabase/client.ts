import { createBrowserClient } from "@supabase/ssr";

// Used in Client Components. Anon key only — RLS enforces access.
//
// NOTE: not parameterized with a generated Database type yet — the
// hand-written type in lib/database.types.ts describes row shapes for
// app code to import directly, but isn't a full Supabase schema
// generic. Once this runs against a real project, regenerate with
// `npx supabase gen types typescript` and parameterize this client
// with it for full query-builder type inference.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
