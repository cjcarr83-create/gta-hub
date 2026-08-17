# CLAUDE.md — GTAHUB

## Standing rules for Claude Code sessions on this repo

- Always run `npm run build` and `npx tsc --noEmit` before finishing a task, and fix any errors found.
- Never let missing environment variables crash the build. Use lazy-loaded clients (see `lib/mux.ts` for the pattern) for any SDK that requires API keys.
- When you fix a bug or ship a change, commit with a clear message and open a PR — don't ask for permission first.
- Keep PR descriptions short: what broke, why, what you changed.
- If a build fails only due to missing Supabase/Mux/Stripe env vars in this environment (not a real code bug), note it in the PR description and continue — don't treat it as a blocking issue.
- Match existing code style and patterns already used in the repo (e.g. Supabase client setup in `lib/supabase/`).
- Tech stack: Next.js 16 + TypeScript + Supabase + Mux + Stripe Connect.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
