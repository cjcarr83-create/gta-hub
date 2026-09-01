import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

// H7 fix (Round 2 audit): Round 1's lib/supabase/server.ts had a comment
// saying cookie writes were "safe to ignore if you have middleware
// refreshing sessions" — but no such middleware existed anywhere in the
// scaffold, so server-rendered auth state could silently go stale.
//
// Also named `proxy.ts` rather than `middleware.ts` per the Next.js 16
// rename (the framework upgrade in H8) — the file convention and the
// exported function name both changed from `middleware` to `proxy`.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() is what actually triggers a token refresh when
  // the access token is stale — without this call, the session cookie
  // silently expires mid-visit.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
