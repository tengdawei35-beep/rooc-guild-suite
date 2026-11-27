"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import RaidManagement from "./RaidManagement";
import RosterJobOverrides from "./RosterJobOverrides";
import EventAttendancePanel from "./EventAttendancePanel";
import EventResultsUploader from "./EventResultsUploader";

type EventType =
  | "GUILD_LEAGUE"
  | "EMPERIUM_OVERRUN"
  | "RO3_CUSTOM";

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
  eventTypeName?: string | null;
  guildEventTypeId?: string | null;
  battlefieldCount?: number | null;
  partiesPerBattlefield?: number | null;
  scheduleTimeZone?: string | null;
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
    ro3Stats?: Record<string, number | null> | null;
  };
};

type RosterParty = {
  id: string;
  partyNumber: number;
  battlefield: string;
  members: RosterMember[];
};

type RosterSummary = {
  id: string;
  name: string;
  generationMode:
  | "MANUAL"
  | "AUTOMATIC"
  | "PREFERRED";
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
  canManageEvents,
  canEditRosters,
}: {
  eventId: string;
  canManageEvents: boolean;
  canEditRosters: boolean;
}) {
  const [data, setData] =
    useState<EventResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [generatingRoster, setGeneratingRoster] =
    useState(false);
  const [creatingManualRoster, setCreatingManualRoster] = useState(false);
  const [sendingAttendancePrompt, setSendingAttendancePrompt] = useState(false);
  const [attendancePromptSent, setAttendancePromptSent] = useState(false);

  const [savingPreferred, setSavingPreferred] =
    useState(false);
  const [loadingPreferred, setLoadingPreferred] = useState(false);

  const [preferredSaved, setPreferredSaved] =
    useState(false);

  const [rosterJobOverrides, setRosterJobOverrides] =
    useState<Record<string, string | null>>({});

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
  const [deletingRosterId, setDeletingRosterId] = useState<string | null>(null);

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

  // Keep roster assignments in sync with attendance changes made in HMDL
  // or Discord. The server removes assignments immediately; this refresh
  // makes those removals visible without requiring a manual page reload.
  const refreshInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    const refreshEvent = async () => {
      if (cancelled || document.visibilityState !== "visible" || refreshInFlight.current) return;
      refreshInFlight.current = true;
      controller = new AbortController();
      try {
        const response = await fetch(`/api/events/${eventId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!cancelled) setData(result);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("[EVENT CLIENT] Failed to refresh event roster:", error);
        }
      } finally {
        refreshInFlight.current = false;
      }
    };
    const timer = window.setInterval(refreshEvent, 10000);
    document.addEventListener("visibilitychange", refreshEvent);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshEvent);
      controller?.abort();
      refreshInFlight.current = false;
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;

    async function loadRosterJobOverrides() {
      try {
        const response = await fetch(
          `/api/events/${eventId}/roster-job-overrides`,
          {
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ?? "Failed to load roster job overrides."
          );
        }

        if (cancelled) return;

        const next: Record<string, string | null> = {};

        for (const assignment of result.assignments ?? []) {
          next[assignment.assignmentId] =
            assignment.overrideJob ?? null;
        }

        setRosterJobOverrides(next);
      } catch (error) {
        console.error(
          "[EVENT CLIENT] Failed to load roster job overrides:",
          error
        );
      }
    }

    loadRosterJobOverrides();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // ==========================================================
  // GENERATE ROSTER
  // ==========================================================

async function createManualRoster() {
  if (!data) return;
  const name = window.prompt("Name this roster", "Main Roster");
  if (!name || !name.trim()) return;
  setCreatingManualRoster(true);
  setError(null);
  try {
    const response = await fetch("/api/events/rosters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, name: name.trim(), generationMode: "MANUAL" }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Failed to create manual roster.");
    await loadEvent();
  } catch (err) { setError(err instanceof Error ? err.message : "Failed to create manual roster."); }
  finally { setCreatingManualRoster(false); }
}

async function sendAttendancePromptAgain() {
  if (!window.confirm("Send the attendance prompt again to the configured Discord event channel? Existing prompts will remain active.")) return;
  setSendingAttendancePrompt(true);
  setAttendancePromptSent(false);
  setError(null);
  try {
    const response = await fetch(`/api/events/${eventId}/discord-prompt`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Failed to send attendance prompt.");
    setAttendancePromptSent(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to send attendance prompt.");
  } finally {
    setSendingAttendancePrompt(false);
  }
}

async function generateRoster() {
  setGeneratingRoster(true);
  setError(null);
  setPreferredSaved(false);

  try {
    const response = await fetch(
      `/api/events/${eventId}/rosters`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "AUTOMATIC",
        }),
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
// LOAD PREFERRED ROSTER
// ==========================================================

async function loadPreferredRoster() {
  setLoadingPreferred(true);
  setError(null);
  setPreferredSaved(false);

  try {
    const response = await fetch(
      `/api/events/${eventId}/rosters`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "PREFERRED",
        }),
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ??
          "Failed to load preferred roster."
      );
    }

    setEditingRosterId(null);
    await loadEvent();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to load preferred roster."
    );
  } finally {
    setLoadingPreferred(false);
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
    if (deletingRosterId) return;
    if (!window.confirm("Delete this roster? This cannot be undone.")) return;

    setDeletingRosterId(rosterId);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/rosters`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to delete roster.");

      setData((current) => current ? {
        ...current,
        rosters: current.rosters.filter((roster) => roster.id !== rosterId),
      } : current);

      if (editingRosterId === rosterId) setEditingRosterId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete roster.");
    } finally {
      setDeletingRosterId(null);
    }
  }

  function handleRosterJobSaved(
  assignmentId: string,
  overrideJob: string | null
) {
  setRosterJobOverrides((current) => ({
    ...current,
    [assignmentId]: overrideJob,
  }));
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
                  }
                }

                if (
                  !sourceAssignment ||
                  !sourceParty
                ) {
                  return roster;
                }

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
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <main className="hmdl-management hmdl-event-detail min-h-screen bg-zinc-950 text-white">
        <div className="hmdl-page">
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <p className="text-sm text-zinc-500">
              Loading event...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="hmdl-management hmdl-event-detail min-h-screen bg-zinc-950 text-white">
        <div className="hmdl-page">
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
    <main className="hmdl-management hmdl-event-detail min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page">
        <header className="mt-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                  {formatEventType(data.event.type, data.event.eventTypeName)}
                </span>

              </div>

              <h1 className="hmdl-page-title mt-2">
                {formatEventDate(data.event.date, data.event.type === "RO3_CUSTOM" ? data.event.scheduleTimeZone ?? "Asia/Bangkok" : "Asia/Bangkok", data.event.type === "RO3_CUSTOM")}
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {data.event.guild.name}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canManageEvents && (
                <>
                <button
                  type="button"
                  onClick={sendAttendancePromptAgain}
                  disabled={sendingAttendancePrompt}
                  className="rounded-lg border border-indigo-700/70 bg-indigo-950/40 px-3 py-2 text-xs font-medium text-indigo-300 transition hover:border-indigo-500 hover:bg-indigo-950 disabled:cursor-wait disabled:opacity-50"
                >
                  {sendingAttendancePrompt ? "Sending..." : "Send Attendance"}
                </button>
                <Link
                  href={`/allocation?eventId=${data.event.id}`}
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Allocation
                </Link>
                </>
              )}

              <button
                type="button"
                onClick={loadEvent}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        {attendancePromptSent && (
          <div className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Attendance prompt sent to the configured Discord channel.
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <EventAttendancePanel eventId={eventId} />

        {preferredSaved && (
          <div className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Roster saved as the preferred roster for future{" "}
            {formatEventType(data.event.type, data.event.eventTypeName)} events.
          </div>
        )}

        <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Event rules</p>
              <EventRules type={data.event.type} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-l border-zinc-800 pl-0 sm:pl-5">
              <CompactStat label="Members" value={data.stats.totalMembers} />
              <CompactStat label="Available" value={data.stats.availableMembers} />
              <CompactStat label="On leave" value={data.stats.onLeaveMembers} />
              <CompactStat label="Rosters" value={data.stats.rosterCount} />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Rosters
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                {data.event.type === "RO3_CUSTOM" ? "Create a manual roster using the configured battlefield and party capacity, then assign members." : "Generate and manually adjust event rosters."}
              </p>
            </div>

            {canEditRosters && (
              <div className="flex flex-wrap gap-2">
                {data.event.type === "RO3_CUSTOM" ? (
                  <button type="button" onClick={createManualRoster} disabled={creatingManualRoster} className="hmdl-btn hmdl-btn-primary rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-wait disabled:opacity-50">
                    {creatingManualRoster ? "Creating..." : "Create Manual Roster"}
                  </button>
                ) : (
                <>
                <button
                  type="button"
                  onClick={saveRosterAsPreferred}
                  disabled={
                    savingPreferred ||
                    data.rosters.length === 0
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingPreferred
                    ? "Saving..."
                    : preferredSaved
                      ? "Preferred Saved"
                      : "Save Roster as Preferred"}
                </button>

                <button
                  type="button"
                  onClick={loadPreferredRoster}
                  disabled={
                    loadingPreferred ||
                    generatingRoster
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white disabled:cursor-wait disabled:opacity-50"
                >
                  {loadingPreferred
                    ? "Loading..."
                    : "Load Preferred"}
                </button>

                <button
                  type="button"
                  onClick={generateRoster}
                  disabled={
                    generatingRoster ||
                    loadingPreferred
                  }
                  className="hmdl-btn hmdl-btn-primary rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-wait disabled:opacity-50"
                >
                  {generatingRoster
                    ? "Generating..."
                    : "Generate Roster"}
                </button>
                </>
                )}
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
                  {data.event.type === "RO3_CUSTOM" ? "Create a manual roster to start assigning members." : "Generate an automatic roster from the available members."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.rosters.map(
                  (roster) => (
                    <>
                    <RosterCard
                      defaultExpanded={data.rosters[0]?.id === roster.id}
                      key={
                        roster.id
                      }
                      eventId={eventId}
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
                      deletingRoster={deletingRosterId === roster.id}
                      draggedAssignmentId={
                        draggedAssignmentId
                      }
                      movingAssignmentId={
                        movingAssignmentId
                      }
                      removingAssignmentId={
                        removingAssignmentId
                      }
                      rosterJobOverrides={rosterJobOverrides}
                      onRosterJobSaved={handleRosterJobSaved}
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
                      onMoveMember={moveRosterMember}
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

      {canManageEvents && (
        <section className="mt-5 pb-8">
          <details className="group rounded-xl border border-zinc-800 bg-zinc-900/80">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="font-semibold">Allocation</span>
              <span className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{data.allocationRuns.length} {data.allocationRuns.length === 1 ? "run" : "runs"}</span>
                <span className="transition group-open:rotate-180">⌄</span>
              </span>
            </summary>
            <div className="border-t border-zinc-800 p-4">
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
          </details>
        </section>
        )}
        <div className="mt-5">
          <EventResultsUploader eventId={eventId} canManage={canManageEvents} />
        </div>
      </div>

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

function RosterCard({
  roster,
  eventId,
  canEdit,
  editing,
  onEdit,
  onDeleteRoster,
  deletingRoster,
  draggedAssignmentId,
  movingAssignmentId,
  removingAssignmentId,
  onDragStart,
  onDragEnd,
  onDrop,
  onEmptySlotClick,
  onRemoveMember,
  onMoveMember,
  rosterJobOverrides,
  onRosterJobSaved,
  defaultExpanded,
}: {
  roster: RosterSummary;
  defaultExpanded: boolean;
  eventId: string;
  canEdit: boolean;
  editing: boolean;
  onEdit: () => void;
  onDeleteRoster: () => void;
  deletingRoster: boolean;
  draggedAssignmentId: string | null;
  movingAssignmentId: string | null;
  removingAssignmentId: string | null;
  onDragStart: (assignmentId: string) => void;
  onDragEnd: () => void;
  onDrop: (targetPartyId: string, targetSlotNumber: number) => void;
  onEmptySlotClick: (partyId: string, slotNumber: number) => void;
  onRemoveMember: (assignmentId: string) => void;
  onMoveMember: (assignmentId: string, targetPartyId: string, targetSlotNumber: number) => void;
  rosterJobOverrides: Record<string, string | null>;
  onRosterJobSaved: (
    assignmentId: string,
    overrideJob: string | null
  ) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => { if (editing) setExpanded(true); }, [editing]);
  const parties = roster.parties ?? [];
  const battlefields = Array.from(new Set(parties.map((party) => party.battlefield)));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="text-xs text-violet-400">{expanded ? "▾" : "▸"}</span>
          <span className="font-semibold text-zinc-100">{roster.name}</span>
          {editing && <span className="rounded-full bg-blue-950 px-2 py-0.5 text-[10px] text-blue-300">Editing</span>}
          <span className="text-xs text-zinc-500">{roster.memberCount} members · {roster.partyCount} parties</span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <button type="button" onClick={onEdit} className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${editing ? "border-white bg-white text-black" : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}>
                {editing ? "Done Editing" : "Edit Roster"}
              </button>
              <button type="button" onClick={onDeleteRoster} disabled={deletingRoster} aria-busy={deletingRoster} className="rounded-lg border border-red-900/60 px-3 py-2 text-xs font-medium text-red-400 transition hover:border-red-700 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-wait disabled:opacity-50">{deletingRoster ? "Deleting…" : "Delete Roster"}</button>
            </>
          )}
        </div>
      </div>

      {expanded && <>
      <p className="mt-2 pl-5 text-[11px] text-zinc-600">{roster.generationMode === "AUTOMATIC" ? "Automatic" : "Manual"}</p>

      {editing && (
        <div className="mt-4 rounded-lg border border-blue-900/50 bg-blue-950/20 px-4 py-3 text-xs text-blue-400">
          Drag members between slots, or use each member’s Move to selector to move or swap them without dragging. Click an empty slot to add an unassigned member. Use Remove member to take someone out of the roster. Manual changes override the automatic composition.
        </div>
      )}

      {roster.parties ? (
        <div className="mt-3 space-y-4">
          {battlefields.map((battlefield) => {
            const battlefieldParties = parties.filter((party) => party.battlefield === battlefield);
            return (
              <div key={battlefield}>
                <h4 className="mb-2 text-xs font-semibold text-zinc-400">{formatBattlefield(battlefield)}</h4>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {battlefieldParties.map((party) => (
                    <PartyCard
                      key={party.id}
                      party={party}
                      canEdit={canEdit}
                      editing={editing && canEdit}
                      draggedAssignmentId={draggedAssignmentId}
                      movingAssignmentId={movingAssignmentId}
                      removingAssignmentId={removingAssignmentId}
                      eventId={eventId}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDrop={onDrop}
                      onEmptySlotClick={onEmptySlotClick}
                      onRemoveMember={onRemoveMember}
                      onMoveMember={onMoveMember}
                      rosterParties={parties}
                      rosterJobOverrides={rosterJobOverrides}
                      onRosterJobSaved={onRosterJobSaved}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 flex gap-6 text-sm">
          <div><p className="text-zinc-600">Parties</p><p className="mt-1 font-semibold">{roster.partyCount}</p></div>
          <div><p className="text-zinc-600">Members</p><p className="mt-1 font-semibold">{roster.memberCount}</p></div>
          <div><p className="text-zinc-600">Created</p><p className="mt-1 font-semibold">{formatDateTime(roster.createdAt)}</p></div>
        </div>
      )}
      </>}
    </div>
  );
}

function PartyCard({
  party,
  canEdit,
  eventId,
  editing,
  draggedAssignmentId,
  movingAssignmentId,
  removingAssignmentId,
  onDragStart,
  onDragEnd,
  onDrop,
  onEmptySlotClick,
  onRemoveMember,
  onMoveMember,
  rosterParties,
  rosterJobOverrides,
  onRosterJobSaved,
}: {
  party: RosterParty;
  rosterParties: RosterParty[];
  onMoveMember: (assignmentId: string, targetPartyId: string, targetSlotNumber: number) => void;
  canEdit: boolean;
  editing: boolean;
  draggedAssignmentId: string | null;
  movingAssignmentId: string | null;
  removingAssignmentId: string | null;
  onDragStart: (assignmentId: string) => void;
  onDragEnd: () => void;
  onDrop: (targetPartyId: string, targetSlotNumber: number) => void;
  onEmptySlotClick: (partyId: string, slotNumber: number) => void;
  onRemoveMember: (assignmentId: string) => void;
  eventId: string;
  rosterJobOverrides: Record<string, string | null>;
  onRosterJobSaved: (
    assignmentId: string,
    overrideJob: string | null
  ) => void;
}) {
  const membersBySlot = new Map(party.members.map((member) => [member.slotNumber, member]));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Party {party.partyNumber}</p>
        <span className="text-xs text-zinc-600">{party.members.length}/5</span>
      </div>

      <div className="mt-3 space-y-2">
        {Array.from({ length: 5 }, (_, index) => {
          const slotNumber = index + 1;
          const assignment = membersBySlot.get(slotNumber);

          return (
            <div
              key={slotNumber}
              onDragOver={(event) => {
                if (!editing) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                if (!editing) return;
                event.preventDefault();
                onDrop(party.id, slotNumber);
              }}
              className={`min-h-[58px] rounded-lg border px-3 py-2 transition ${assignment ? "border-zinc-800 bg-zinc-900" : editing ? "border-dashed border-zinc-700 bg-zinc-950 hover:border-zinc-500 hover:bg-zinc-900" : "border-transparent bg-zinc-900/40"} ${draggedAssignmentId === assignment?.id ? "opacity-40" : ""}`}
            >
              {assignment ? (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {editing ? (
                    <button
                      type="button"
                      draggable
                      aria-label={`Drag ${assignment.member.characterName} to another roster slot`}
                      title="Drag to move or swap"
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", assignment.id);
                        onDragStart(assignment.id);
                      }}
                      onDragEnd={onDragEnd}
                      className="w-4 shrink-0 cursor-grab touch-none text-left text-xs text-zinc-500 active:cursor-grabbing"
                    >
                      {slotNumber}
                    </button>
                  ) : (
                    <span className="w-4 shrink-0 text-xs text-zinc-700">{slotNumber}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-300">{assignment.member.characterName || assignment.member.characterName}</p>
                    {assignment.member.ro3Stats && (assignment.member.ro3Stats.damageVsDemiHuman != null || assignment.member.ro3Stats.damageReductionVsDemiHuman != null) && <p className="mt-1 text-[10px] text-zinc-500">Demi-Human DMG {assignment.member.ro3Stats.damageVsDemiHuman ?? "—"}% · Reduction {assignment.member.ro3Stats.damageReductionVsDemiHuman ?? "—"}%</p>}
                    <RosterJobOverrides
                      eventId={eventId}
                      assignmentId={assignment.id}
                      submittedJob={assignment.member.job ?? null}
                      overrideJob={
                        rosterJobOverrides[assignment.id] ?? null
                      }
                      canEdit={canEdit}
                      onSaved={onRosterJobSaved}
                    />
                  </div>
                  {editing && (
                    <select
                      aria-label={`Move ${assignment.member.characterName} to another roster slot`}
                      value=""
                      disabled={movingAssignmentId === assignment.id || removingAssignmentId === assignment.id}
                      onChange={(event) => {
                        const [targetPartyId, targetSlot] = event.target.value.split(":");
                        if (targetPartyId && targetSlot) onMoveMember(assignment.id, targetPartyId, Number(targetSlot));
                      }}
                      className="max-w-28 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-300"
                    >
                      <option value="">Move to…</option>
                      {rosterParties.flatMap((targetParty) =>
                        Array.from({ length: 5 }, (_, index) => index + 1)
                          .filter((targetSlot) => targetParty.id !== party.id || targetSlot !== slotNumber)
                          .map((targetSlot) => (
                            <option key={`${targetParty.id}:${targetSlot}`} value={`${targetParty.id}:${targetSlot}`}>
                              P{targetParty.partyNumber} · Slot {targetSlot}
                            </option>
                          ))
                      )}
                    </select>
                  )}
                  {editing && (
                    <button type="button" draggable={false} disabled={removingAssignmentId === assignment.id || movingAssignmentId === assignment.id} onClick={(event) => { event.stopPropagation(); if (window.confirm(`Remove ${assignment.member.characterName} from this roster?`)) onRemoveMember(assignment.id); }} className="shrink-0 rounded-md border border-red-900/60 px-2 py-1 text-[10px] text-red-500 transition hover:border-red-700 hover:bg-red-950/50 hover:text-red-400 disabled:cursor-wait disabled:opacity-50">
                      {removingAssignmentId === assignment.id ? "Removing..." : "Remove"}
                    </button>
                  )}
                  {movingAssignmentId === assignment.id && <span className="text-xs text-zinc-600">...</span>}
                </div>
              ) : editing ? (
                <button type="button" onClick={() => onEmptySlotClick(party.id, slotNumber)} className="flex min-h-[40px] w-full items-center gap-3 text-left">
                  <span className="w-4 shrink-0 text-xs text-zinc-700">{slotNumber}</span>
                  <span className="text-xs text-zinc-600 transition hover:text-white">+ Add member</span>
                </button>
              ) : (
                <div className="flex min-h-[40px] items-center gap-3">
                  <span className="w-4 shrink-0 text-xs text-zinc-700">{slotNumber}</span>
                  <span className="text-xs text-zinc-800">—</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventRules({ type }: { type: EventType }) {
  if (type === "GUILD_LEAGUE") {
    return <div className="flex flex-wrap gap-x-5 gap-y-2"><Rule label="Schedule" value="Tuesday / Thursday" /><Rule label="Battlefields" value="2" /><Rule label="Players" value="40 / battlefield" /><Rule label="Parties" value="8 / battlefield" /></div>;
  }
  return <div className="flex flex-wrap gap-x-5 gap-y-2"><Rule label="Schedule" value="Sunday" /><Rule label="Players" value="80" /><Rule label="Parties" value="16" /><Rule label="Party Size" value="5" /></div>;
}

function Rule({ label, value }: { label: string; value: string }) {
  return <div className="min-w-20"><p className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-0.5 text-xs font-medium text-zinc-300">{value}</p></div>;
}

function CompactStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-14"><p className="text-lg font-semibold leading-none text-zinc-100">{value}</p><p className="mt-1 text-[10px] text-zinc-500">{label}</p></div>;
}

function getPartyNumber(data: EventResponse, partyId: string) {
  for (const roster of data.rosters) {
    const party = roster.parties?.find((candidate) => candidate.id === partyId);
    if (party) return party.partyNumber;
  }
  return "?";
}

function formatEventType(type: EventType, customName?: string | null) {
  if (type === "RO3_CUSTOM") return customName || "RO3 Event";
  return type === "GUILD_LEAGUE" ? "Guild League" : "Emperium Overrun";
}

function formatBattlefield(battlefield: string) {
  return "Battlefield " + battlefield.replace("BATTLEFIELD_", "");
}

function formatEventDate(value: string, timeZone?: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone, weekday: "long", day: "numeric", month: "short", year: "numeric", hour: includeTime ? "2-digit" : undefined, minute: includeTime ? "2-digit" : undefined }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
