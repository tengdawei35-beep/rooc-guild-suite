"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import ImportMembersModal from "./ImportMembersModal";

type UserRole =
  | "LEADER"
  | "COUNCIL"
  | "OFFICER"
  | "MEMBER";

type Member = {
  id: string;
  userId: string | null;

  displayName: string;
  characterName: string | null;
  job: string | null;

  pdef: number | null;
  mdef: number | null;

  pvpDamageBonus: number | null;
  pvpDamageReduction: number | null;

  pdmgPercent: number | null;
  mdmgPercent: number | null;

  pdmgReductionPercent:
    | number
    | null;

  mdmgReductionPercent:
    | number
    | null;

  critRes: number | null;
  ignorePdef: number | null;
  ignoreMdef: number | null;

  damageVsMedium:
    | number
    | null;

  damageReductionVsMedium:
    | number
    | null;

  damageVsSmall:
    | number
    | null;

  damageReductionVsSmall:
    | number
    | null;

  damageVsDemiHuman:
    | number
    | null;

  damageReductionVsDemiHuman:
    | number
    | null;

  damageVsBrute:
    | number
    | null;

  damageReductionVsBrute:
    | number
    | null;

  equipmentPdefPercent:
    | number
    | null;

  equipmentMdefPercent:
    | number
    | null;

  patk: number | null;
  matk: number | null;
  hp: number | null;

  active: boolean;
  eligible: boolean;

  priority:
    | "LEADER"
    | "OFFICER"
    | "COUNCIL"
    | "MEMBER";

  remarks: string | null;

  leaveDates: {
    id: string;
    date: string;
    reason: string | null;
  }[];
};

type MemberForm = {
  displayName: string;
  characterName: string;
  job: string;

  active: boolean;
  eligible: boolean;

  priority:
    | "LEADER"
    | "OFFICER"
    | "COUNCIL"
    | "MEMBER";

  remarks: string;

  pdef: string;
  mdef: string;

  pvpDamageBonus: string;
  pvpDamageReduction: string;

  pdmgPercent: string;
  mdmgPercent: string;

  pdmgReductionPercent: string;
  mdmgReductionPercent: string;

  critRes: string;
  ignorePdef: string;
  ignoreMdef: string;

  damageVsMedium: string;
  damageReductionVsMedium: string;

  damageVsSmall: string;
  damageReductionVsSmall: string;

  damageVsDemiHuman: string;
  damageReductionVsDemiHuman: string;

  damageVsBrute: string;
  damageReductionVsBrute: string;

  equipmentPdefPercent: string;
  equipmentMdefPercent: string;

  patk: string;
  matk: string;
  hp: string;
};

const EMPTY_FORM: MemberForm = {
  displayName: "",
  characterName: "",
  job: "",

  active: true,
  eligible: true,

  priority: "MEMBER",

  remarks: "",

  pdef: "",
  mdef: "",

  pvpDamageBonus: "",
  pvpDamageReduction: "",

  pdmgPercent: "",
  mdmgPercent: "",

  pdmgReductionPercent: "",
  mdmgReductionPercent: "",

  critRes: "",
  ignorePdef: "",
  ignoreMdef: "",

  damageVsMedium: "",
  damageReductionVsMedium: "",

  damageVsSmall: "",
  damageReductionVsSmall: "",

  damageVsDemiHuman: "",
  damageReductionVsDemiHuman: "",

  damageVsBrute: "",
  damageReductionVsBrute: "",

  equipmentPdefPercent: "",
  equipmentMdefPercent: "",

  patk: "",
  matk: "",
  hp: "",
};

function toInputValue(
  value: number | null
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

function parseNumber(
  value: string
): number | null {
  if (!value.trim()) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return null;
  }

  return number;
}

function formatPriority(
  priority: Member["priority"]
) {
  switch (priority) {
    case "LEADER":
      return "Leader";

    case "OFFICER":
      return "Officer";

    case "COUNCIL":
      return "Council";

    case "MEMBER":
      return "Member";

    default:
      return priority;
  }
}

