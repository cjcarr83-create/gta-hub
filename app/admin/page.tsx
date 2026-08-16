import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import AdminConsole from "@/components/admin/AdminConsole";

// This is the actual gate — not a UI hide/show. A non-admin hitting
// /admin gets a genuine 404, not a page that renders and then hides
// buttons with CSS. The API routes underneath (app/api/admin/*) also
// independently re-check admin status on every call — this page-level
// check is defense in depth, not the only thing standing between a
// non-admin and these actions.
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.id))) {
    notFound();
  }

  return <AdminConsole />;
}
