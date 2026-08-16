"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  async function signUp() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    setMessage(error ? error.message : "Check your email to confirm your account.");
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
    } else {
      router.push("/");
    }
  }

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-6 text-2xl">Sign in</h1>
      <div className="card space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-asphalt-line bg-asphalt px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-asphalt-line bg-asphalt px-3 py-2"
        />
        <input
          type="text"
          placeholder="Username (sign up only)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded border border-asphalt-line bg-asphalt px-3 py-2"
        />
        <button onClick={signUp} className="btn-primary w-full">
          Sign Up
        </button>
        <button onClick={signIn} className="btn-secondary w-full">
          Log In
        </button>
        {message && <p className="text-sm text-sand-muted">{message}</p>}
      </div>
    </main>
  );
}
