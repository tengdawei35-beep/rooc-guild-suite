"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import RaidManagement from "./RaidManagement";

type EventType =
  | "GUILD_LEAGUE"
  | "EMPERIUM_OVERRUN";

type Participant = {
  id: string;
  userId: string | null;
  characterName: string;
  job: string | null;
  priority:
    | "LEADER"
    | "OFFICER"
    | "COUNCIL"
    | "MEMBER";
  remarks: string | null;
  available: boolean;
  onLeave: boolean;
  leaveReason: string | null;
  hasParticipationRecord: boolean;
};

type EventData = {
  id: string;
  guildId: string;
  type: EventType;
  date: string;
  guild: {
    id: string;
    name: string;
  };
};

type RosterMember = {
  id: string;
  slotNumber: number;

  member: {
    id: string;
    characterName: string;
    job: string | null;
    priority:
      | "LEADER"
      | "OFFICER"
      | "COUNCIL"
      | "MEMBER";
  };
};

type RosterParty = {
  id: string;
  partyNumber: number;
  battlefield:
    | "BATTLEFIELD_1"
    | "BATTLEFIELD_2";
  members: RosterMember[];
};

type RosterSummary = {
  id: string;
  name: string;
  generationMode:
    | "MANUAL"
    | "AUTOMATIC";
  partyCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  parties?: RosterParty[];
};

type AllocationRun = {
  id: string;
  status:
    | "RUNNING"
    | "COMPLETED"
    | "FAILED";
  createdAt: string;
  completedAt: string | null;
};

type EventResponse = {
  event: EventData;
  participants: Participant[];
  permissions?: {
    canManageEvents: boolean;
    canEditRosters: boolean;
  };
  rosters: RosterSummary[];
  allocationRuns: AllocationRun[];
  stats: {
    totalMembers: number;
    availableMembers: number;
    unavailableMembers: number;
    onLeaveMembers: number;
    rosterCount: number;
    allocationRunCount: number;
  };
};

type AddMemberTarget = {
  rosterId: string;
  partyId: string;
  slotNumber: number;
};

// =============================================================
// PAGE
// =============================================================

