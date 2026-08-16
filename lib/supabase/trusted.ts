import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ⚠️ TRUSTED CLIENT — service-role key, bypasses RLS entirely.
//
// Import this ONLY in:
//   - app/api/webhooks/mux/route.ts   (writes video processing state)
//   - app/api/webhooks/stripe/route.ts (writes tips/ledger entries)
//   - app/api/tips/route.ts            (after Stripe payment confirmation)
//
// This is exactly the "trusted backend layer" described in
// 03_v2_blueprint and enforced by 09_security's checklist:
// "no service-role keys in client code." The `server-only` import above
// makes Next.js throw a build error if this file is ever pulled into a
// Client Component bundle.
export function createTrustedClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