export default function MembersClient({
  initialMembers,
}: {
  initialMembers: Member[];
}) {
  const [members, setMembers] =
    useState<Member[]>(
      initialMembers
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(
    null
  );

  const [
    userRole,
    setUserRole,
  ] = useState<UserRole | null>(
    null
  );

  const [
    selectedMember,
    setSelectedMember,
  ] = useState<Member | null>(
    null
  );

  const [form, setForm] =
    useState<MemberForm>({
      ...EMPTY_FORM,
    });

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [jobFilter, setJobFilter] =
    useState("ALL");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("ALL");

  const [
    showImport,
    setShowImport,
  ] = useState(false);

  // ============================================================
  // LEAVE / AVAILABILITY
  // ============================================================

  const [
    leaveDate,
    setLeaveDate,
  ] = useState("");

  const [
    leaveReason,
    setLeaveReason,
  ] = useState("");

  const [
    leaveSaving,
    setLeaveSaving,
  ] = useState(false);

  // ============================================================
  // ACCESS CONTROL
  // ============================================================

  const canManageMembers =
    userRole === "LEADER" ||
    userRole === "COUNCIL" ||
    userRole === "OFFICER";

  const canImportMembers =
    canManageMembers;

  const canDeleteMembers =
    canManageMembers;

  function isOwnMember(
    member: Member
  ) {
    return (
      currentUserId !== null &&
      member.userId !== null &&
      member.userId ===
        currentUserId
    );
  }

  function canEditMember(
    member: Member
  ) {
    if (canManageMembers) {
      return true;
    }

    return (
      userRole === "MEMBER" &&
      isOwnMember(member)
    );
  }

  function canManageLeave(
    member: Member
  ) {
    if (canManageMembers) {
      return true;
    }

    return (
      userRole === "MEMBER" &&
      isOwnMember(member)
    );
  }

  // ============================================================
  // LOAD AUTH
  // ============================================================

  async function loadAuth() {
    try {
      const response =
        await fetch(
          "/api/auth/me",
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setCurrentUserId(null);
        setUserRole(null);
        return;
      }

      setCurrentUserId(
        data.user?.id ?? null
      );

      setUserRole(
        data.role ?? null
      );
    } catch {
      setCurrentUserId(null);
      setUserRole(null);
    }
  }

  // ============================================================
  // LOAD MEMBERS
  // ============================================================

  async function loadMembers() {
    try {
      setLoading(true);
      setError(null);

      const response =
        await fetch(
          "/api/guild/members",
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to load members."
        );
      }

      setMembers(
        data.members ?? []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load members."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuth();
    loadMembers();
  }, []);

  // ============================================================
  // NEW MEMBER
  // ============================================================

  function openNewMember() {
    if (!canManageMembers) {
      return;
    }

    setSelectedMember(null);

    setForm({
      ...EMPTY_FORM,
    });

    setLeaveDate("");
    setLeaveReason("");
    setError(null);
  }

  // ============================================================
  // OPEN MEMBER
  // ============================================================

  function openMember(
    member: Member
  ) {
    if (
      !canEditMember(member)
    ) {
      return;
    }

    setSelectedMember(member);

    setForm({
      displayName:
        member.displayName,

      characterName:
        member.characterName ??
        "",

      job:
        member.job ?? "",

      active:
        member.active,

      eligible:
        member.eligible,

      priority:
        member.priority,

      remarks:
        member.remarks ?? "",

      pdef:
        toInputValue(
          member.pdef
        ),

      mdef:
        toInputValue(
          member.mdef
        ),

      pvpDamageBonus:
        toInputValue(
          member.pvpDamageBonus
        ),

      pvpDamageReduction:
        toInputValue(
          member.pvpDamageReduction
        ),

      pdmgPercent:
        toInputValue(
          member.pdmgPercent
        ),

      mdmgPercent:
        toInputValue(
          member.mdmgPercent
        ),

      pdmgReductionPercent:
        toInputValue(
          member.pdmgReductionPercent
        ),

      mdmgReductionPercent:
        toInputValue(
          member.mdmgReductionPercent
        ),

      critRes:
        toInputValue(
          member.critRes
        ),

      ignorePdef:
        toInputValue(
          member.ignorePdef
        ),

      ignoreMdef:
        toInputValue(
          member.ignoreMdef
        ),

      damageVsMedium:
        toInputValue(
          member.damageVsMedium
        ),

      damageReductionVsMedium:
        toInputValue(
          member.damageReductionVsMedium
        ),

      damageVsSmall:
        toInputValue(
          member.damageVsSmall
        ),

      damageReductionVsSmall:
        toInputValue(
          member.damageReductionVsSmall
        ),

      damageVsDemiHuman:
        toInputValue(
          member.damageVsDemiHuman
        ),

      damageReductionVsDemiHuman:
        toInputValue(
          member.damageReductionVsDemiHuman
        ),

      damageVsBrute:
        toInputValue(
          member.damageVsBrute
        ),

      damageReductionVsBrute:
        toInputValue(
          member.damageReductionVsBrute
        ),

      equipmentPdefPercent:
        toInputValue(
          member.equipmentPdefPercent
        ),

      equipmentMdefPercent:
        toInputValue(
          member.equipmentMdefPercent
        ),

      patk:
        toInputValue(
          member.patk
        ),

      matk:
        toInputValue(
          member.matk
        ),

      hp:
        toInputValue(
          member.hp
        ),
    });

    setLeaveDate("");
    setLeaveReason("");
    setError(null);
  }

  // ============================================================
  // CLOSE MEMBER
  // ============================================================

  function closeMember() {
    if (
      saving ||
      deleting ||
      leaveSaving
    ) {
      return;
    }

    setSelectedMember(null);

    setForm({
      ...EMPTY_FORM,
    });

    setLeaveDate("");
    setLeaveReason("");
    setError(null);
  }

  // ============================================================
  // SET FORM FIELD
  // ============================================================

  function setField<
    K extends keyof MemberForm
  >(
    field: K,
    value: MemberForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // ============================================================
  // SAVE MEMBER
  // ============================================================

  async function saveMember() {
    if (!canManageMembers) {
      if (
        !selectedMember ||
        !isOwnMember(
          selectedMember
        )
      ) {
        setError(
          "You can only edit your own member profile."
        );
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        ...(selectedMember
          ? {
              id:
                selectedMember.id,
            }
          : {}),

        displayName:
          form.displayName.trim(),

        characterName:
          form.characterName.trim() ||
          null,

        job:
          form.job.trim() ||
          null,

        active:
          form.active,

        eligible:
          form.eligible,

        priority:
          form.priority,

        remarks:
          form.remarks.trim() ||
          null,

        pdef:
          parseNumber(form.pdef),

        mdef:
          parseNumber(form.mdef),

        pvpDamageBonus:
          parseNumber(
            form.pvpDamageBonus
          ),

        pvpDamageReduction:
          parseNumber(
            form.pvpDamageReduction
          ),

        pdmgPercent:
          parseNumber(
            form.pdmgPercent
          ),

        mdmgPercent:
          parseNumber(
            form.mdmgPercent
          ),

        pdmgReductionPercent:
          parseNumber(
            form.pdmgReductionPercent
          ),

        mdmgReductionPercent:
          parseNumber(
            form.mdmgReductionPercent
          ),

        critRes:
          parseNumber(
            form.critRes
          ),

        ignorePdef:
          parseNumber(
            form.ignorePdef
          ),

        ignoreMdef:
          parseNumber(
            form.ignoreMdef
          ),

        damageVsMedium:
          parseNumber(
            form.damageVsMedium
          ),

        damageReductionVsMedium:
          parseNumber(
            form.damageReductionVsMedium
          ),

        damageVsSmall:
          parseNumber(
            form.damageVsSmall
          ),

        damageReductionVsSmall:
          parseNumber(
            form.damageReductionVsSmall
          ),

        damageVsDemiHuman:
          parseNumber(
            form.damageVsDemiHuman
          ),

        damageReductionVsDemiHuman:
          parseNumber(
            form.damageReductionVsDemiHuman
          ),

        damageVsBrute:
          parseNumber(
            form.damageVsBrute
          ),

        damageReductionVsBrute:
          parseNumber(
            form.damageReductionVsBrute
          ),

        equipmentPdefPercent:
          parseNumber(
            form.equipmentPdefPercent
          ),

        equipmentMdefPercent:
          parseNumber(
            form.equipmentMdefPercent
          ),

        patk:
          parseNumber(form.patk),

        matk:
          parseNumber(form.matk),

        hp:
          parseNumber(form.hp),
      };

      if (
        !payload.displayName
      ) {
        throw new Error(
          "Discord/display name is required."
        );
      }

      if (
        !payload.characterName
      ) {
        throw new Error(
          "Character name is required."
        );
      }

      if (!payload.job) {
        throw new Error(
          "Job is required."
        );
      }

      const response =
        await fetch(
          "/api/guild/members",
          {
            method:
              selectedMember
                ? "PUT"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to save member."
        );
      }

      await loadMembers();

      closeMember();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save member."
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // DELETE MEMBER
  // ============================================================

  async function deleteMember() {
    if (
      !canDeleteMembers ||
      !selectedMember
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${
          selectedMember.characterName ??
          selectedMember.displayName
        }? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const response =
        await fetch(
          `/api/guild/members/${selectedMember.id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to delete member."
        );
      }

      await loadMembers();

      closeMember();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete member."
      );
    } finally {
      setDeleting(false);
    }
  }

  // ============================================================
  // ADD LEAVE DATE
  // ============================================================

  async function addLeaveDate() {
    if (
      !selectedMember ||
      !leaveDate
    ) {
      return;
    }

    if (
      !canManageLeave(
        selectedMember
      )
    ) {
      setError(
        "You can only manage your own unavailable dates."
      );
      return;
    }

    setLeaveSaving(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/guild/members/leave",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              memberId:
                selectedMember.id,

              date:
                leaveDate,

              reason:
                leaveReason.trim() ||
                null,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to add unavailable date."
        );
      }

      const newLeave =
        data.leave as Member["leaveDates"][number];

      const updatedMember: Member =
        {
          ...selectedMember,

          leaveDates: [
            ...selectedMember.leaveDates,
            newLeave,
          ].sort(
            (a, b) =>
              new Date(
                a.date
              ).getTime() -
              new Date(
                b.date
              ).getTime()
          ),
        };

      setMembers(
        (current) =>
          current.map(
            (member) =>
              member.id ===
              updatedMember.id
                ? updatedMember
                : member
          )
      );

      setSelectedMember(
        updatedMember
      );

      setLeaveDate("");
      setLeaveReason("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add unavailable date."
      );
    } finally {
      setLeaveSaving(false);
    }
  }

  // ============================================================
  // REMOVE LEAVE DATE
  // ============================================================

  async function removeLeaveDate(
    leaveId: string
  ) {
    if (!selectedMember) {
      return;
    }

    if (
      !canManageLeave(
        selectedMember
      )
    ) {
      setError(
        "You can only manage your own unavailable dates."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Remove this unavailable date?"
      );

    if (!confirmed) {
      return;
    }

    setLeaveSaving(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/guild/members/leave?id=${leaveId}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to remove unavailable date."
        );
      }

      const updatedMember: Member =
        {
          ...selectedMember,

          leaveDates:
            selectedMember.leaveDates.filter(
              (leave) =>
                leave.id !==
                leaveId
            ),
        };

      setMembers(
        (current) =>
          current.map(
            (member) =>
              member.id ===
              updatedMember.id
                ? updatedMember
                : member
          )
      );

      setSelectedMember(
        updatedMember
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove unavailable date."
      );
    } finally {
      setLeaveSaving(false);
    }
  }

  // ============================================================
  // FILTERS
  // ============================================================

  const jobs =
    useMemo(
      () =>
        [
          ...new Set(
            members
              .map(
                (member) =>
                  member.job
              )
              .filter(
                (
                  job
                ): job is string =>
                  Boolean(job)
              )
          ),
        ].sort(),
      [members]
    );

  const filteredMembers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return members.filter(
        (member) => {
          const matchesSearch =
            !query ||
            [
              member.displayName,
              member.characterName,
              member.job,
              member.priority,
            ]
              .filter(
                (
                  value
                ): value is string =>
                  Boolean(value)
              )
              .some(
                (value) =>
                  value
                    .toLowerCase()
                    .includes(
                      query
                    )
              );

          const matchesJob =
            jobFilter ===
              "ALL" ||
            member.job ===
              jobFilter;

          const matchesStatus =
            statusFilter ===
              "ALL" ||
            (statusFilter ===
              "ACTIVE" &&
              member.active) ||
            (statusFilter ===
              "INACTIVE" &&
              !member.active);

          return (
            matchesSearch &&
            matchesJob &&
            matchesStatus
          );
        }
      );
    }, [
      members,
      search,
      jobFilter,
      statusFilter,
    ]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Guild Members
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Manage guild members,
              profiles and availability.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canImportMembers && (
              <button
                type="button"
                onClick={() =>
                  setShowImport(
                    true
                  )
                }
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                Import Members
              </button>
            )}

            {canManageMembers && (
              <button
                type="button"
                onClick={
                  openNewMember
                }
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
              >
                Add Member
              </button>
            )}
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* FILTERS */}

        <div className="mb-6 grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search members..."
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
          />

          <select
            value={jobFilter}
            onChange={(event) =>
              setJobFilter(
                event.target.value
              )
            }
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none"
          >
            <option value="ALL">
              All Jobs
            </option>

            {jobs.map((job) => (
              <option
                key={job}
                value={job}
              >
                {job}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none"
          >
            <option value="ALL">
              All Status
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="INACTIVE">
              Inactive
            </option>
          </select>
        </div>

        {/* MEMBER TABLE */}

        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-400">
                  Character
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-400">
                  Discord
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-400">
                  Job
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-400">
                  Priority
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-400">
                  Status
                </th>

                <th className="px-4 py-3 text-left font-medium text-zinc-400">
                  Eligible
                </th>

                <th className="px-4 py-3 text-right font-medium text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    Loading members...
                  </td>
                </tr>
              ) : filteredMembers.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    No members found.
                  </td>
                </tr>
              ) : (
                filteredMembers.map(
                  (member) => (
                    <tr
                      key={member.id}
                      className="border-b border-zinc-800 last:border-0 transition hover:bg-zinc-800/50"
                    >
                      {/* CHARACTER */}

                      <td className="px-4 py-3">
                        <Link
                          href={`/guild/members/${member.id}`}
                          className="font-medium text-zinc-100 hover:text-white hover:underline"
                        >
                          {member.characterName ??
                            member.displayName}
                        </Link>
                      </td>

                      {/* DISCORD */}

                      <td className="px-4 py-3 text-zinc-400">
                        {member.displayName}
                      </td>

                      {/* JOB */}

                      <td className="px-4 py-3 text-zinc-300">
                        {member.job ??
                          "—"}
                      </td>

                      {/* PRIORITY */}

                      <td className="px-4 py-3 text-zinc-300">
                        {formatPriority(
                          member.priority
                        )}
                      </td>

                      {/* STATUS */}

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            member.active
                              ? "bg-emerald-950 text-emerald-300"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {member.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      {/* ELIGIBLE */}

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            member.eligible
                              ? "bg-blue-950 text-blue-300"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {member.eligible
                            ? "Yes"
                            : "No"}
                        </span>
                      </td>

                      {/* ACTIONS */}

                      <td className="px-4 py-3 text-right">
                        {canEditMember(
                          member
                        ) ? (
                          <button
                            type="button"
                            onClick={() =>
                              openMember(
                                member
                              )
                            }
                            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
                          >
                            Edit
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-600">
                            View only
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        {/* ====================================================== */}
        {/* IMPORT MODAL */}
        {/* ====================================================== */}

        {showImport &&
          canImportMembers && (
            <ImportMembersModal
              onClose={() =>
                setShowImport(
                  false
                )
              }
              onImported={async () => {
                setShowImport(
                  false
                );

                await loadMembers();
              }}
            />
          )}

        {/* ====================================================== */}
        {/* MEMBER FORM */}
        {/* ====================================================== */}

        {selectedMember !==
          null && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
            <div className="mx-auto my-8 max-w-5xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
              {/* HEADER */}

              <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedMember
                      ? "Edit Member"
                      : "Add Member"}
                  </h2>

                  {userRole ===
                    "MEMBER" &&
                    isOwnMember(
                      selectedMember
                    ) && (
                      <p className="mt-1 text-xs text-zinc-500">
                        You are editing your
                        own member profile.
                      </p>
                    )}
                </div>

                <button
                  type="button"
                  onClick={
                    closeMember
                  }
                  disabled={
                    saving ||
                    deleting ||
                    leaveSaving
                  }
                  className="rounded-lg px-3 py-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* FORM */}

              <div className="max-h-[75vh] overflow-y-auto p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* BASIC INFORMATION */}

                  <section>
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                      Basic Information
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm text-zinc-400">
                          Discord Name
                        </label>

                        <input
                          type="text"
                          value={
                            form.displayName
                          }
                          onChange={(
                            event
                          ) =>
                            setField(
                              "displayName",
                              event
                                .target
                                .value
                            )
                          }
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-zinc-400">
                          Character Name
                        </label>

                        <input
                          type="text"
                          value={
                            form.characterName
                          }
                          onChange={(
                            event
                          ) =>
                            setField(
                              "characterName",
                              event
                                .target
                                .value
                            )
                          }
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-zinc-400">
                          Job
                        </label>

                        <input
                          type="text"
                          value={
                            form.job
                          }
                          onChange={(
                            event
                          ) =>
                            setField(
                              "job",
                              event
                                .target
                                .value
                            )
                          }
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        />
                      </div>

                      {/* MANAGEMENT FIELDS */}

                      {canManageMembers && (
                        <>
                          <div>
                            <label className="mb-1 block text-sm text-zinc-400">
                              Priority
                            </label>

                            <select
                              value={
                                form.priority
                              }
                              onChange={(
                                event
                              ) =>
                                setField(
                                  "priority",
                                  event
                                    .target
                                    .value as MemberForm["priority"]
                                )
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                            >
                              <option value="MEMBER">
                                Member
                              </option>

                              <option value="OFFICER">
                                Officer
                              </option>

                              <option value="COUNCIL">
                                Council
                              </option>

                              <option value="LEADER">
                                Leader
                              </option>
                            </select>
                          </div>

                          <div className="flex gap-6">
                            <label className="flex items-center gap-2 text-sm text-zinc-300">
                              <input
                                type="checkbox"
                                checked={
                                  form.active
                                }
                                onChange={(
                                  event
                                ) =>
                                  setField(
                                    "active",
                                    event
                                      .target
                                      .checked
                                  )
                                }
                              />

                              Active
                            </label>

                            <label className="flex items-center gap-2 text-sm text-zinc-300">
                              <input
                                type="checkbox"
                                checked={
                                  form.eligible
                                }
                                onChange={(
                                  event
                                ) =>
                                  setField(
                                    "eligible",
                                    event
                                      .target
                                      .checked
                                  )
                                }
                              />

                              Eligible
                            </label>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm text-zinc-400">
                              Remarks
                            </label>

                            <textarea
                              value={
                                form.remarks
                              }
                              onChange={(
                                event
                              ) =>
                                setField(
                                  "remarks",
                                  event
                                    .target
                                    .value
                                )
                              }
                              rows={3}
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </section>

                  {/* COMBAT STATS */}

                  <section>
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                      Combat Stats
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        [
                          "PDEF",
                          "pdef",
                        ],
                        [
                          "MDEF",
                          "mdef",
                        ],
                        [
                          "PATK",
                          "patk",
                        ],
                        [
                          "MATK",
                          "matk",
                        ],
                        [
                          "HP",
                          "hp",
                        ],
                        [
                          "Crit Res",
                          "critRes",
                        ],
                        [
                          "Ignore PDEF",
                          "ignorePdef",
                        ],
                        [
                          "Ignore MDEF",
                          "ignoreMdef",
                        ],
                        [
                          "PvP DMG Bonus",
                          "pvpDamageBonus",
                        ],
                        [
                          "PvP DMG Reduction",
                          "pvpDamageReduction",
                        ],
                        [
                          "P DMG %",
                          "pdmgPercent",
                        ],
                        [
                          "M DMG %",
                          "mdmgPercent",
                        ],
                        [
                          "P DMG Reduction %",
                          "pdmgReductionPercent",
                        ],
                        [
                          "M DMG Reduction %",
                          "mdmgReductionPercent",
                        ],
                        [
                          "DMG vs Small",
                          "damageVsSmall",
                        ],
                        [
                          "Reduction vs Small",
                          "damageReductionVsSmall",
                        ],
                        [
                          "DMG vs Medium",
                          "damageVsMedium",
                        ],
                        [
                          "Reduction vs Medium",
                          "damageReductionVsMedium",
                        ],
                        [
                          "DMG vs Demi-Human",
                          "damageVsDemiHuman",
                        ],
                        [
                          "Reduction vs Demi-Human",
                          "damageReductionVsDemiHuman",
                        ],
                        [
                          "DMG vs Brute",
                          "damageVsBrute",
                        ],
                        [
                          "Reduction vs Brute",
                          "damageReductionVsBrute",
                        ],
                        [
                          "Equipment PDEF %",
                          "equipmentPdefPercent",
                        ],
                        [
                          "Equipment MDEF %",
                          "equipmentMdefPercent",
                        ],
                      ].map(
                        ([label, field]) => (
                          <div
                            key={
                              field
                            }
                          >
                            <label className="mb-1 block text-xs text-zinc-500">
                              {
                                label
                              }
                            </label>

                            <input
                              type="number"
                              step="any"
                              value={
                                form[
                                  field as keyof MemberForm
                                ] as string
                              }
                              onChange={(
                                event
                              ) =>
                                setField(
                                  field as keyof MemberForm,
                                  event
                                    .target
                                    .value as never
                                )
                              }
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            />
                          </div>
                        )
                      )}
                    </div>
                  </section>
                </div>

                {/* ================================================== */}
                {/* AVAILABILITY */}
                {/* ================================================== */}

                <section className="mt-8 border-t border-zinc-800 pt-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                      Unavailable Dates
                    </h3>

                    <p className="mt-1 text-xs text-zinc-600">
                      Dates when this member
                      cannot participate.
                    </p>
                  </div>

                  {canManageLeave(
                    selectedMember
                  ) ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
                        <input
                          type="date"
                          value={
                            leaveDate
                          }
                          onChange={(
                            event
                          ) =>
                            setLeaveDate(
                              event
                                .target
                                .value
                            )
                          }
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                        />

                        <input
                          type="text"
                          value={
                            leaveReason
                          }
                          onChange={(
                            event
                          ) =>
                            setLeaveReason(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="Reason (optional)"
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                        />

                        <button
                          type="button"
                          onClick={
                            addLeaveDate
                          }
                          disabled={
                            !leaveDate ||
                            leaveSaving
                          }
                          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {leaveSaving
                            ? "Saving..."
                            : "Add Date"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-600">
                      You can only manage your
                      own unavailable dates.
                    </p>
                  )}

                  <div className="mt-4 space-y-2">
                    {selectedMember
                      .leaveDates
                      .length ===
                    0 ? (
                      <p className="text-sm text-zinc-600">
                        No unavailable dates.
                      </p>
                    ) : (
                      selectedMember.leaveDates.map(
                        (leave) => (
                          <div
                            key={
                              leave.id
                            }
                            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3"
                          >
                            <div>
                              <div className="text-sm font-medium text-zinc-200">
                                {new Date(
                                  leave.date
                                ).toLocaleDateString()}
                              </div>

                              {leave.reason && (
                                <div className="mt-1 text-xs text-zinc-500">
                                  {
                                    leave.reason
                                  }
                                </div>
                              )}
                            </div>

                            {canManageLeave(
                              selectedMember
                            ) && (
                              <button
                                type="button"
                                onClick={() =>
                                  removeLeaveDate(
                                    leave.id
                                  )
                                }
                                disabled={
                                  leaveSaving
                                }
                                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        )
                      )
                    )}
                  </div>
                </section>
              </div>

              {/* FOOTER */}

              <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
                <div>
                  {canDeleteMembers &&
                    selectedMember && (
                      <button
                        type="button"
                        onClick={
                          deleteMember
                        }
                        disabled={
                          saving ||
                          deleting
                        }
                        className="rounded-lg border border-red-900 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-950/50 disabled:opacity-50"
                      >
                        {deleting
                          ? "Deleting..."
                          : "Delete Member"}
                      </button>
                    )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={
                      closeMember
                    }
                    disabled={
                      saving ||
                      deleting ||
                      leaveSaving
                    }
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      saveMember
                    }
                    disabled={
                      saving ||
                      deleting
                    }
                    className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}