export default function EventClient({
  eventId,
  currentUserId,
  canManageEvents,
  canEditRosters,
}: {
  eventId: string;
  currentUserId: string;
  canManageEvents: boolean;
  canEditRosters: boolean;
}) {
  const [data, setData] =
    useState<EventResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [updatingMember, setUpdatingMember] =
    useState<string | null>(null);

  const [generatingRoster, setGeneratingRoster] =
    useState(false);

  const [savingPreferred, setSavingPreferred] =
    useState(false);

  const [preferredSaved, setPreferredSaved] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [showUnavailable, setShowUnavailable] =
    useState(true);

  const [showParticipation, setShowParticipation] =
    useState(false);

  // ==========================================================
  // ROSTER EDITING
  // ==========================================================

  const [editingRosterId, setEditingRosterId] =
    useState<string | null>(null);

  const [draggedAssignmentId, setDraggedAssignmentId] =
    useState<string | null>(null);

  const [movingAssignmentId, setMovingAssignmentId] =
    useState<string | null>(null);

  const [removingAssignmentId, setRemovingAssignmentId] =
    useState<string | null>(null);

  const [addMemberTarget, setAddMemberTarget] =
    useState<AddMemberTarget | null>(null);

  const [memberSearch, setMemberSearch] =
    useState("");

  const [addingMember, setAddingMember] =
    useState(false);

  // ==========================================================
  // LOAD EVENT
  // ==========================================================

  async function loadEvent() {
    if (!eventId) {
      setError("Invalid event ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/events/${eventId}`,
        {
          cache: "no-store",
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to load event."
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load event."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  // ==========================================================
  // GENERATE ROSTER
  // ==========================================================

  async function generateRoster() {
    setGeneratingRoster(true);
    setError(null);
    setPreferredSaved(false);

    try {
      const response = await fetch(
        `/api/events/${eventId}/rosters`,
        {
          method: "POST",
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to generate roster."
        );
      }

      setEditingRosterId(null);

      // Generation is an intentional page-level operation,
      // so reload the event here.
      await loadEvent();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate roster."
      );
    } finally {
      setGeneratingRoster(false);
    }
  }

  // ==========================================================
  // SAVE ROSTER AS PREFERRED
  // ==========================================================

  async function saveRosterAsPreferred() {
    if (
      !data ||
      data.rosters.length === 0
    ) {
      setError(
        "Generate a roster before saving it as preferred."
      );
      return;
    }

    setSavingPreferred(true);
    setError(null);
    setPreferredSaved(false);

    try {
      const response = await fetch(
        `/api/events/${eventId}/preferred`,
        {
          method: "POST",
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to save preferred roster."
        );
      }

      setPreferredSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save preferred roster."
      );
    } finally {
      setSavingPreferred(false);
    }
  }

  // ==========================================================
  // DELETE ROSTER
  // ==========================================================

  async function deleteRoster(rosterId: string) {
    if (
      !window.confirm(
        "Delete this roster? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/events/${eventId}/rosters`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rosterId,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to delete roster."
        );
      }

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          rosters: current.rosters.filter(
            (roster) =>
              roster.id !== rosterId
          ),
        };
      });

      if (
        editingRosterId ===
        rosterId
      ) {
        setEditingRosterId(null);
      }
    } catch (error) {
      console.error(error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Failed to delete roster."
      );
    }
  }

  // ==========================================================
  // UPDATE PARTICIPATION
  // ==========================================================

  async function updateAvailability(
    memberId: string,
    available: boolean
  ) {
    setUpdatingMember(memberId);
    setError(null);

    try {
      const response = await fetch(
        `/api/events/${eventId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            memberId,
            available,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to update availability."
        );
      }

      setData((current) => {
        if (!current) {
          return current;
        }

        const participants =
          current.participants.map(
            (participant) =>
              participant.id ===
              memberId
                ? {
                    ...participant,
                    available,
                    hasParticipationRecord:
                      true,
                  }
                : participant
          );

        return {
          ...current,
          participants,
          stats: {
            ...current.stats,
            availableMembers:
              participants.filter(
                (member) =>
                  member.available
              ).length,
            unavailableMembers:
              participants.filter(
                (member) =>
                  !member.available
              ).length,
          },
        };
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update availability."
      );
    } finally {
      setUpdatingMember(null);
    }
  }

  // ==========================================================
  // MOVE / SWAP ROSTER MEMBER
  // ==========================================================

  async function moveRosterMember(
    assignmentId: string,
    targetPartyId: string,
    targetSlotNumber: number
  ) {
    if (!data) {
      return;
    }

    setMovingAssignmentId(
      assignmentId
    );

    setError(null);

    try {
      const response = await fetch(
        "/api/events/rosters/members",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            assignmentId,
            targetPartyId,
            targetSlotNumber,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to move roster member."
        );
      }

      // -------------------------------------------------------
      // IMPORTANT:
      //
      // Do NOT call loadEvent().
      //
      // Update the local roster directly so the browser does
      // not refresh or jump to the top.
      // -------------------------------------------------------

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          rosters:
            current.rosters.map(
              (roster) => {
                if (
                  roster.id !==
                  editingRosterId
                ) {
                  return roster;
                }

                const parties =
                  (roster.parties ??
                    []).map(
                    (party) => ({
                      ...party,
                      members:
                        party.members.map(
                          (member) =>
                            ({
                              ...member,
                            })
                        ),
                    })
                  );

                let sourceAssignment:
                  RosterMember | null =
                  null;

                let destinationAssignment:
                  RosterMember | null =
                  null;

                let sourceParty:
                  RosterParty | null =
                  null;

                let destinationParty:
                  RosterParty | null =
                  null;

                for (
                  const party of parties
                ) {
                  const source =
                    party.members.find(
                      (member) =>
                        member.id ===
                        assignmentId
                    );

                  if (source) {
                    sourceAssignment =
                      source;
                    sourceParty =
                      party;
                  }

                  const destination =
                    party.members.find(
                      (member) =>
                        member.slotNumber ===
                          targetSlotNumber &&
                        party.id ===
                          targetPartyId
                    );

                  if (destination) {
                    destinationAssignment =
                      destination;
                    destinationParty =
                      party;
                  }
                }

                if (
                  !sourceAssignment ||
                  !sourceParty
                ) {
                  return roster;
                }

                // ------------------------------------------------
                // Remove source from its old location.
                // ------------------------------------------------

                for (
                  const party of parties
                ) {
                  party.members =
                    party.members.filter(
                      (member) =>
                        member.id !==
                        assignmentId
                    );
                }

                // ------------------------------------------------
                // If destination was occupied, remove it too.
                // ------------------------------------------------

                if (
                  destinationAssignment
                ) {
                  for (
                    const party of parties
                  ) {
                    party.members =
                      party.members.filter(
                        (member) =>
                          member.id !==
                          destinationAssignment!.id
                      );
                  }
                }

                // ------------------------------------------------
                // Put source in destination.
                // ------------------------------------------------

                const movedAssignment:
                  RosterMember = {
                  ...sourceAssignment,
                  slotNumber:
                    targetSlotNumber,
                };

                const target =
                  parties.find(
                    (party) =>
                      party.id ===
                      targetPartyId
                  );

                if (!target) {
                  return roster;
                }

                target.members.push(
                  movedAssignment
                );

                // ------------------------------------------------
                // Swap destination into source position.
                // ------------------------------------------------

                if (
                  destinationAssignment &&
                  sourceParty
                ) {
                  sourceParty.members.push({
                    ...destinationAssignment,
                    slotNumber:
                      sourceAssignment.slotNumber,
                  });
                }

                // ------------------------------------------------
                // Sort every party by slot.
                // ------------------------------------------------

                for (
                  const party of parties
                ) {
                  party.members.sort(
                    (a, b) =>
                      a.slotNumber -
                      b.slotNumber
                  );
                }

                return {
                  ...roster,
                  parties,
                };
              }
            ),
        };
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to move roster member."
      );
    } finally {
      setMovingAssignmentId(
        null
      );

      setDraggedAssignmentId(
        null
      );
    }
  }

  // ==========================================================
  // ADD MEMBER TO EMPTY SLOT
  // ==========================================================

  async function addMemberToSlot(
    memberId: string
  ) {
    if (
      !addMemberTarget ||
      !data
    ) {
      return;
    }

    setAddingMember(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/events/rosters/members",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            partyId:
              addMemberTarget.partyId,
            memberId,
            slotNumber:
              addMemberTarget.slotNumber,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to add member."
        );
      }

      const assignment =
        result.assignment as RosterMember;

      // -------------------------------------------------------
      // Update local state.
      // No page reload.
      // -------------------------------------------------------

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          rosters:
            current.rosters.map(
              (roster) => {
                if (
                  roster.id !==
                  addMemberTarget.rosterId
                ) {
                  return roster;
                }

                return {
                  ...roster,
                  memberCount:
                    roster.memberCount +
                    1,

                  parties:
                    roster.parties?.map(
                      (party) => {
                        if (
                          party.id !==
                          addMemberTarget.partyId
                        ) {
                          return party;
                        }

                        return {
                          ...party,
                          members: [
                            ...party.members,
                            assignment,
                          ].sort(
                            (a, b) =>
                              a.slotNumber -
                              b.slotNumber
                          ),
                        };
                      }
                    ),
                };
              }
            ),
        };
      });

      setAddMemberTarget(null);
      setMemberSearch("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add member."
      );
    } finally {
      setAddingMember(false);
    }
  }

  // ==========================================================
  // REMOVE MEMBER FROM ROSTER
  // ==========================================================

  async function removeRosterMember(
    assignmentId: string
  ) {
    if (!data) {
      return;
    }

    setRemovingAssignmentId(
      assignmentId
    );

    setError(null);

    try {
      const response = await fetch(
        `/api/events/rosters/members?id=${encodeURIComponent(
          assignmentId
        )}`,
        {
          method: "DELETE",
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Failed to remove member."
        );
      }

      // -------------------------------------------------------
      // Update local state.
      // The server compacts the remaining party slots.
      //
      // We mirror that behavior locally so there is no reload.
      // -------------------------------------------------------

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          rosters:
            current.rosters.map(
              (roster) => {
                if (
                  !roster.parties
                ) {
                  return roster;
                }

                let removed = false;

                const parties =
                  roster.parties.map(
                    (party) => {
                      const contains =
                        party.members.some(
                          (member) =>
                            member.id ===
                            assignmentId
                        );

                      if (
                        !contains
                      ) {
                        return party;
                      }

                      removed = true;

                      const remaining =
                        party.members
                          .filter(
                            (member) =>
                              member.id !==
                              assignmentId
                          )
                          .sort(
                            (a, b) =>
                              a.slotNumber -
                              b.slotNumber
                          )
                          .map(
                            (
                              member,
                              index
                            ) => ({
                              ...member,
                              slotNumber:
                                index + 1,
                            })
                          );

                      return {
                        ...party,
                        members:
                          remaining,
                      };
                    }
                  );

                if (!removed) {
                  return roster;
                }

                return {
                  ...roster,
                  memberCount:
                    Math.max(
                      0,
                      roster.memberCount -
                        1
                    ),
                  parties,
                };
              }
            ),
        };
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove member."
      );
    } finally {
      setRemovingAssignmentId(
        null
      );
    }
  }

  // ==========================================================
  // UNASSIGNED MEMBERS
  // ==========================================================

  const unassignedMembers =
    useMemo(() => {
      if (
        !data ||
        !addMemberTarget
      ) {
        return [];
      }

      const roster =
        data.rosters.find(
          (candidate) =>
            candidate.id ===
            addMemberTarget.rosterId
        );

      const assignedIds =
        new Set<string>();

      for (
        const party of
          roster?.parties ?? []
      ) {
        for (
          const assignment of
            party.members
        ) {
          assignedIds.add(
            assignment.member.id
          );
        }
      }

      const query =
        memberSearch
          .trim()
          .toLowerCase();

      return data.participants
        .filter(
          (participant) =>
            participant.available &&
            !participant.onLeave &&
            !assignedIds.has(
              participant.id
            )
        )
        .filter(
          (participant) => {
            if (!query) {
              return true;
            }

            return (
              (participant.characterName ?? "")
                .toLowerCase()
                .includes(query) ||
              participant.characterName
                ?.toLowerCase()
                .includes(query) ||
              participant.job
                ?.toLowerCase()
                .includes(query)
            );
          }
        )
        .sort(
          (a, b) =>
            (
              a.characterName
            ).localeCompare(
              b.characterName ||
                b.characterName
            )
        );
    }, [
      data,
      addMemberTarget,
      memberSearch,
    ]);

  // ==========================================================
  // PARTICIPATION FILTER
  // ==========================================================

  const filteredParticipants =
    data?.participants.filter(
      (participant) => {
        const query =
          search.trim().toLowerCase();

        const matchesSearch =
          query.length === 0 ||
          (participant.characterName ?? "")
                .toLowerCase()
            .includes(query) ||
          participant.characterName
            ?.toLowerCase()
            .includes(query) ||
          participant.job
            ?.toLowerCase()
            .includes(query);

        const matchesAvailability =
          showUnavailable ||
          participant.available;

        return (
          matchesSearch &&
          matchesAvailability
        );
      }
    ) ?? [];

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link
            href="/events"
            className="text-sm text-zinc-500 hover:text-white"
          >
            ← Events
          </Link>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <p className="text-sm text-zinc-500">
              Loading event...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error && !data) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Link
            href="/events"
            className="text-sm text-zinc-500 hover:text-white"
          >
            ← Events
          </Link>

          <div className="mt-8 rounded-xl border border-red-900 bg-red-950/40 p-5 text-red-400">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <Link
          href="/events"
          className="text-sm text-zinc-500 transition hover:text-white"
        >
          ← Events
        </Link>

        <header className="mt-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                  {formatEventType(
                    data.event.type
                  )}
                </span>

                <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-400">
                  Event
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight">
                {formatEventDate(
                  data.event.date
                )}
              </h1>

              <p className="mt-2 text-zinc-500">
                {data.event.guild.name}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {canManageEvents && (
                <Link
                  href={`/allocation?eventId=${data.event.id}`}
                  className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Allocation
                </Link>
              )}

              <button
                type="button"
                onClick={loadEvent}
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {preferredSaved && (
          <div className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Roster saved as the preferred roster for future{" "}
            {formatEventType(
              data.event.type
            )} events.
          </div>
        )}

        {/* ====================================================
            EVENT RULES
        ==================================================== */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">
            Event Rules
          </h2>

          <div className="mt-5">
            <EventRules
              type={data.event.type}
            />
          </div>
        </section>

        {/* ====================================================
            STATS
        ==================================================== */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Guild Members"
            value={
              data.stats.totalMembers
            }
          />

          <StatCard
            label="Available"
            value={
              data.stats.availableMembers
            }
          />

          <StatCard
            label="On Leave"
            value={
              data.stats.onLeaveMembers
            }
          />

          <StatCard
            label="Rosters"
            value={
              data.stats.rosterCount
            }
          />
        </section>


        {/* ====================================================
            ROSTERS
        ==================================================== */}
          <section className="mt-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Rosters
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Generate and manually adjust event rosters.
              </p>
            </div>

            {canEditRosters && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={
                    saveRosterAsPreferred
                  }
                  disabled={
                    savingPreferred ||
                    data.rosters.length ===
                      0
                  }
                  className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingPreferred
                    ? "Saving..."
                    : preferredSaved
                      ? "Preferred Saved"
                      : "Save Roster as Preferred"}
                </button>

                <button
                  type="button"
                  onClick={
                    generateRoster
                  }
                  disabled={
                    generatingRoster
                  }
                  className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-50"
                >
                  {generatingRoster
                    ? "Generating..."
                    : "Generate Roster"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-5">
            {data.rosters.length ===
            0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-6 py-12 text-center">
                <p className="font-medium text-zinc-400">
                  No rosters yet
                </p>

                <p className="mt-2 text-sm text-zinc-600">
                  Generate an automatic roster from the available members.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {data.rosters.map(
                  (roster) => (
                    <>
                    <RosterCard
                      key={
                        roster.id
                      }
                      roster={
                        roster
                      }
                      canEdit={
                        canEditRosters
                      }
                      editing={
                        editingRosterId ===
                        roster.id
                      }
                      onEdit={() =>
                        setEditingRosterId(
                          editingRosterId ===
                            roster.id
                            ? null
                            : roster.id
                        )
                      }
                      onDeleteRoster={() =>
                        deleteRoster(roster.id)
                      }
                      draggedAssignmentId={
                        draggedAssignmentId
                      }
                      movingAssignmentId={
                        movingAssignmentId
                      }
                      removingAssignmentId={
                        removingAssignmentId
                      }
                      onDragStart={(
                        assignmentId
                      ) =>
                        setDraggedAssignmentId(
                          assignmentId
                        )
                      }
                      onDragEnd={() =>
                        setDraggedAssignmentId(
                          null
                        )
                      }
                      onDrop={(
                        targetPartyId,
                        targetSlotNumber
                      ) => {
                        if (
                          !draggedAssignmentId
                        ) {
                          return;
                        }

                        moveRosterMember(
                          draggedAssignmentId,
                          targetPartyId,
                          targetSlotNumber
                        );
                      }}
                      onEmptySlotClick={(
                        partyId,
                        slotNumber
                      ) => {
                        setAddMemberTarget({
                          rosterId:
                            roster.id,
                          partyId,
                          slotNumber,
                        });

                        setMemberSearch(
                          ""
                        );
                      }}
                      onRemoveMember={
                        removeRosterMember
                      }
                    />

                    <RaidManagement
                      eventId={eventId}
                      rosterId={roster.id}
                      canEdit={canEditRosters}
                    />
                    </>
                  )
                )}
              </div>
            )}
          </div>
         </section>

          <div className="mt-6 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
            <div>
              <p className="font-medium">
                Participation
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                {data.stats.availableMembers} available ·{" "}
                {data.stats.totalMembers} total members
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowParticipation(
                  (value) => !value
                )
              }
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              {showParticipation
                ? "Hide Participation"
                : "Show Participation"}
            </button>
          </div>
        {/* ====================================================
            PARTICIPATION
        ==================================================== */}

        {showParticipation && (
          <section className="mt-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Participation
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Manage who is available for this event.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search members..."
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />

              <button
                type="button"
                onClick={() =>
                  setShowUnavailable(
                    (value) => !value
                  )
                }
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white"
              >
                {showUnavailable
                  ? "Hide Unavailable"
                  : "Show Unavailable"}
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="hidden grid-cols-[2fr_1.2fr_1fr_1fr_120px] gap-4 border-b border-zinc-800 px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600 md:grid">
              <span>Member</span>
              <span>Job</span>
              <span>Priority</span>
              <span>Status</span>
              <span className="text-right">
                Available
              </span>
            </div>

            {filteredParticipants.length ===
            0 ? (
              <div className="px-6 py-12 text-center text-sm text-zinc-600">
                No members match the current filters.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {filteredParticipants.map(
                  (participant) => (
                   <ParticipantRow
                    key={
                      participant.id
                    }
                    participant={
                      participant
                    }
                    updating={
                      updatingMember ===
                      participant.id
                    }
                    canEdit={
                      canManageEvents ||
                      participant.userId ===
                        currentUserId
                    }
                    onToggle={
                      updateAvailability
                    }
                  />
                  )
                )}
              </div>
            )}
          </div>
        </section>
        )}
      {/* ====================================================
          ALLOCATION
      ==================================================== */}

      {canManageEvents && (
        <section className="mt-10 pb-12">
          <div>
            <h2 className="text-xl font-semibold">
              Allocation
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Resource allocation runs associated with this event.
            </p>
          </div>

          <div className="mt-5">
            {data.allocationRuns.length ===
            0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 px-6 py-12 text-center">
                <p className="font-medium text-zinc-400">
                  No allocation runs
                </p>

                <Link
                  href={`/allocation?eventId=${data.event.id}`}
                  className="mt-4 inline-block text-sm text-zinc-300 hover:text-white"
                >
                  Open allocation →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.allocationRuns.map(
                  (run) => (
                    <div
                      key={run.id}
                      className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          Allocation Run
                        </p>

                        <p className="mt-1 text-xs text-zinc-600">
                          {run.id}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs ${
                          run.status ===
                          "COMPLETED"
                            ? "bg-emerald-950 text-emerald-400"
                            : run.status ===
                                "FAILED"
                              ? "bg-red-950 text-red-400"
                              : "bg-amber-950 text-amber-400"
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>
        )}
      </div>

      {/* ======================================================
          ADD MEMBER MODAL
      ====================================================== */}

      {addMemberTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={() =>
            setAddMemberTarget(null)
          }
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">
                  Add Member
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Select a member for Party{" "}
                  {getPartyNumber(
                    data,
                    addMemberTarget.partyId
                  )}{" "}
                  — Slot{" "}
                  {
                    addMemberTarget.slotNumber
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAddMemberTarget(
                    null
                  )
                }
                className="text-zinc-600 hover:text-white"
              >
                ✕
              </button>
            </div>

            <input
              value={memberSearch}
              onChange={(event) =>
                setMemberSearch(
                  event.target.value
                )
              }
              placeholder="Search character, job, or Discord name..."
              autoFocus
              className="mt-5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
            />

            <div className="mt-4 max-h-96 overflow-y-auto">
              {unassignedMembers.length ===
              0 ? (
                <div className="py-10 text-center text-sm text-zinc-600">
                  No available unassigned members.
                </div>
              ) : (
                <div className="space-y-1">
                  {unassignedMembers.map(
                    (member) => (
                      <button
                        key={
                          member.id
                        }
                        type="button"
                        disabled={
                          addingMember
                        }
                        onClick={() =>
                          addMemberToSlot(
                            member.id
                          )
                        }
                        className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-zinc-800 disabled:opacity-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-300">
                            {member.characterName ||
                              member.characterName}
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            {member.job ||
                              "Unknown Job"}
                          </p>
                        </div>

                        <span className="text-xs text-zinc-700">
                          {addingMember
                            ? "Adding..."
                            : "Add"}
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// =============================================================
// PARTICIPANT ROW
// =============================================================

function ParticipantRow({
  participant,
  updating,
  canEdit,
  onToggle,
}: {
  participant: Participant;
  updating: boolean;
  canEdit: boolean;
  onToggle: (
    memberId: string,
    available: boolean
  ) => void;
}) {
  return (
    <div
      className={`px-5 py-4 transition ${
        participant.available
          ? ""
          : "bg-zinc-950/50"
      }`}
    >
      <div className="grid gap-4 md:grid-cols-[2fr_1.2fr_1fr_1fr_120px] md:items-center">
        <div>
          <p
            className={`font-medium ${
              participant.available
                ? "text-white"
                : "text-zinc-500"
            }`}
          >
            {participant.characterName}
          </p>

          <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-600">
            {participant.characterName && (
              <span>
                {participant.characterName}
              </span>
            )}

            {participant.onLeave && (
              <span className="text-amber-500">
                On leave
              </span>
            )}
          </div>

          {participant.leaveReason && (
            <p className="mt-1 text-xs text-zinc-700">
              {participant.leaveReason}
            </p>
          )}
        </div>

        <div className="text-sm text-zinc-400">
          {participant.job ??
            "No job assigned"}
        </div>

        <div>
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-500">
            {participant.priority}
          </span>
        </div>

        <div>
          {participant.onLeave ? (
            <span className="text-xs text-amber-500">
              Leave
            </span>
          ) : participant.available ? (
            <span className="text-xs text-emerald-500">
              Available
            </span>
          ) : (
            <span className="text-xs text-zinc-600">
              Unavailable
            </span>
          )}
        </div>

        <div className="flex justify-start md:justify-end">
          {canEdit ? (
            <button
              type="button"
              disabled={
                updating ||
                participant.onLeave
              }
              onClick={() =>
                onToggle(
                  participant.id,
                  !participant.available
                )
              }
              className={`relative h-7 w-12 rounded-full transition ${
                participant.available
                  ? "bg-emerald-500"
                  : "bg-zinc-700"
              } ${
                updating
                  ? "cursor-wait opacity-50"
                  : participant.onLeave
                    ? "cursor-not-allowed opacity-30"
                    : ""
              }`}
              aria-label={
                participant.available
                  ? "Mark unavailable"
                  : "Mark available"
              }
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                  participant.available
                    ? "left-6"
                    : "left-1"
                }`}
              />
            </button>
          ) : (
            <span className="text-xs text-zinc-700">
              View only
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// ROSTER CARD
// =============================================================

function RosterCard({
  roster,
  canEdit,
  editing,
  onEdit,
  onDeleteRoster,
  draggedAssignmentId,
  movingAssignmentId,
  removingAssignmentId,
  onDragStart,
  onDragEnd,
  onDrop,
  onEmptySlotClick,
  onRemoveMember,
}: {
  roster: RosterSummary;
  canEdit: boolean;
  editing: boolean;

  onEdit: () => void;
  onDeleteRoster: () => void;

  draggedAssignmentId:
    | string
    | null;

  movingAssignmentId:
    | string
    | null;

  removingAssignmentId:
    | string
    | null;

  onDragStart: (
    assignmentId: string
  ) => void;

  onDragEnd: () => void;

  onDrop: (
    targetPartyId: string,
    targetSlotNumber: number
  ) => void;

  onEmptySlotClick: (
    partyId: string,
    slotNumber: number
  ) => void;

  onRemoveMember: (
    assignmentId: string
  ) => void;
}) {
  const parties =
    roster.parties ?? [];

  const battlefields =
    Array.from(
      new Set(
        parties.map(
          (party) =>
            party.battlefield
        )
      )
    );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">
              {roster.name}
            </h3>

            {editing && (
              <span className="rounded-full bg-blue-950 px-2.5 py-1 text-xs text-blue-400">
                Editing
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-zinc-600">
            {roster.generationMode ===
            "AUTOMATIC"
              ? "Automatic"
              : "Manual"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-500">
            {roster.memberCount} members
          </span>

          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-500">
            {roster.partyCount} parties
          </span>

          {canEdit && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  editing
                    ? "border-white bg-white text-black"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
                }`}
              >
                {editing
                  ? "Done Editing"
                  : "Edit Roster"}
              </button>

              <button
                type="button"
                onClick={onDeleteRoster}
                className="rounded-lg border border-red-900/60 px-3 py-2 text-xs font-medium text-red-400 transition hover:border-red-700 hover:bg-red-950/30 hover:text-red-300"
              >
                Delete Roster
              </button>
            </>
          )}
            
        </div>
      </div>

      {editing && (
        <div className="mt-4 rounded-lg border border-blue-900/50 bg-blue-950/20 px-4 py-3 text-xs text-blue-400">
          Drag members between slots to move or swap them.
          Click an empty slot to add an unassigned member.
          Use Remove member to take someone out of the roster.
          Manual changes override the automatic composition.
        </div>
      )}

      {roster.parties ? (
        <div className="mt-6 space-y-8">
          {battlefields.map(
            (battlefield) => {
              const battlefieldParties =
                parties.filter(
                  (party) =>
                    party.battlefield ===
                    battlefield
                );

              return (
                <div
                  key={
                    battlefield
                  }
                >
                  <h4 className="mb-3 text-sm font-semibold text-zinc-300">
                    {formatBattlefield(
                      battlefield
                    )}
                  </h4>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {battlefieldParties.map(
                      (party) => (
                        <PartyCard
                          key={
                            party.id
                          }
                          party={
                            party
                          }
                          canEdit={
                            canEdit
                          }
                          editing={
                            editing &&
                            canEdit
                          }
                          draggedAssignmentId={
                            draggedAssignmentId
                          }
                          movingAssignmentId={
                            movingAssignmentId
                          }
                          removingAssignmentId={
                            removingAssignmentId
                          }
                          onDragStart={
                            onDragStart
                          }
                          onDragEnd={
                            onDragEnd
                          }
                          onDrop={
                            onDrop
                          }
                          onEmptySlotClick={
                            onEmptySlotClick
                          }
                          onRemoveMember={
                            onRemoveMember
                          }
                        />
                      )
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
        <div className="mt-5 flex gap-6 text-sm">
          <div>
            <p className="text-zinc-600">
              Parties
            </p>

            <p className="mt-1 font-semibold">
              {roster.partyCount}
            </p>
          </div>

          <div>
            <p className="text-zinc-600">
              Members
            </p>

            <p className="mt-1 font-semibold">
              {roster.memberCount}
            </p>
          </div>

          <div>
            <p className="text-zinc-600">
              Created
            </p>

            <p className="mt-1 font-semibold">
              {formatDateTime(
                roster.createdAt
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// PARTY CARD
// =============================================================

function PartyCard({
  party,
  canEdit,
  editing,
  draggedAssignmentId,
  movingAssignmentId,
  removingAssignmentId,
  onDragStart,
  onDragEnd,
  onDrop,
  onEmptySlotClick,
  onRemoveMember,
}: {
  party: RosterParty;
  canEdit: boolean;
  editing: boolean;

  draggedAssignmentId:
    | string
    | null;

  movingAssignmentId:
    | string
    | null;

  removingAssignmentId:
    | string
    | null;

  onDragStart: (
    assignmentId: string
  ) => void;

  onDragEnd: () => void;

  onDrop: (
    targetPartyId: string,
    targetSlotNumber: number
  ) => void;

  onEmptySlotClick: (
    partyId: string,
    slotNumber: number
  ) => void;

  onRemoveMember: (
    assignmentId: string
  ) => void;
}) {
  const membersBySlot =
    new Map(
      party.members.map(
        (member) => [
          member.slotNumber,
          member,
        ]
      )
    );

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          Party {party.partyNumber}
        </p>

        <span className="text-xs text-zinc-600">
          {party.members.length}/5
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {Array.from(
          { length: 5 },
          (_, index) => {
            const slotNumber =
              index + 1;

            const assignment =
              membersBySlot.get(
                slotNumber
              );

            return (
              <div
                key={slotNumber}
                onDragOver={(event) => {
                  if (!editing) {
                    return;
                  }

                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!editing) {
                    return;
                  }

                  event.preventDefault();

                  onDrop(
                    party.id,
                    slotNumber
                  );
                }}
                className={`min-h-[58px] rounded-lg border px-3 py-2 transition ${
                  assignment
                    ? "border-zinc-800 bg-zinc-900"
                    : editing
                      ? "border-dashed border-zinc-700 bg-zinc-950 hover:border-zinc-500 hover:bg-zinc-900"
                      : "border-transparent bg-zinc-900/40"
                } ${
                  draggedAssignmentId ===
                  assignment?.id
                    ? "opacity-40"
                    : ""
                }`}
              >
                {assignment ? (
                  <div
                    draggable={
                      editing
                    }
                    onDragStart={(event) => {
                      if (!editing) {
                        return;
                      }

                      event.dataTransfer.effectAllowed =
                        "move";

                      event.dataTransfer.setData(
                        "text/plain",
                        assignment.id
                      );

                      onDragStart(
                        assignment.id
                      );
                    }}
                    onDragEnd={
                      onDragEnd
                    }
                    className={`flex items-center gap-3 ${
                      editing
                        ? "cursor-grab active:cursor-grabbing"
                        : ""
                    }`}
                  >
                    <span className="w-4 shrink-0 text-xs text-zinc-700">
                      {slotNumber}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-300">
                        {assignment.member
                          .characterName ||
                          assignment.member
                            .characterName}
                      </p>

                      <p className="truncate text-xs text-zinc-600">
                        {assignment.member
                          .job ||
                          "Unknown Job"}
                      </p>
                    </div>

                    {editing && (
                      <button
                        type="button"
                        draggable={
                          false
                        }
                        disabled={
                          removingAssignmentId ===
                          assignment.id
                        }
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          onRemoveMember(
                            assignment.id
                          );
                        }}
                        className="shrink-0 rounded-md border border-red-900/60 px-2 py-1 text-[10px] text-red-500 transition hover:border-red-700 hover:bg-red-950/50 hover:text-red-400 disabled:cursor-wait disabled:opacity-50"
                      >
                        {removingAssignmentId ===
                        assignment.id
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    )}

                    {movingAssignmentId ===
                      assignment.id && (
                      <span className="text-xs text-zinc-600">
                        ...
                      </span>
                    )}
                  </div>
                ) : editing ? (
                  <button
                    type="button"
                    onClick={() =>
                      onEmptySlotClick(
                        party.id,
                        slotNumber
                      )
                    }
                    className="flex min-h-[40px] w-full items-center gap-3 text-left"
                  >
                    <span className="w-4 shrink-0 text-xs text-zinc-700">
                      {slotNumber}
                    </span>

                    <span className="text-xs text-zinc-600 transition hover:text-white">
                      + Add member
                    </span>
                  </button>
                ) : (
                  <div className="flex min-h-[40px] items-center gap-3">
                    <span className="w-4 shrink-0 text-xs text-zinc-700">
                      {slotNumber}
                    </span>

                    <span className="text-xs text-zinc-800">
                      —
                    </span>
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

// =============================================================
// EVENT RULES
// =============================================================

function EventRules({
  type,
}: {
  type: EventType;
}) {
  if (
    type === "GUILD_LEAGUE"
  ) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Rule
          label="Schedule"
          value="Tuesday / Thursday"
        />

        <Rule
          label="Battlefields"
          value="2"
        />

        <Rule
          label="Players"
          value="40 / battlefield"
        />

        <Rule
          label="Parties"
          value="8 / battlefield"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Rule
        label="Schedule"
        value="Sunday"
      />

      <Rule
        label="Players"
        value="80"
      />

      <Rule
        label="Parties"
        value="16"
      />

      <Rule
        label="Party Size"
        value="5"
      />
    </div>
  );
}

function Rule({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p className="mt-1 font-medium text-zinc-300">
        {value}
      </p>
    </div>
  );
}

// =============================================================
// STAT CARD
// =============================================================

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}

// =============================================================
// HELPERS
// =============================================================

function getPartyNumber(
  data: EventResponse,
  partyId: string
) {
  for (
    const roster of data.rosters
  ) {
    const party =
      roster.parties?.find(
        (candidate) =>
          candidate.id ===
          partyId
      );

    if (party) {
      return party.partyNumber;
    }
  }

  return "?";
}

function formatEventType(
  type: EventType
) {
  return type ===
    "GUILD_LEAGUE"
    ? "Guild League"
    : "Emperium Overrun";
}

function formatBattlefield(
  battlefield:
    | "BATTLEFIELD_1"
    | "BATTLEFIELD_2"
) {
  return battlefield ===
    "BATTLEFIELD_1"
    ? "Battlefield 1"
    : "Battlefield 2";
}

function formatEventDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Asia/Bangkok",
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Asia/Bangkok",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}
