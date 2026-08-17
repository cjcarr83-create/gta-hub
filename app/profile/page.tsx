import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// H5 fix: BottomNav links to /profile but Round 1 only shipped
// /profile/[username]. This resolves the current user and redirects to
// their own profile page, or to sign-in if nobody's logged in.
//
// force-dynamic is explicit here (matching crews/page.tsx and
// launch-hub/page.tsx) rather than relying on Next's implicit
// cookie-usage inference — this page's whole job is a per-request
// redirect, and some hosting adapters build their function-routing
// config from the explicit route segment config rather than
// re-deriving Next's own dynamic-API usage tracking.
export const dynamic = "force-dynamic";

export default async function CurrentUserProfileRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/sign-in");

  redirect(`/profile/${profile.username}`);
}
