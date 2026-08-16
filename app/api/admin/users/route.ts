import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { isAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const trusted = createTrustedClient();
  const { data: users } = await trusted
    .from("profiles")
    .select("id, username, display_name, avatar_url, account_state, is_verified, wanted_level, created_at")
    .ilike("username", `%${query}%`)
    .limit(20);

  return NextResponse.json({ users: users ?? [] });
}
