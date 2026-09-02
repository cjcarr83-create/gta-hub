import { CHARACTERS } from "@/lib/characters";

export const metadata = {
  title: "Characters — GTAHUB",
  description: "Meet the cast — original characters for GTAHUB, not affiliated with Rockstar Games.",
};

export default function CharactersPage() {
  return (
    <main className="px-4 pt-6 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl">Characters</h1>
        <p className="mt-1 text-sm text-frost-muted">
          Meet the cast — original characters created for GTAHUB. Story flavor only,
          not real users, and not affiliated with Rockstar Games or Take-Two Interactive.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {CHARACTERS.map((c) => (
          <div key={c.id} className="card overflow-hidden p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/characters/${c.slug}.webp`}
              alt={c.name}
              className="aspect-square w-full object-cover"
            />
            <div className="p-3">
              <h3 className="font-display text-sm uppercase leading-tight">{c.name}</h3>
              <p className="text-xs uppercase tracking-widest text-neon-pink">{c.role}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.traits.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm border border-ink-line px-1.5 py-0.5 text-[10px] text-frost-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
