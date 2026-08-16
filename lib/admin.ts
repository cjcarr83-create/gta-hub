import "server-only";
import { createTrustedClient } from "@/lib/supabase/trusted";

// The single check every admin route relies on. Queries admin_users via
// the trusted (service-role) client — that table has zero client RLS
// policies, so this is the only code path that can ever read it. A
// forged request, a tampered client, or a copy-pasted fetch call from
// devtools cannot bypass this: the check happens entirely server-side
// against data the client never has access to.
export async function isAdmin(userId: string): Promise<boolean> {
  const trusted = createTrustedClient();
  const { data } = await trusted
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  return !!data;
}
