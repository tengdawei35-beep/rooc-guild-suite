import fs from "node:fs";

const relative =
  "src/app/events/[eventId]/EventClient.tsx";

const file = fs.readFileSync(relative, "utf8");

function fail(message) {
  throw new Error(message);
}

let output = file;

// -------------------------------------------------------------
// Participation toggle state
// -------------------------------------------------------------

if (!output.includes("const [showParticipation]")) {
  const anchor = `  const [showUnavailable, setShowUnavailable] =\n    useState(true);`;

  if (!output.includes(anchor)) {
    fail("Could not find showUnavailable state anchor.");
  }

  output = output.replace(
    anchor,
    `${anchor}\n\n  const [showParticipation, setShowParticipation] =\n    useState(false);`
  );
}

// -------------------------------------------------------------
// Locate the three major sections.
// -------------------------------------------------------------

const participationMarker = `        {/* ====================================================\n            PARTICIPATION\n        ==================================================== */}`;
const rosterMarker = `        {/* ====================================================\n            ROSTERS\n        ==================================================== */}`;
const allocationMarker = `        {/* ====================================================\n            ALLOCATION\n        ==================================================== */}`;

const participationStart = output.indexOf(participationMarker);
const rosterStart = output.indexOf(rosterMarker);
const allocationStart = output.indexOf(allocationMarker);

if (
  participationStart === -1 ||
  rosterStart === -1 ||
  allocationStart === -1
) {
  fail("Could not locate Participation, Rosters, or Allocation sections.");
}

if (!(participationStart < rosterStart && rosterStart < allocationStart)) {
  fail("Event sections are not in the expected order.");
}

const participationBlock = output.slice(
  participationStart,
  rosterStart
);

const rosterBlock = output.slice(
  rosterStart,
  allocationStart
);

// -------------------------------------------------------------
// Make Participation collapsed by default.
// -------------------------------------------------------------

let collapsedParticipation = participationBlock;

if (!collapsedParticipation.includes("showParticipation")) {
  const firstSection = collapsedParticipation.indexOf(
    `        <section className="mt-10">`
  );

  if (firstSection === -1) {
    fail("Could not find Participation section opening tag.");
  }

  const firstSectionEnd = firstSection +
    `        <section className="mt-10">`.length;

  const lastSectionEnd = collapsedParticipation.lastIndexOf(
    "        </section>"
  );

  if (lastSectionEnd === -1 || lastSectionEnd <= firstSectionEnd) {
    fail("Could not find Participation section closing tag.");
  }

  collapsedParticipation =
    collapsedParticipation.slice(0, firstSection) +
    `{showParticipation && (\n` +
    collapsedParticipation.slice(firstSection) +
    `\n)}`;

  // The wrapper is intentionally around the whole section, so no
  // large 77-member table is rendered until the user asks for it.
}

// -------------------------------------------------------------
// Add a compact Participation toggle after the statistics.
// -------------------------------------------------------------

if (!output.includes("Show Participation")) {
  const statsEndMarker = `        </section>\n\n        {/* ====================================================\n            PARTICIPATION`;

  if (!output.includes(statsEndMarker)) {
    fail("Could not find the end of the statistics section.");
  }

  const toggle = `        </section>\n\n        <div className="mt-6 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">\n          <div>\n            <p className="font-medium">Participation</p>\n            <p className="mt-1 text-sm text-zinc-500">\n              {data.stats.availableMembers} available · {data.stats.totalMembers} total members\n            </p>\n          </div>\n\n          <button\n            type="button"\n            onClick={() =>\n              setShowParticipation((value) => !value)\n            }\n            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"\n          >\n            {showParticipation\n              ? "Hide Participation"\n              : "Show Participation"}\n          </button>\n        </div>\n\n        {/* ====================================================\n            PARTICIPATION`;

  output = output.replace(
    statsEndMarker,
    toggle
  );
}

// -------------------------------------------------------------
// Move Rosters before Participation.
// -------------------------------------------------------------

const currentParticipationStart = output.indexOf(participationMarker);
const currentRosterStart = output.indexOf(rosterMarker);
const currentAllocationStart = output.indexOf(allocationMarker);

if (
  currentParticipationStart === -1 ||
  currentRosterStart === -1 ||
  currentAllocationStart === -1
) {
  fail("Could not relocate event sections after participation changes.");
}

const prefix = output.slice(0, currentParticipationStart);
const suffix = output.slice(currentAllocationStart);

output =
  prefix +
  rosterBlock +
  collapsedParticipation +
  suffix;

if (output === file) {
  fail(`No changes made to ${relative}.`);
}

fs.writeFileSync(relative, output, "utf8");

console.log(`Updated ${relative}`);
console.log("- Rosters moved above Participation");
console.log("- Participation collapsed by default");
console.log("- Participation can be expanded from a compact summary");
