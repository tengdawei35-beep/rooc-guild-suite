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

// Remove duplicate characterName declarations introduced by the identity rename.
for (const relative of [
  "src/app/api/events/[eventId]/rosters/route.ts",
  "src/app/api/guild/rankings/route.ts",
  "src/app/events/[eventId]/EventClient.tsx",
  "src/app/guild/members/MembersClient.tsx",
  "src/app/guild/rankings/RankingsClient.tsx",
]) {
  update(relative, (s) => s.replace(/(characterName:\s*string;)\s*\n\s*characterName:\s*string \| null;/g, "$1"));
}

// MembersClient form accidentally retained a duplicate required field.
update("src/app/guild/members/MembersClient.tsx", (s) =>
  s.replace(/characterName:\s*string;\s*\n\s*characterName:\s*string;/, "characterName: string;")
);

// EventClient has the same duplicate in both participant and roster member types.
update("src/app/events/[eventId]/EventClient.tsx", (s) =>
  s.replace(/characterName:\s*string;\s*\n\s*characterName:\s*string \| null;/g, "characterName: string | null;")
);

// Keep MemberProfileClient's API type aligned with the actual member payload.
update("src/app/guild/members/[memberId]/MemberProfileClient.tsx", (s) => {
  if (!s.includes("discordUsername:")) {
    return s.replace(
      /id:\s*string;\s*\n\s*characterName:/,
      "id: string;\n  discordUsername: string | null;\n  characterName:"
    );
  }
  return s;
});

// BidsPage passes Prisma's nullable characterName into a client type that expects a string.
// Normalize only at the server/client boundary; the database field remains nullable.
update("src/app/allocation/[runId]/bids/page.tsx", (s) => {
  const marker = '  const feathers =\\n    run.bidPages.filter(';
  if (!s.includes(marker)) return s;
  if (s.includes("const normalizedBidPages")) return s;
  const insert = `  const normalizedBidPages = run.bidPages.map((page) => ({\n    ...page,\n    slots: page.slots.map((slot) => ({\n      ...slot,\n      member: {\n        ...slot.member,\n        characterName: slot.member.characterName ?? "Unknown",\n      },\n    })),\n  }));\n\n`;
  return s.replace("  const feathers =", insert + "  const feathers =").replace(
    /run\.bidPages\.filter\(/g,
    "normalizedBidPages.filter("
  );
});

// Nullable database identity should be represented as nullable in these transport/client types.
update("src/app/guild/reservations/page.tsx", (s) =>
  s.replace(/characterName:\s*string;/, "characterName: string | null;")
    .replace(/memberName:\s*string;/, "memberName: string | null;")
);

update("src/lib/allocation/engine.ts", (s) =>
  s.replace(/characterName:\s*string;\s*\n/, "characterName: string | null;\n")
    .replace(/memberName:\s*string;/, "memberName: string | null;")
    .replace(/characterName:\s*string;\s*\n/g, "characterName: string | null;\n")
);

// The ranking API/client types should reflect Prisma's nullable characterName.
update("src/app/api/guild/rankings/route.ts", (s) =>
  s.replace(/characterName:\s*string;/, "characterName: string | null;")
);

update("src/app/api/events/[eventId]/rosters/route.ts", (s) =>
  s.replace(/characterName:\s*string;/, "characterName: string | null;")
);

// Ensure the event client can handle nullable character names at the search/render boundaries.
update("src/app/events/[eventId]/EventClient.tsx", (s) =>
  s.replace(/participant\.characterName\s*\n\s*\.toLowerCase\(\)/g, "(participant.characterName ?? \"\")\n                .toLowerCase()")
    .replace(/a\.characterName\s*\|\|\s*a\.characterName/g, "a.characterName")
);

// BidsClient receives the normalized string from BidsPage, so no nullable changes are required there.

console.log("GuildMember identity type repair v2 complete.");
