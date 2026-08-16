import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// H5 fix: BottomNav links to /profile but Round 1 only shipped
// /profile/[username]. This resolves the current user and redirects to
// their own profile page, or to sign-in if nobody's logged in.
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
