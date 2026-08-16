// Used only to dedupe anonymous view/viewer counts (see H12 fix routes).
// Not an auth mechanism, not stored server-side against any identity —
// just a random id so "the same anonymous browser refreshing the page"
// doesn't count as five different viewers.
export function getAnonSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "gtahub_anon_session";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}
