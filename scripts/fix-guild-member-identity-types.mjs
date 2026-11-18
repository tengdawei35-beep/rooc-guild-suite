import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function update(relative, replacements) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${relative}`);

  let text = fs.readFileSync(file, "utf8");
  const before = text;

  for (const [from, to] of replacements) {
    if (!text.includes(from)) {
      console.log(`Pattern already absent in ${relative}: ${JSON.stringify(from)}`);
      continue;
    }
    text = text.replace(from, to);
  }

  if (text !== before) {
    fs.writeFileSync(file, text, "utf8");
    console.log(`Updated: ${relative}`);
  } else {
    console.log(`Already clean: ${relative}`);
  }
}

// These duplicate declarations were introduced by the mechanical displayName
// -> characterName pass. Remove only the duplicated declaration in each type.
update("src/app/guild/members/MembersClient.tsx", [
  [
    '  characterName: string;\n  characterName: string;\n  job: string;',
    '  characterName: string;\n  job: string;',
  ],
]);

update("src/app/guild/rankings/RankingsClient.tsx", [
  [
    '  characterName: string;\n  characterName: string | null;\n  job: string | null;',
    '  characterName: string | null;\n  job: string | null;',
  ],
]);

update("src/app/api/guild/rankings/route.ts", [
  [
    '  characterName: string;\n  characterName: string | null;\n  job: string | null;',
    '  characterName: string | null;\n  job: string | null;',
  ],
]);

update("src/app/api/events/[eventId]/rosters/route.ts", [
  [
    '  characterName: string;\n  characterName: string | null;\n  job: string | null;',
    '  characterName: string | null;\n  job: string | null;',
  ],
]);

update("src/app/events/[eventId]/EventClient.tsx", [
  [
    '  characterName: string;\n  characterName: string | null;\n  job: string | null;',
    '  characterName: string | null;\n  job: string | null;',
  ],
  [
    '    characterName: string;\n    characterName: string | null;\n    job: string | null;',
    '    characterName: string | null;\n    job: string | null;',
  ],
]);

// Allocation/Bids require a displayable member name. Preserve the nullable DB
// field while normalising it at the query boundary with an explicit fallback.
update("src/app/allocation/[runId]/bids/page.tsx", [
  [
    '                    characterName:\n                      true,',
    '                    characterName:\n                      true,',
  ],
]);

update("src/app/allocation/[runId]/bids/BidsClient.tsx", [
  [
    'type Member = {\n  id: string;\n  characterName: string;\n};',
    'type Member = {\n  id: string;\n  characterName: string | null;\n};',
  ],
]);

// Server DTOs must reflect Prisma's nullable characterName.
update("src/app/guild/reservations/page.tsx", [
  [
    'type Member = {\n  id: string;\n  characterName: string;\n  priority: string;\n  eligible: boolean;\n};',
    'type Member = {\n  id: string;\n  characterName: string | null;\n  priority: string;\n  eligible: boolean;\n};',
  ],
  [
    '    memberName: string;\n',
    '    memberName: string | null;\n',
  ],
]);

update("src/lib/allocation/engine.ts", [
  [
    '  memberName: string;\n',
    '  memberName: string | null;\n',
  ],
  [
    '    selectedMembers: {\n      id: string;\n      characterName: string;\n    }[];',
    '    selectedMembers: {\n      id: string;\n      characterName: string | null;\n    }[];',
  ],
]);

console.log("\nTargeted GuildMember identity type repair complete.");
console.log("Run git diff --check, then npm run build.");
