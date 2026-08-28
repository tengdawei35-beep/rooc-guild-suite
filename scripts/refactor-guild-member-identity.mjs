import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const simpleTargets = [
  "src/app/allocation/[runId]/bids/BidsClient.tsx",
  "src/app/allocation/page.tsx",
  "src/app/api/events/[eventId]/rosters/route.ts",
  "src/app/events/[eventId]/EventClient.tsx",
  "src/app/guild/members/[memberId]/MemberProfileClient.tsx",
  "src/app/guild/rankings/RankingsClient.tsx",
  "src/app/guild/reservations/page.tsx",
  "src/app/guild/reservations/ReservationsClient.tsx",
  "src/app/api/guild/rankings/route.ts",
  "src/lib/allocation/engine.ts",
];

function update(relative, transform) {
  const file = path.join(root, relative);
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);

  if (after === before) {
    throw new Error(`No changes made to ${relative}; refusing to continue.`);
  }

  fs.writeFileSync(file, after, "utf8");
  console.log(`Updated ${relative}`);
}

// These files are exclusively dealing with GuildMember-derived identity data.
for (const relative of simpleTargets) {
  update(relative, (text) =>
    text.replaceAll("displayName", "characterName")
  );
}

// MembersClient contains both GuildMember data and the editable form. Handle it
// explicitly rather than doing a blind file-wide replacement.
update(
  "src/app/guild/members/MembersClient.tsx",
  (text) => {
    let result = text;

    // GuildMember has no displayName anymore.
    result = result.replaceAll(
      "    displayName: string;\n",
      ""
    );
    result = result.replaceAll(
      "      displayName:\n        member.displayName,\n",
      ""
    );
    result = result.replaceAll(
      "selectedMember.displayName",
      "selectedMember.characterName"
    );
    result = result.replaceAll(
      "member.displayName",
      "member.characterName"
    );

    // Any remaining form.displayName reference is an obsolete form field.
    // It should use the Discord username field rather than reintroducing a
    // second GuildMember display-name concept.
    result = result.replaceAll(
      "form.displayName",
      "form.discordUsername"
    );

    return result;
  }
);

// The import modal's canonical identity field is already discordUsername;
// `displayname` is intentionally retained only as a legacy CSV header alias.

console.log("GuildMember displayName refactor complete.");
console.log("Next: run `npx prisma generate` and `npm run build`.");
