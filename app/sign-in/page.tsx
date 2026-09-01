"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  // createClient() is called here, inside the handlers, rather than at the
  // top of the component. next build prerenders this page, which renders
  // the component but never invokes onClick handlers — so constructing the
  // Supabase client eagerly at render time crashed the build whenever
  // NEXT_PUBLIC_SUPABASE_URL/ANON_KEY weren't present at build time
  // (createBrowserClient throws synchronously if they're missing). Deferring
  // construction to click-time matches how lib/mux.ts's getMux() is used —
  // called at the point of use, not held in a render-scope variable.
  async function signUp() {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    setMessage(error ? error.message : "Check your email to confirm your account.");
  }

  async function signIn() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }

    // Send fresh accounts straight into character creation instead of
    // leaving it undiscoverable until they try to enter The Block (the
    // only other place that checks for a missing avatar_url).
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", data.user.id)
      .single();

    router.push(profile?.avatar_url ? "/" : "/onboarding/avatar");
  }

  return (
    <main className="px-4 pt-6">
      <div className="mb-6">
        <Logo size="sm" />
        <p className="mt-2 text-sm text-frost-muted">
          Free to join — post clips, go live, run a crew, and jump into The Block
          while you wait for a stream to start.
        </p>
      </div>
      <div className="card space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-ink-line bg-ink px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-ink-line bg-ink px-3 py-2"
        />
        <input
          type="text"
          placeholder="Username (sign up only)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded border border-ink-line bg-ink px-3 py-2"
        />
        <button onClick={signUp} className="btn-primary w-full">
          Sign Up
        </button>
        <button onClick={signIn} className="btn-secondary w-full">
          Log In
        </button>
        {message && <p className="text-sm text-frost-muted">{message}</p>}
      </div>
    </main>
  );
}
