"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Feed" },
  { href: "/live", label: "Live" },
  { href: "/world", label: "Block" },
  { href: "/upload", label: "Post" },
  { href: "/crews", label: "Crews" },
  { href: "/profile", label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-asphalt-line
                 bg-asphalt/95 backdrop-blur"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg justify-between px-2 py-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded py-2 text-center text-xs font-display uppercase
                          tracking-wide transition-colors
                          ${active ? "text-sunset-amber" : "text-sand-muted hover:text-sand"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
