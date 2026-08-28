import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const targets = [
  "src/app/allocation/[runId]/bids/BidsClient.tsx",
  "src/app/allocation/page.tsx",
  "src/app/api/events/[eventId]/rosters/route.ts",
  "src/app/events/[eventId]/EventClient.tsx",
  "src/app/guild/members/MembersClient.tsx",
  "src/app/guild/members/[memberId]/MemberProfileClient.tsx",
  "src/app/guild/rankings/RankingsClient.tsx",
  "src/app/guild/reservations/page.tsx",
  "src/app/guild/reservations/ReservationsClient.tsx",
  "src/app/api/guild/rankings/route.ts",
  "src/lib/allocation/engine.ts",
];

for (const relative of targets) {
  const file = path.join(root, relative);
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  text = text.replaceAll("displayName", "characterName");
  if (text === before) {
    throw new Error(`Expected displayName references in ${relative}, but none were found`);
  }
  fs.writeFileSync(file, text, "utf8");
  console.log(`Updated ${relative}`);
}

// The import modal intentionally retains the legacy lowercase CSV header alias
// `displayname -> discordUsername`; it is not a GuildMember.displayName field.

console.log("Targeted GuildMember identity cleanup complete.");
