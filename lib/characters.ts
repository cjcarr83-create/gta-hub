// Original fictional characters — flavor/lore content for GTAHUB, not
// real user accounts. Portraits are original AI-generated art (see
// public/characters/), not derived from Rockstar's actual character
// designs — consistent with this app's existing "not affiliated with
// Rockstar/Take-Two" posture (see app/about/page.tsx).
export interface Character {
  id: string;
  slug: string;
  name: string;
  role: string;
  traits: [string, string, string];
}

export const CHARACTERS: Character[] = [
  { id: "01", slug: "rico-blaze", name: "Rico Blaze", role: "Street Hustler", traits: ["Fast", "Loyal", "Street-smart"] },
  { id: "02", slug: "maya-cruz", name: "Maya Cruz", role: "Nightlife Queen", traits: ["Magnetic", "Fearless", "Connected"] },
  { id: "03", slug: "darnell-king", name: "Darnell King", role: "Enforcer", traits: ["Strong", "Calm", "Protective"] },
  { id: "04", slug: "sofia-vale", name: "Sofia Vale", role: "Luxury Grifter", traits: ["Elegant", "Persuasive", "Strategic"] },
  { id: "05", slug: "tyrese-quinn", name: "Tyrese Quinn", role: "Stunt Driver", traits: ["Bold", "Precise", "Competitive"] },
  { id: "06", slug: "lena-voss", name: "Lena Voss", role: "Hacker", traits: ["Clever", "Quiet", "Resourceful"] },
  { id: "07", slug: "marco-deluca", name: "Marco DeLuca", role: "Club Owner", traits: ["Charismatic", "Ambitious", "Connected"] },
  { id: "08", slug: "zuri-banks", name: "Zuri Banks", role: "Wheelwoman", traits: ["Quick", "Focused", "Loyal"] },
  { id: "09", slug: "javier-moreno", name: "Javier Moreno", role: "Mechanic", traits: ["Inventive", "Steady", "Practical"] },
  { id: "10", slug: "bianca-reed", name: "Bianca Reed", role: "Rogue Detective", traits: ["Observant", "Relentless", "Independent"] },
  { id: "11", slug: "malik-lawson", name: "Malik Lawson", role: "Street Racer", traits: ["Disciplined", "Fast", "Confident"] },
  { id: "12", slug: "amara-reyes", name: "Amara Reyes", role: "Fixer", traits: ["Connected", "Composed", "Persuasive"] },
  { id: "13", slug: "marcus-vale", name: "Marcus Vale", role: "Security Chief", traits: ["Alert", "Loyal", "Commanding"] },
  { id: "14", slug: "nyx-monroe", name: "Nyx Monroe", role: "Underground Artist", traits: ["Creative", "Fearless", "Unpredictable"] },
  { id: "15", slug: "javier-knox", name: "Javier Knox", role: "Tuner", traits: ["Technical", "Patient", "Competitive"] },
  { id: "16", slug: "darius-crown", name: "Darius Crown", role: "Music Promoter", traits: ["Charismatic", "Influential", "Calculated"] },
  { id: "17", slug: "eva-solace", name: "Eva Solace", role: "High Roller", traits: ["Elegant", "Cool", "Strategic"] },
  { id: "18", slug: "andre-ace-walker", name: 'Andre "Ace" Walker', role: "Getaway Driver", traits: ["Quick", "Adaptable", "Fearless"] },
  { id: "19", slug: "kai-serrano", name: "Kai Serrano", role: "Strategist", traits: ["Observant", "Precise", "Quiet"] },
  { id: "20", slug: "devon-frost", name: "Devon Frost", role: "Bounty Hunter", traits: ["Focused", "Resilient", "Street-smart"] },
];
