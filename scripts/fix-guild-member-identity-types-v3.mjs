import fs from "node:fs";

const files = new Map([
  [
    "src/app/allocation/[runId]/bids/page.tsx",
    [
      [
        `  const feathers =\n    run.bidPages.filter(\n      (page) =>\n        page.type ===\n        "FEATHER"\n    );\n\n  const cards =\n    run.bidPages.filter(\n      (page) =>\n        page.type ===\n        "CARD"\n    );`,
        `  // BidsClient expects a displayable character name.\n  // GuildMember.characterName is nullable at the database layer,\n  // so normalize it at this UI boundary rather than lying in the type.\n  const bidPages = run.bidPages.map((page) => ({\n    ...page,\n    slots: page.slots.map((slot) => ({\n      ...slot,\n      member: {\n        ...slot.member,\n        characterName:\n          slot.member.characterName ?? "Unknown member",\n      },\n    })),\n  }));\n\n  const feathers =\n    bidPages.filter(\n      (page) =>\n        page.type ===\n        "FEATHER"\n    );\n\n  const cards =\n    bidPages.filter(\n      (page) =>\n        page.type ===\n        "CARD"\n    );`,
      ],
    ],
  ],
  [
    "src/app/api/events/[eventId]/rosters/route.ts",
    [
      [
        `  return a.characterName.localeCompare(\n    b.characterName\n  );`,
        `  return (a.characterName ?? "").localeCompare(\n    b.characterName ?? ""\n  );`,
      ],
    ],
  ],
  [
    "src/app/guild/reservations/page.tsx",
    [
      [
        `        characterName:\n          member.characterName,`,
        `        characterName:\n          member.characterName ?? "Unknown member",`,
      ],
      [
        `        memberName:\n          reservation.member\n            .characterName,`,
        `        memberName:\n          reservation.member\n            .characterName ?? "Unknown member",`,
      ],
    ],
  ],
]);

for (const [relative, replacements] of files) {
  const text = fs.readFileSync(relative, "utf8");
  let next = text;

  for (const [from, to] of replacements) {
    if (!next.includes(from)) {
      throw new Error(`Expected pattern not found in ${relative}:\n${from}`);
    }
    next = next.replace(from, to);
  }

  if (next === text) {
    throw new Error(`No changes made to ${relative}; refusing to continue.`);
  }

  fs.writeFileSync(relative, next, "utf8");
  console.log(`Updated ${relative}`);
}

console.log("Stage v3 complete.");
