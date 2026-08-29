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

  if (!fs.existsSync(file)) {
    console.warn(`Skipping missing file: ${relative}`);
    continue;
  }

  let text = fs.readFileSync(file, "utf8");

  if (!text.includes("displayName")) {
    console.log(`Already clean: ${relative}`);
    continue;
  }

  const before = text;

  text = text.replaceAll("displayName", "characterName");

  if (text === before) {
    console.log(`No changes required: ${relative}`);
    continue;
  }

  fs.writeFileSync(file, text, "utf8");
  console.log(`Updated: ${relative}`);
}

console.log("");
console.log("GuildMember identity cleanup complete.");