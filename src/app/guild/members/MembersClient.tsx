"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import ImportMembersModal from "./ImportMembersModal";

import {
  hasPermission,
} from "@/lib/permissions";

import {
  calculateRawPdef,
  calculateRawMdef,
} from "@/lib/scoring/roo-scoring";

import type {
  UserRole,
} from "@/lib/permissions";

type Member = {
  id: string;
  userId: string | null;
  discordUserId: string | null;
  discordUsername: string | null;

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
    | "ADMIN"
    | "MANAGER"
    | "OFFICER"
    | "MEMBER"
    | "LEADER"
    | "COUNCIL";

  remarks: string | null;

  leaveDates: {
    id: string;
    date: string;
    reason: string | null;
  }[];
};

type MemberForm = {
  discordUserId: string;
  discordUsername: string;

  characterName: string;
  job: string;

  active: boolean;
  eligible: boolean;

  priority:
    | "ADMIN"
    | "MANAGER"
    | "OFFICER"
    | "MEMBER"
    | "LEADER"
    | "COUNCIL";

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

const AVAILABLE_JOBS = [
  "Lord Knight",
  "Paladin",
  "High Priest",
  "Champion",
  "Sniper",
  "Bard",
  "Gypsy",
  "High Wizard",
  "Professor",
  "Assassin Cross",
  "Stalker",
  "Mastersmith",
  "Biochemist (Plant)",
  "Doram (Physical)",
  "Gunslinger",
  "Super Novice",
  "Doram (Magic)",
  "Biochemist (Physical)",
  "Shiranui",
  "Doram (Support)",
] as const;

const MEMBER_DISPLAY_FIELDS = [
  {
    key: "characterName",
    label: "Character",
    group: "Identity & Guild",
  },
  {
    key: "discordUsername",
    label: "Discord",
    group: "Identity & Guild",
  },
  {
    key: "job",
    label: "Job",
    group: "Identity & Guild",
  },
  {
    key: "priority",
    label: "Priority",
    group: "Identity & Guild",
  },
  {
    key: "status",
    label: "Status",
    group: "Identity & Guild",
  },
  {
    key: "eligible",
    label: "Eligible",
    group: "Identity & Guild",
  },
  {
    key: "hp",
    label: "HP",
    group: "Combat",
  },
  {
    key: "patk",
    label: "PATK",
    group: "Combat",
  },
  {
    key: "matk",
    label: "MATK",
    group: "Combat",
  },
  {
    key: "rawPdef",
    label: "Raw PDEF",
    group: "Combat",
  },
  {
    key: "rawMdef",
    label: "Raw MDEF",
    group: "Combat",
  },
  {
    key: "pvpDamageBonus",
    label: "PvP DMG Bonus",
    group: "Combat",
  },
  {
    key: "pvpDamageReduction",
    label: "PvP DMG Reduction",
    group: "Combat",
  },
  {
    key: "pdmgPercent",
    label: "P DMG %",
    group: "Combat",
  },
  {
    key: "mdmgPercent",
    label: "M DMG %",
    group: "Combat",
  },
  {
    key: "pdmgReductionPercent",
    label: "P DMG Reduction %",
    group: "Combat",
  },
  {
    key: "mdmgReductionPercent",
    label: "M DMG Reduction %",
    group: "Combat",
  },
  {
    key: "critRes",
    label: "Crit Resistance",
    group: "Combat",
  },
  {
    key: "ignorePdef",
    label: "Ignore PDEF",
    group: "Combat",
  },
  {
    key: "ignoreMdef",
    label: "Ignore MDEF",
    group: "Combat",
  },
  {
    key: "damageVsSmall",
    label: "Damage vs Small",
    group: "Target / Equipment",
  },
  {
    key: "damageReductionVsSmall",
    label: "Reduction vs Small",
    group: "Target / Equipment",
  },
  {
    key: "damageVsMedium",
    label: "Damage vs Medium",
    group: "Target / Equipment",
  },
  {
    key: "damageReductionVsMedium",
    label: "Reduction vs Medium",
    group: "Target / Equipment",
  },
  {
    key: "damageVsDemiHuman",
    label: "Damage vs Demi-Human",
    group: "Target / Equipment",
  },
  {
    key: "damageReductionVsDemiHuman",
    label: "Reduction vs Demi-Human",
    group: "Target / Equipment",
  },
  {
    key: "damageVsBrute",
    label: "Damage vs Brute",
    group: "Target / Equipment",
  },
  {
    key: "damageReductionVsBrute",
    label: "Reduction vs Brute",
    group: "Target / Equipment",
  },
  {
    key: "equipmentPdefPercent",
    label: "Equipment PDEF %",
    group: "Target / Equipment",
  },
  {
    key: "equipmentMdefPercent",
    label: "Equipment MDEF %",
    group: "Target / Equipment",
  },
] as const;

type MemberDisplayField =
  (typeof MEMBER_DISPLAY_FIELDS)[number]["key"];

const DEFAULT_MEMBER_DISPLAY_FIELDS: MemberDisplayField[] = [
  "characterName",
  "discordUsername",
  "job",
  "priority",
  "status",
  "eligible",
];

const MEMBER_DISPLAY_FIELDS_STORAGE_KEY =
  "rooc.guild.members.displayFields";

const EMPTY_FORM: MemberForm = {
  discordUserId: "",
  discordUsername: "",

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
    case "ADMIN":
      return "Admin";

    case "MANAGER":
      return "Manager";

    case "OFFICER":
      return "Officer";

    case "MEMBER":
      return "Member";

    // Legacy member priorities remain supported because existing
    // database records may still contain these values.
    case "LEADER":
      return "Leader";

    case "COUNCIL":
      return "Council";

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

  const [
    showMemberForm,
    setShowMemberForm,
  ] = useState(false);

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
    sortField,
    setSortField,
  ] = useState<MemberDisplayField>("characterName");

  const [
    sortDirection,
    setSortDirection,
  ] = useState<"asc" | "desc">("asc");

  const [
    displayFields,
    setDisplayFields,
  ] = useState<MemberDisplayField[]>(
    DEFAULT_MEMBER_DISPLAY_FIELDS
  );

  const [
    showFieldPicker,
    setShowFieldPicker,
  ] = useState(false);

  const [
    showImport,
    setShowImport,
  ] = useState(false);

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

  const canViewMembers =
    userRole !== null &&
    hasPermission(
      userRole,
      "members.view"
    );

  const canManageMembers =
    userRole !== null &&
    hasPermission(
      userRole,
      "members.edit"
    );

  const canImportMembers =
    userRole !== null &&
    hasPermission(
      userRole,
      "members.import"
    );

  const canDeleteMembers =
    userRole !== null &&
    hasPermission(
      userRole,
      "members.delete"
    );

  const canManageAnyLeave =
    userRole !== null &&
    hasPermission(
      userRole,
      "leave.manageAny"
    );

  const canManageOwnProfile =
    userRole !== null &&
    hasPermission(
      userRole,
      "profile.editOwn"
    );

  // Only ADMIN, MANAGER and OFFICER may filter or sort the member list.
  // MEMBER users can still view the full list and choose display columns.
  const canFilterMembers =
    userRole === "ADMIN" ||
    userRole === "MANAGER" ||
    userRole === "OFFICER";

  function getSortValue(
    member: Member,
    field: MemberDisplayField
  ): string | number | null {
    switch (field) {
      case "characterName":
        return member.characterName;
      case "discordUsername":
        return member.discordUsername;
      case "job":
        return member.job;
      case "priority":
        return {
          ADMIN: 6,
          MANAGER: 5,
          LEADER: 4,
          COUNCIL: 3,
          OFFICER: 2,
          MEMBER: 1,
        }[member.priority];
      case "status":
        return member.active ? 1 : 0;
      case "eligible":
        return member.eligible ? 1 : 0;
      case "hp":
        return member.hp;
      case "patk":
        return member.patk;
      case "matk":
        return member.matk;
      case "rawPdef":
        return Math.round(
          calculateRawPdef(
            member.pdef,
            member.equipmentPdefPercent
          )
        );
      case "rawMdef":
        return Math.round(
          calculateRawMdef(
            member.mdef,
            member.equipmentMdefPercent
          )
        );
      case "pvpDamageBonus":
        return member.pvpDamageBonus;
      case "pvpDamageReduction":
        return member.pvpDamageReduction;
      case "pdmgPercent":
        return member.pdmgPercent;
      case "mdmgPercent":
        return member.mdmgPercent;
      case "pdmgReductionPercent":
        return member.pdmgReductionPercent;
      case "mdmgReductionPercent":
        return member.mdmgReductionPercent;
      case "critRes":
        return member.critRes;
      case "ignorePdef":
        return member.ignorePdef;
      case "ignoreMdef":
        return member.ignoreMdef;
      case "damageVsSmall":
        return member.damageVsSmall;
      case "damageReductionVsSmall":
        return member.damageReductionVsSmall;
      case "damageVsMedium":
        return member.damageVsMedium;
      case "damageReductionVsMedium":
        return member.damageReductionVsMedium;
      case "damageVsDemiHuman":
        return member.damageVsDemiHuman;
      case "damageReductionVsDemiHuman":
        return member.damageReductionVsDemiHuman;
      case "damageVsBrute":
        return member.damageVsBrute;
      case "damageReductionVsBrute":
        return member.damageReductionVsBrute;
      case "equipmentPdefPercent":
        return member.equipmentPdefPercent;
      case "equipmentMdefPercent":
        return member.equipmentMdefPercent;
      default:
        return null;
    }
  }

  function handleSort(
    field: MemberDisplayField
  ) {
    if (!canFilterMembers) {
      return;
    }

    if (sortField === field) {
      setSortDirection((current) =>
        current === "asc"
          ? "desc"
          : "asc"
      );
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  }

  function getSortIndicator(
    field: MemberDisplayField
  ) {
    if (
      !canFilterMembers ||
      sortField !== field
    ) {
      return "";
    }

    return sortDirection === "asc"
      ? " ↑"
      : " ↓";
  }

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
      canManageOwnProfile &&
      isOwnMember(member)
    );
  }

  function canManageLeave(
    member: Member
  ) {
    if (canManageAnyLeave) {
      return true;
    }

    return (
      userRole !== null &&
      hasPermission(
        userRole,
        "leave.manageOwn"
      ) &&
      isOwnMember(member)
    );
  }

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
    async function initialize() {
      await loadAuth();
      await loadMembers();
    }

    initialize();
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    try {
      const stored =
        window.localStorage.getItem(
          `${MEMBER_DISPLAY_FIELDS_STORAGE_KEY}:${currentUserId}`
        );

      if (!stored) {
        return;
      }

      const parsed: unknown =
        JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        return;
      }

      const validFields =
        parsed.filter(
          (field): field is MemberDisplayField =>
            typeof field === "string" &&
            MEMBER_DISPLAY_FIELDS.some(
              (definition) =>
                definition.key === field
            )
        );

      setDisplayFields(validFields);
    } catch {
      // Keep the defaults if saved preferences are unavailable or invalid.
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    try {
      window.localStorage.setItem(
        `${MEMBER_DISPLAY_FIELDS_STORAGE_KEY}:${currentUserId}`,
        JSON.stringify(displayFields)
      );
    } catch {
      // Display preferences are optional; ignore storage failures.
    }
  }, [currentUserId, displayFields]);

  function hasDisplayField(
    field: MemberDisplayField
  ) {
    return displayFields.includes(field);
  }

  function toggleDisplayField(
    field: MemberDisplayField
  ) {
    setDisplayFields((current) =>
      current.includes(field)
        ? current.filter(
            (value) => value !== field
          )
        : [
            ...current,
            field,
          ]
    );
  }

  function resetDisplayFields() {
    setDisplayFields([
      ...DEFAULT_MEMBER_DISPLAY_FIELDS,
    ]);
  }

  function openNewMember() {
    if (!canManageMembers) {
      return;
    }

    setSelectedMember(null);
    setShowMemberForm(true);

    setForm({
      ...EMPTY_FORM,
    });

    setLeaveDate("");
    setLeaveReason("");
    setError(null);
  }

  function openMember(
    member: Member
  ) {
    if (
      !canEditMember(member)
    ) {
      return;
    }

    setSelectedMember(member);
    setShowMemberForm(true);

    setForm({
      discordUserId:
        member.discordUserId ?? "",

      discordUsername:
        member.discordUsername ?? "",

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

  function closeMember() {
    if (
      saving ||
      deleting ||
      leaveSaving
    ) {
      return;
    }

    setSelectedMember(null);
    setShowMemberForm(false);

    setForm({
      ...EMPTY_FORM,
    });

    setLeaveDate("");
    setLeaveReason("");
    setError(null);
  }

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

        discordUserId:
          form.discordUserId.trim(),

        discordUsername:
          form.discordUsername.trim(),

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
          selectedMember.characterName
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

      const filtered =
        members.filter(
          (member) => {
            if (!canFilterMembers) {
              return true;
            }

            const matchesSearch =
              !query ||
              [
                member.characterName,
                member.discordUsername,
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
                      .includes(query)
                );

            const matchesJob =
              jobFilter === "ALL" ||
              member.job === jobFilter;

            const matchesStatus =
              statusFilter === "ALL" ||
              (statusFilter === "ACTIVE" &&
                member.active) ||
              (statusFilter === "INACTIVE" &&
                !member.active);

            return (
              matchesSearch &&
              matchesJob &&
              matchesStatus
            );
          }
        );

      if (!canFilterMembers) {
        return filtered;
      }

      return filtered
        .map((member, index) => ({
          member,
          index,
          value: getSortValue(
            member,
            sortField
          ),
        }))
        .sort((a, b) => {
          const aValue = a.value;
          const bValue = b.value;

          if (
            aValue === null ||
            aValue === undefined
          ) {
            return bValue === null ||
              bValue === undefined
              ? a.index - b.index
              : 1;
          }

          if (
            bValue === null ||
            bValue === undefined
          ) {
            return -1;
          }

          let comparison: number;

          if (
            typeof aValue === "number" &&
            typeof bValue === "number"
          ) {
            comparison =
              aValue - bValue;
          } else {
            comparison =
              String(aValue)
                .toLowerCase()
                .localeCompare(
                  String(bValue).toLowerCase(),
                  undefined,
                  {
                    numeric: true,
                    sensitivity: "base",
                  }
                );
          }

          if (comparison === 0) {
            return a.index - b.index;
          }

          return sortDirection === "asc"
            ? comparison
            : -comparison;
        })
        .map(({ member }) => member);
    }, [
      members,
      search,
      jobFilter,
      statusFilter,
      canFilterMembers,
      sortField,
      sortDirection,
    ]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
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

        {error && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {canFilterMembers ? (
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
        ) : (
          <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-500">
            Member filtering and sorting are available to Admin, Manager and Officer roles.
          </div>
        )}

        <div className="relative mb-6 flex justify-end">
          <button
            type="button"
            onClick={() =>
              setShowFieldPicker(
                (current) => !current
              )
            }
            aria-expanded={
              showFieldPicker
            }
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            Choose Fields
            <span className="ml-2 text-xs text-zinc-500">
              {displayFields.length}
            </span>
          </button>

          {showFieldPicker && (
            <div className="absolute right-0 top-full z-30 mt-2 w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-200">
                    Display Fields
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Choose which member information appears in the table.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetDisplayFields}
                  className="text-xs text-zinc-500 transition hover:text-zinc-200"
                >
                  Reset
                </button>
              </div>

              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {[
                  "Identity & Guild",
                  "Combat",
                  "Target / Equipment",
                ].map((group) => (
                  <div key={group}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {group}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {MEMBER_DISPLAY_FIELDS
                        .filter(
                          (field) =>
                            field.group === group
                        )
                        .map((field) => (
                          <label
                            key={field.key}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
                          >
                            <input
                              type="checkbox"
                              checked={hasDisplayField(
                                field.key
                              )}
                              onChange={() =>
                                toggleDisplayField(
                                  field.key
                                )
                              }
                              className="h-4 w-4 rounded border-zinc-600 bg-zinc-950"
                            />
                            {field.label}
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-600">
                Your selection is saved on this device.
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900">
              <tr>
                {hasDisplayField("characterName") && (
                  <th className="px-4 py-3 text-left font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("characterName")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Character{getSortIndicator("characterName")}
                    </button>
                  </th>
                )}

                {hasDisplayField("discordUsername") && (
                  <th className="px-4 py-3 text-left font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("discordUsername")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Discord{getSortIndicator("discordUsername")}
                    </button>
                  </th>
                )}

                {hasDisplayField("job") && (
                  <th className="px-4 py-3 text-left font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("job")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Job{getSortIndicator("job")}
                    </button>
                  </th>
                )}

                {hasDisplayField("priority") && (
                  <th className="px-4 py-3 text-left font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("priority")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Priority{getSortIndicator("priority")}
                    </button>
                  </th>
                )}

                {hasDisplayField("status") && (
                  <th className="px-4 py-3 text-left font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("status")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Status{getSortIndicator("status")}
                    </button>
                  </th>
                )}

                {hasDisplayField("eligible") && (
                  <th className="px-4 py-3 text-left font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("eligible")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Eligible{getSortIndicator("eligible")}
                    </button>
                  </th>
                )}

                {hasDisplayField("hp") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("hp")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      HP{getSortIndicator("hp")}
                    </button>
                  </th>
                )}

                {hasDisplayField("patk") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("patk")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      PATK{getSortIndicator("patk")}
                    </button>
                  </th>
                )}

                {hasDisplayField("matk") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("matk")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      MATK{getSortIndicator("matk")}
                    </button>
                  </th>
                )}

                {hasDisplayField("rawPdef") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("rawPdef")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Raw PDEF{getSortIndicator("rawPdef")}
                    </button>
                  </th>
                )}

                {hasDisplayField("rawMdef") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("rawMdef")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Raw MDEF{getSortIndicator("rawMdef")}
                    </button>
                  </th>
                )}

                {hasDisplayField("pvpDamageBonus") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("pvpDamageBonus")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      PvP DMG Bonus{getSortIndicator("pvpDamageBonus")}
                    </button>
                  </th>
                )}

                {hasDisplayField("pvpDamageReduction") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("pvpDamageReduction")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      PvP DMG Reduction{getSortIndicator("pvpDamageReduction")}
                    </button>
                  </th>
                )}

                {hasDisplayField("pdmgPercent") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("pdmgPercent")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      P DMG %{getSortIndicator("pdmgPercent")}
                    </button>
                  </th>
                )}

                {hasDisplayField("mdmgPercent") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("mdmgPercent")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      M DMG %{getSortIndicator("mdmgPercent")}
                    </button>
                  </th>
                )}

                {hasDisplayField("pdmgReductionPercent") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("pdmgReductionPercent")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      P DMG Reduction %{getSortIndicator("pdmgReductionPercent")}
                    </button>
                  </th>
                )}

                {hasDisplayField("mdmgReductionPercent") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("mdmgReductionPercent")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      M DMG Reduction %{getSortIndicator("mdmgReductionPercent")}
                    </button>
                  </th>
                )}

                {hasDisplayField("critRes") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("critRes")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Crit Res{getSortIndicator("critRes")}
                    </button>
                  </th>
                )}

                {hasDisplayField("ignorePdef") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("ignorePdef")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Ignore PDEF{getSortIndicator("ignorePdef")}
                    </button>
                  </th>
                )}

                {hasDisplayField("ignoreMdef") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("ignoreMdef")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Ignore MDEF{getSortIndicator("ignoreMdef")}
                    </button>
                  </th>
                )}

                {hasDisplayField("damageVsSmall") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("damageVsSmall")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      DMG vs Small{getSortIndicator("damageVsSmall")}
                    </button>
                  </th>
                )}

                {hasDisplayField("damageReductionVsSmall") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("damageReductionVsSmall")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Reduction vs Small{getSortIndicator("damageReductionVsSmall")}
                    </button>
                  </th>
                )}

                {hasDisplayField("damageVsMedium") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("damageVsMedium")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      DMG vs Medium{getSortIndicator("damageVsMedium")}
                    </button>
                  </th>
                )}

                {hasDisplayField("damageReductionVsMedium") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("damageReductionVsMedium")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Reduction vs Medium{getSortIndicator("damageReductionVsMedium")}
                    </button>
                  </th>
                )}

                {hasDisplayField("damageVsDemiHuman") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("damageVsDemiHuman")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      DMG vs Demi-Human{getSortIndicator("damageVsDemiHuman")}
                    </button>
                  </th>
                )}

                {hasDisplayField("damageReductionVsDemiHuman") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("damageReductionVsDemiHuman")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Reduction vs Demi-Human{getSortIndicator("damageReductionVsDemiHuman")}
                    </button>
                  </th>
                )}

                {hasDisplayField("damageVsBrute") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("damageVsBrute")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      DMG vs Brute{getSortIndicator("damageVsBrute")}
                    </button>
                  </th>
                )}

                {hasDisplayField("damageReductionVsBrute") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("damageReductionVsBrute")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Reduction vs Brute{getSortIndicator("damageReductionVsBrute")}
                    </button>
                  </th>
                )}

                {hasDisplayField("equipmentPdefPercent") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("equipmentPdefPercent")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Equipment PDEF %{getSortIndicator("equipmentPdefPercent")}
                    </button>
                  </th>
                )}

                {hasDisplayField("equipmentMdefPercent") && (
                  <th className="px-4 py-3 text-right font-medium text-zinc-400">
                    <button
                      type="button"
                      onClick={() =>
                        handleSort("equipmentMdefPercent")
                      }
                      disabled={!canFilterMembers}
                      className="text-inherit transition hover:text-white disabled:cursor-default"
                    >
                      Equipment MDEF %{getSortIndicator("equipmentMdefPercent")}
                    </button>
                  </th>
                )}

                <th className="px-4 py-3 text-right font-medium text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={displayFields.length + 1}
                    className="px-4 py-10 text-center text-sm text-zinc-500"
                  >
                    Loading members...
                  </td>
                </tr>
              ) : filteredMembers.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={displayFields.length + 1}
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
                      {hasDisplayField("characterName") && (
                        <td className="px-4 py-3">
                          <Link
                            href={`/guild/members/${member.id}`}
                            className="font-medium text-zinc-100 hover:text-white hover:underline"
                          >
                            {member.characterName}
                          </Link>
                        </td>
                      )}

                      {hasDisplayField("discordUsername") && (
                        <td className="px-4 py-3 text-zinc-400">
                          {member.discordUsername ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("job") && (
                        <td className="px-4 py-3 text-zinc-300">
                          {member.job ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("priority") && (
                        <td className="px-4 py-3 text-zinc-300">
                          {formatPriority(member.priority)}
                        </td>
                      )}

                      {hasDisplayField("status") && (
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
                      )}

                      {hasDisplayField("eligible") && (
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
                      )}

                      {hasDisplayField("hp") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.hp ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("patk") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.patk ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("matk") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.matk ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("rawPdef") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {Math.round(
                            calculateRawPdef(
                              member.pdef,
                              member.equipmentPdefPercent
                            )
                          )}
                        </td>
                      )}

                      {hasDisplayField("rawMdef") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {Math.round(
                            calculateRawMdef(
                              member.mdef,
                              member.equipmentMdefPercent
                            )
                          )}
                        </td>
                      )}

                      {hasDisplayField("pvpDamageBonus") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.pvpDamageBonus ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("pvpDamageReduction") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.pvpDamageReduction ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("pdmgPercent") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.pdmgPercent ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("mdmgPercent") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.mdmgPercent ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("pdmgReductionPercent") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.pdmgReductionPercent ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("mdmgReductionPercent") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.mdmgReductionPercent ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("critRes") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.critRes ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("ignorePdef") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.ignorePdef ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("ignoreMdef") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.ignoreMdef ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("damageVsSmall") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.damageVsSmall ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("damageReductionVsSmall") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.damageReductionVsSmall ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("damageVsMedium") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.damageVsMedium ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("damageReductionVsMedium") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.damageReductionVsMedium ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("damageVsDemiHuman") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.damageVsDemiHuman ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("damageReductionVsDemiHuman") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.damageReductionVsDemiHuman ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("damageVsBrute") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.damageVsBrute ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("damageReductionVsBrute") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.damageReductionVsBrute ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("equipmentPdefPercent") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.equipmentPdefPercent ?? "—"}
                        </td>
                      )}

                      {hasDisplayField("equipmentMdefPercent") && (
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {member.equipmentMdefPercent ?? "—"}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        {canEditMember(member) ? (
                          <button
                            type="button"
                            onClick={() =>
                              openMember(member)
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

        {showMemberForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
            <div className="mx-auto my-8 max-w-5xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedMember
                      ? "Edit Member"
                      : "Add Member"}
                  </h2>

          {userRole === "MEMBER" &&
            selectedMember &&
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

              <div className="max-h-[75vh] overflow-y-auto p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <section>
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                      Basic Information
                    </h3>

                    <div className="space-y-4">
                      {canManageMembers && (
                        <>
                          <div>
                            <label className="mb-1 block text-sm text-zinc-400">
                              Discord User ID
                            </label>

                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                form.discordUserId
                              }
                              onChange={(event) =>
                                setField(
                                  "discordUserId",
                                  event.target.value
                                )
                              }
                              placeholder="123456789012345678"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            />

                            <p className="mt-1 text-xs text-zinc-600">
                              The numeric Discord User ID. Keep this as text.
                            </p>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm text-zinc-400">
                              Discord Username
                            </label>

                            <input
                              type="text"
                              value={
                                form.discordUsername
                              }
                              onChange={(event) =>
                                setField(
                                  "discordUsername",
                                  event.target.value
                                )
                              }
                              placeholder="jigsaw0226"
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                            />

                            <p className="mt-1 text-xs text-zinc-600">
                              The current Discord username associated with the account.
                            </p>
                          </div>
                        </>
                      )}

                      <div>
                        <label className="mb-1 block text-sm text-zinc-400">
                          Character Name
                        </label>

                        <input
                          type="text"
                          value={
                            form.characterName
                          }
                          onChange={(event) =>
                            setField(
                              "characterName",
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-zinc-400">
                          Job
                        </label>

                        <select
                          value={form.job}
                          onChange={(event) =>
                            setField("job", event.target.value)
                          }
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                        >
                          <option value="">Select a job</option>
                          {AVAILABLE_JOBS.map((job) => (
                            <option key={job} value={job}>
                              {job}
                            </option>
                          ))}
                        </select>
                      </div>

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
                              onChange={(event) =>
                                setField(
                                  "priority",
                                  event.target.value as MemberForm["priority"]
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

                              <option value="MANAGER">
                                Manager
                              </option>

                              <option value="ADMIN">
                                Admin
                              </option>

                              <option value="COUNCIL">
                                Council (legacy)
                              </option>

                              <option value="LEADER">
                                Leader (legacy)
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
                                onChange={(event) =>
                                  setField(
                                    "active",
                                    event.target.checked
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
                                onChange={(event) =>
                                  setField(
                                    "eligible",
                                    event.target.checked
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
                              onChange={(event) =>
                                setField(
                                  "remarks",
                                  event.target.value
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

                  <section>
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                      Combat Stats
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["PDEF", "pdef"],
                        ["MDEF", "mdef"],
                        ["PATK", "patk"],
                        ["MATK", "matk"],
                        ["HP", "hp"],
                        ["Crit Res", "critRes"],
                        ["Ignore PDEF", "ignorePdef"],
                        ["Ignore MDEF", "ignoreMdef"],
                        ["PvP DMG Bonus", "pvpDamageBonus"],
                        ["PvP DMG Reduction", "pvpDamageReduction"],
                        ["P DMG %", "pdmgPercent"],
                        ["M DMG %", "mdmgPercent"],
                        ["P DMG Reduction %", "pdmgReductionPercent"],
                        ["M DMG Reduction %", "mdmgReductionPercent"],
                        ["DMG vs Small", "damageVsSmall"],
                        ["Reduction vs Small", "damageReductionVsSmall"],
                        ["DMG vs Medium", "damageVsMedium"],
                        ["Reduction vs Medium", "damageReductionVsMedium"],
                        ["DMG vs Demi-Human", "damageVsDemiHuman"],
                        ["Reduction vs Demi-Human", "damageReductionVsDemiHuman"],
                        ["DMG vs Brute", "damageVsBrute"],
                        ["Reduction vs Brute", "damageReductionVsBrute"],
                        ["Equipment PDEF %", "equipmentPdefPercent"],
                        ["Equipment MDEF %", "equipmentMdefPercent"],
                      ].map(
                        ([label, field]) => (
                          <div
                            key={field}
                          >
                            <label className="mb-1 block text-xs text-zinc-500">
                              {label}
                            </label>

                            <input
                              type="number"
                              step="any"
                              value={
                                form[
                                  field as keyof MemberForm
                                ] as string
                              }
                              onChange={(event) =>
                                setField(
                                  field as keyof MemberForm,
                                  event.target.value as never
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
              {selectedMember && (
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
                          onChange={(event) =>
                            setLeaveDate(
                              event.target.value
                            )
                          }
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
                        />

                        <input
                          type="text"
                          value={
                            leaveReason
                          }
                          onChange={(event) =>
                            setLeaveReason(
                              event.target.value
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
                )}
              </div>

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
