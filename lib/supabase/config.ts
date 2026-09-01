// Anon-key Supabase config, shared by the browser and server clients.
//
// NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are not secrets — the anon key is
// designed to be public and ships in the client bundle regardless; RLS
// (not key secrecy) is what actually protects data. The fallback values
// below point at the project's own "GTA HUB" Supabase instance so a
// deploy works out of the box without extra configuration; set the real
// env vars on the host to point at a different project instead.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jdrorgaalwqbswymxvwq.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkcm9yZ2FhbHdxYnN3eW14dndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Nzg1NzgsImV4cCI6MjEwMjQ1NDU3OH0.ed_T0sLIUWcq4l2-AXh1Cf5E33WZo1v2BvdrQCQCyc0";
