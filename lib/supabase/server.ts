import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

// Used in Server Components and route handlers. Still anon key + RLS —
// this is NOT the trusted/service-role client. See lib/supabase/trusted.ts
// for the service-role client used only in webhook/payment routes.
//
// H8 fix: cookies() must be awaited as of Next.js 15+ (React 19 async
// request APIs) — Round 1 called it synchronously, which Next 14 still
// allowed but 16 does not.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore now that
            // proxy.ts (H7 fix) actually refreshes the session.
          }
        },
      },
    }
  );
}
