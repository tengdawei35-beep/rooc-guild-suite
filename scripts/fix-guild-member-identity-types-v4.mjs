import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function update(relative, transform) {
  const file = path.join(root, relative);
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  if (after === before) {
    console.log(`No change needed: ${relative}`);
    return;
  }
  fs.writeFileSync(file, after, "utf8");
  console.log(`Updated: ${relative}`);
}

// Prisma correctly exposes GuildMember.characterName as nullable.
update("src/app/allocation/[runId]/bids/BidsClient.tsx", (s) =>
  s.replace(/characterName: string;/g, "characterName: string | null;")
);

update("src/app/guild/reservations/ReservationsClient.tsx", (s) =>
  s.replace(/characterName: string;/g, "characterName: string | null;")
   .replace(/memberName: string;/g, "memberName: string | null;")
);

update("src/app/guild/reservations/page.tsx", (s) => s);

update("src/app/api/events/[eventId]/rosters/route.ts", (s) =>
  s.replace(/(\n\s*)characterName: string;\n\s*characterName: string \| null;/, "$1characterName: string | null;")
   .replace(/a\.characterName\.localeCompare\(\n\s*b\.characterName\n\s*\)/, "(a.characterName ?? \"\").localeCompare(\n    b.characterName ?? \"\"\n  )")
);

update("src/app/api/guild/rankings/route.ts", (s) =>
  s.replace(/(\n\s*)characterName: string;\n\s*characterName: string \| null;/, "$1characterName: string | null;")
);

update("src/app/events/[eventId]/EventClient.tsx", (s) =>
  s.replace(/(\n\s*)characterName: string;\n\s*characterName: string \| null;/g, "$1characterName: string | null;")
   .replace(/(\n\s*)characterName: string;\n\s*characterName: string \| null;/g, "$1characterName: string | null;")
);

update("src/app/guild/members/MembersClient.tsx", (s) =>
  s.replace(/(\n\s*)characterName: string;\n\s*characterName: string \| null;/g, "$1characterName: string | null;")
);

update("src/app/guild/rankings/RankingsClient.tsx", (s) =>
  s.replace(/(\n\s*)characterName: string;\n\s*characterName: string \| null;/g, "$1characterName: string | null;")
);

// Server-side reservations data can legitimately contain members without a character name.
update("src/app/guild/reservations/page.tsx", (s) =>
  s.replace(/memberName:\n\s*reservation\.member\n\s*\.characterName,/, "memberName:\n          reservation.member\n            .characterName ??\n          null,")
);

// Allocation UI already accepts nullable names after the type update above.
// Avoid inventing a character name for existing records with no character name.

console.log("GuildMember identity type cleanup v4 complete.");
