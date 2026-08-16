# CLAUDE.md — GTAHUB

## Standing rules for Claude Code sessions on this repo

- Always run `npm run build` and `npx tsc --noEmit` before finishing a task, and fix any errors found.
- Never let missing environment variables crash the build. Use lazy-loaded clients (see `lib/mux.ts` for the pattern) for any SDK that requires API keys.
- When you fix a bug or ship a change, commit with a clear message and open a PR — don't ask for permission first.
- Keep PR descriptions short: what broke, why, what you changed.
- If a build fails only due to missing Supabase/Mux/Stripe env vars in this environment (not a real code bug), note it in the PR description and continue — don't treat it as a blocking issue.
- Match existing code style and patterns already used in the repo (e.g. Supabase client setup in `lib/supabase/`).
- Tech stack: Next.js 16 + TypeScript + Supabase + Mux + Stripe Connect.
