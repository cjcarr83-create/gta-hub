"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle, type RefObject } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WorldCanvasHandle } from "@/components/world/WorldCanvas";

interface LogRow {
  id: string;
  user_id: string;
  content: string;
  scope: "district" | "nearby";
  created_at: string;
  username?: string;
}

const MAX_MESSAGE_LENGTH = 200;
const SEND_COOLDOWN_MS = 1500; // client-side courtesy throttle; the real
// limit is enforced server-side in the world_chat_log RLS insert policy
// (0002_avatars_and_world.sql) — this just keeps the UI from spamming
// requests that would get rejected anyway.

export interface WorldChatHandle {
  focusInput: () => void;
}

const WorldChat = forwardRef<WorldChatHandle, { canvasRef: RefObject<WorldCanvasHandle | null> }>(
  function WorldChat({ canvasRef }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focusInput: () => inputRef.current?.focus() }), []);
  const [tab, setTab] = useState<"district" | "nearby">("district");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<LogRow[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const lastSentRef = useRef(0);
  // postgres_changes payloads only carry raw row columns (no join to
  // profiles), unlike the initial batch load below which embeds
  // profiles(username) — without this cache, a message that streams in
  // live would render "@unknown" even though the same message shows
  // correctly after a page refresh. Resolved once per user_id, reused
  // after that.
  const usernameCacheRef = useRef<Map<string, string>>(new Map());

  // District chat gets a scrollback (world_chat_log is durable and
  // publicly readable — see the migration). Nearby chat deliberately
  // has no scrollback here: it only makes sense in the context of who
  // was actually near you when it was said, which this simple log
  // doesn't capture — the live bubble on the canvas is the real "nearby
  // chat" experience, this panel's Nearby tab is a lightweight text
  // companion to that, not a full history.
  useEffect(() => {
    if (tab !== "district") return;
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("world_chat_log")
        .select("id, user_id, content, scope, created_at, profiles(username)")
        .eq("scope", "district")
        .order("created_at", { ascending: false })
        .limit(30);
      if (!active || !data) return;
      const rows = (data as unknown as Array<LogRow & { profiles?: { username: string } | null }>)
        .map((row) => {
          if (row.profiles?.username) usernameCacheRef.current.set(row.user_id, row.profiles.username);
          return { ...row, username: row.profiles?.username };
        })
        .reverse();
      setMessages(rows);
    }
    load();

    const channel = supabase
      .channel("world_chat_log_inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "world_chat_log", filter: "scope=eq.district" },
        async (payload) => {
          const row = payload.new as LogRow;
          let username = usernameCacheRef.current.get(row.user_id);
          if (!username) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", row.user_id)
              .single();
            username = profile?.username;
            if (username) usernameCacheRef.current.set(row.user_id, username);
          }
          if (!active) return;
          setMessages((prev) => [...prev.slice(-49), { ...row, username }]);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tab]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (Date.now() - lastSentRef.current < SEND_COOLDOWN_MS) return;
    lastSentRef.current = Date.now();
    setErrorMsg("");

    const clipped = trimmed.slice(0, MAX_MESSAGE_LENGTH);
    canvasRef.current?.sendChat(clipped, tab);
    setText("");

    // Fire-and-forget durable log entry — the live bubble/broadcast
    // above is what makes the message feel instant; this write is
    // just the audit trail (see 0002_avatars_and_world.sql). RLS
    // enforces the per-user rate limit server-side, so a rejected
    // insert here is expected under abuse, not a bug to swallow
    // silently — surfaced to the sender, not blocking the broadcast
    // they already saw render.
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("world_chat_log")
      .insert({ user_id: user.id, content: clipped, scope: tab });
    if (error) {
      setErrorMsg("That message didn't save to district history (still sent live).");
    }
  }

  return (
    <div className="card mt-4">
      <div className="mb-3 flex gap-2 border-b border-ink-line">
        <button
          onClick={() => setTab("district")}
          className={`px-3 py-2 text-sm ${tab === "district" ? "border-b-2 border-neon-pink text-frost" : "text-frost-muted"}`}
        >
          District
        </button>
        <button
          onClick={() => setTab("nearby")}
          className={`px-3 py-2 text-sm ${tab === "nearby" ? "border-b-2 border-neon-pink text-frost" : "text-frost-muted"}`}
        >
          Nearby
        </button>
      </div>

      {tab === "district" ? (
        <div className="mb-3 max-h-40 space-y-1 overflow-y-auto text-sm">
          {messages.length === 0 ? (
            <p className="text-frost-muted">No messages yet — say something.</p>
          ) : (
            messages.map((m) => (
              <p key={m.id}>
                <span className="text-neon-pink">@{m.username ?? "unknown"}</span>{" "}
                <span className="text-frost">{m.content}</span>
              </p>
            ))
          )}
        </div>
      ) : (
        <p className="mb-3 text-sm text-frost-muted">
          Messages here only reach players near you in The Block right now — watch for the
          speech bubble above their head.
        </p>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={tab === "district" ? "Say something to the district…" : "Say something nearby…"}
          className="flex-1 rounded border border-ink-line bg-ink px-3 py-2 text-sm text-frost"
        />
        <button onClick={handleSend} className="btn-primary text-sm">
          Send
        </button>
      </div>
      {errorMsg && <p className="mt-2 text-xs text-blood">{errorMsg}</p>}
    </div>
  );
});

export default WorldChat;
