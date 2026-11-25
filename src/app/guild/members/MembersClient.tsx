"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import ImportMembersModal from "./ImportMembersModal";
import ManagementPageHeader from "@/app/ManagementPageHeader";
import { jobsForGame } from "@/lib/constants/jobs";
import { RO3_STAT_FIELDS, RO3_STAT_LABELS } from "@/lib/constants/ro3-stats";

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
  updatedAt: string;
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
  pdmgReductionPercent: number | null;
  mdmgReductionPercent: number | null;
  critRes: number | null;
  ignorePdef: number | null;
  ignoreMdef: number | null;
  damageVsMedium: number | null;
  damageReductionVsMedium: number | null;
  damageVsSmall: number | null;
  damageReductionVsSmall: number | null;
  damageVsDemiHuman: number | null;
  damageReductionVsDemiHuman: number | null;
  damageVsBrute: number | null;
  damageReductionVsBrute: number | null;
  equipmentPdefPercent: number | null;
  equipmentMdefPercent: number | null;
  patk: number | null;
  matk: number | null;
  hp: number | null;
  active: boolean;
  eligible: boolean;
  priority: "ADMIN" | "MANAGER" | "OFFICER" | "MEMBER" | "LEADER" | "COUNCIL";
  remarks: string | null;
  ro3Stats?: Record<string, number | null> | null;
  leaveDates?: { id: string; date: string; reason: string | null }[];
};

type MemberForm = {
  discordUserId: string;
  discordUsername: string;
  characterName: string;
  job: string;
  active: boolean;
  eligible: boolean;
  priority: "ADMIN" | "MANAGER" | "OFFICER" | "MEMBER" | "LEADER" | "COUNCIL";
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
  ro3Stats: Record<string, string>;
};

const RO3_FIELDS = RO3_STAT_FIELDS.map(({ key }) => key);
const RO3_LABELS: Record<string, string> = RO3_STAT_LABELS as Record<string, string>;

const MEMBER_DISPLAY_FIELDS = [
  { key: "characterName", label: "Character", group: "Identity & Guild" },
  { key: "discordUsername", label: "Discord", group: "Identity & Guild" },
  { key: "job", label: "Job", group: "Identity & Guild" },
  { key: "priority", label: "Priority", group: "Identity & Guild" },
  { key: "status", label: "Status", group: "Identity & Guild" },
  { key: "eligible", label: "Eligible", group: "Identity & Guild" },
  { key: "updatedAt", label: "Last Update", group: "Identity & Guild" },
  { key: "hp", label: "HP", group: "Combat" },
  { key: "patk", label: "PATK", group: "Combat" },
  { key: "matk", label: "MATK", group: "Combat" },
  { key: "rawPdef", label: "Raw PDEF", group: "Combat" },
  { key: "rawMdef", label: "Raw MDEF", group: "Combat" },
  { key: "pvpDamageBonus", label: "PvP DMG Bonus", group: "Combat" },
  { key: "pvpDamageReduction", label: "PvP DMG Reduction", group: "Combat" },
  { key: "pdmgPercent", label: "P DMG %", group: "Combat" },
  { key: "mdmgPercent", label: "M DMG %", group: "Combat" },
  { key: "pdmgReductionPercent", label: "P DMG Reduction %", group: "Combat" },
  { key: "mdmgReductionPercent", label: "M DMG Reduction %", group: "Combat" },
  { key: "critRes", label: "Crit Resistance", group: "Combat" },
  { key: "ignorePdef", label: "Ignore PDEF", group: "Combat" },
  { key: "ignoreMdef", label: "Ignore MDEF", group: "Combat" },
  { key: "damageVsSmall", label: "Damage vs Small", group: "Target / Equipment" },
  { key: "damageReductionVsSmall", label: "Reduction vs Small", group: "Target / Equipment" },
  { key: "damageVsMedium", label: "Damage vs Medium", group: "Target / Equipment" },
  { key: "damageReductionVsMedium", label: "Reduction vs Medium", group: "Target / Equipment" },
  { key: "damageVsDemiHuman", label: "Damage vs Demi-Human", group: "Target / Equipment" },
  { key: "damageReductionVsDemiHuman", label: "Reduction vs Demi-Human", group: "Target / Equipment" },
  { key: "damageVsBrute", label: "Damage vs Brute", group: "Target / Equipment" },
  { key: "damageReductionVsBrute", label: "Reduction vs Brute", group: "Target / Equipment" },
  { key: "equipmentPdefPercent", label: "Equipment PDEF %", group: "Target / Equipment" },
  { key: "equipmentMdefPercent", label: "Equipment MDEF %", group: "Target / Equipment" },
  { key: "ro3_hp", label: "HP", group: "RO3 Stats" },
  { key: "ro3_patk", label: "PATK", group: "RO3 Stats" },
  { key: "ro3_matk", label: "MATK", group: "RO3 Stats" },
  { key: "ro3_pdef", label: "PDEF", group: "RO3 Stats" },
  { key: "ro3_mdef", label: "MDEF", group: "RO3 Stats" },
  { key: "ro3_healingDonePercent", label: "Healing Done %", group: "RO3 Stats" },
  { key: "ro3_critDamagePercent", label: "Crit Damage %", group: "RO3 Stats" },
  { key: "ro3_critDamageReductionPercent", label: "Crit Damage Reduction %", group: "RO3 Stats" },
  { key: "ro3_physicalDamageBonusPercent", label: "Physical Damage Bonus %", group: "RO3 Stats" },
  { key: "ro3_physicalDamageReductionPercent", label: "Physical Damage Reduction %", group: "RO3 Stats" },
  { key: "ro3_magicDamageBonusPercent", label: "Magic Damage Bonus %", group: "RO3 Stats" },
  { key: "ro3_magicDamageReductionPercent", label: "Magic Damage Reduction %", group: "RO3 Stats" },
  { key: "ro3_damageIncreasePercent", label: "Damage Increase %", group: "RO3 Stats" },
  { key: "ro3_damageReductionPercent", label: "Damage Reduction %", group: "RO3 Stats" },
  { key: "ro3_physicalPenetrationPercent", label: "Physical Penetration %", group: "RO3 Stats" },
  { key: "ro3_magicPenetrationPercent", label: "Magic Penetration %", group: "RO3 Stats" },
  { key: "ro3_damageVsAllJob", label: "DMG vs All Job", group: "RO3 Stats" },
  { key: "ro3_damageReductionVsAllJob", label: "DMG Reduction vs All Job", group: "RO3 Stats" },
  { key: "ro3_damageVsMedium", label: "DMG vs Medium", group: "RO3 Stats" },
  { key: "ro3_damageReductionVsMedium", label: "DMG Reduction vs Medium", group: "RO3 Stats" },
  { key: "ro3_damageVsDemiHuman", label: "Damage vs Demi-Human", group: "RO3 Stats" },
  { key: "ro3_damageReductionVsDemiHuman", label: "Damage Reduction vs Demi-Human", group: "RO3 Stats" },
  { key: "ro3_bladeCrystal", label: "Blade Crystal", group: "RO3 Stats" },
  { key: "ro3_shieldCrystal", label: "Shield Crystal", group: "RO3 Stats" },
  { key: "ro3_manaCrystal", label: "Mana Crystal", group: "RO3 Stats" },
  { key: "ro3_magicDefCrystal", label: "Magic DEF Crystal", group: "RO3 Stats" },
] as const;
type MemberDisplayField = (typeof MEMBER_DISPLAY_FIELDS)[number]["key"];
const DEFAULT_MEMBER_DISPLAY_FIELDS: MemberDisplayField[] = ["characterName", "discordUsername", "job", "priority", "status", "eligible", "updatedAt"];
const MEMBER_DISPLAY_FIELDS_STORAGE_KEY = "rooc.guild.members.displayFields";
const EMPTY_FORM: MemberForm = {
  discordUserId: "", discordUsername: "", characterName: "", job: "", active: true, eligible: true,
  priority: "MEMBER", remarks: "", pdef: "", mdef: "", pvpDamageBonus: "", pvpDamageReduction: "", ro3Stats: Object.fromEntries(RO3_FIELDS.map(key => [key, ""])),
  pdmgPercent: "", mdmgPercent: "", pdmgReductionPercent: "", mdmgReductionPercent: "", critRes: "", ignorePdef: "", ignoreMdef: "",
  damageVsMedium: "", damageReductionVsMedium: "", damageVsSmall: "", damageReductionVsSmall: "", damageVsDemiHuman: "", damageReductionVsDemiHuman: "",
  damageVsBrute: "", damageReductionVsBrute: "", equipmentPdefPercent: "", equipmentMdefPercent: "", patk: "", matk: "", hp: "",
};
function toInputValue(value: number | null): string { return value === null || value === undefined ? "" : String(value); }
function parseNumber(value: string): number | null { if (!value.trim()) return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function formatPriority(priority: Member["priority"]) {
  switch (priority) {
    case "ADMIN": return "Admin";
    case "MANAGER": return "Manager";
    case "OFFICER": return "Officer";
    case "MEMBER": return "Member";
    case "LEADER": return "Leader";
    case "COUNCIL": return "Council";
    default: return priority;
  }
}

export default function MembersClient({ initialMembers, gameType }: { initialMembers: Member[]; gameType: "ROOC" | "RO3" }) {
  const availableJobs = jobsForGame(gameType);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total: initialMembers.length, active: initialMembers.filter(member => member.active).length, inactive: 0, eligible: initialMembers.filter(member => member.active && member.eligible).length, linked: initialMembers.filter(member => Boolean(member.userId || member.discordUserId)).length, unlinked: 0 });
  const [jobs, setJobs] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalFiltered, setTotalFiltered] = useState(initialMembers.length);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentDiscordId, setCurrentDiscordId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [leaveDates, setLeaveDates] = useState<NonNullable<Member["leaveDates"]>>([]);
  const [leaveDatesLoading, setLeaveDatesLoading] = useState(false);
  const [leaveDatesError, setLeaveDatesError] = useState<string | null>(null);
  const [leaveDatesReload, setLeaveDatesReload] = useState(0);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [form, setForm] = useState<MemberForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<MemberDisplayField>("characterName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [displayFields, setDisplayFields] = useState<MemberDisplayField[]>(gameType === "RO3" ? [...DEFAULT_MEMBER_DISPLAY_FIELDS, "ro3_hp", "ro3_patk", "ro3_matk", "ro3_pdef", "ro3_mdef", "ro3_damageVsMedium", "ro3_damageReductionVsMedium", "ro3_damageVsDemiHuman", "ro3_damageReductionVsDemiHuman"] : DEFAULT_MEMBER_DISPLAY_FIELDS);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);
  const canManageMembers = userRole !== null && hasPermission(userRole, "members.edit");
  const canImportMembers = userRole !== null && hasPermission(userRole, "members.import");
  const canDeleteMembers = userRole !== null && hasPermission(userRole, "members.delete");
  const canManageAnyLeave = userRole !== null && hasPermission(userRole, "leave.manageAny");
  const canManageOwnProfile = userRole !== null && hasPermission(userRole, "profile.editOwn");
  const canFilterMembers = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "OFFICER";
  function handleSort(field: MemberDisplayField) { if (!canFilterMembers) return; if (sortField === field) setSortDirection(current => current === "asc" ? "desc" : "asc"); else { setSortField(field); setSortDirection("asc"); } setPage(1); }
  function getSortIndicator(field: MemberDisplayField) { if (!canFilterMembers || sortField !== field) return ""; return sortDirection === "asc" ? " ↑" : " ↓"; }
  function isOwnMember(member: Member) { return (currentUserId !== null && member.userId === currentUserId) || (currentDiscordId !== null && member.discordUserId === currentDiscordId); }
  function canEditMember(member: Member) { return canManageMembers || (canManageOwnProfile && isOwnMember(member)); }
  function canManageLeave(member: Member) { return canManageAnyLeave || (userRole !== null && hasPermission(userRole, "leave.manageOwn") && isOwnMember(member)); }
  const loadAuth = useCallback(async () => { try { const response = await fetch("/api/auth/me", { cache: "no-store" }); const data = await response.json(); if (!response.ok) { setCurrentUserId(null); setCurrentDiscordId(null); setUserRole(null); return; } setCurrentUserId(data.user?.id ?? null); setCurrentDiscordId(data.user?.discordId ?? null); setUserRole(data.role ?? null); } catch { setCurrentUserId(null); setCurrentDiscordId(null); setUserRole(null); } }, []);
  const loadMembers = useCallback(async (targetPage: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(targetPage),
        q: search,
        job: jobFilter,
        status: statusFilter,
        sortBy: sortField,
        sortDirection,
      });
      const response = await fetch(`/api/guild/members?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load members.");
      setMembers(data.members ?? []);
      setJobs(data.jobs ?? []);
      setSummary(data.summary ?? { total: 0, active: 0, inactive: 0, eligible: 0, linked: 0, unlinked: 0 });
      setPage(data.pagination?.page ?? targetPage);
      setPageSize(data.pagination?.pageSize ?? 50);
      setTotalFiltered(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, [search, jobFilter, statusFilter, sortField, sortDirection]);
  useEffect(() => { void loadAuth(); }, [loadAuth]);
  useEffect(() => {
    if (!showMemberForm || !selectedMember) { setLeaveDates([]); setLeaveDatesLoading(false); setLeaveDatesError(null); return; }
    const controller = new AbortController();
    let active = true;
    setLeaveDates([]);
    setLeaveDatesLoading(true);
    setLeaveDatesError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/guild/members/leave?memberId=${encodeURIComponent(selectedMember.id)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load unavailable dates.");
        if (active) setLeaveDates(data.leaveDates ?? []);
      } catch (err) {
        if (active && !(err instanceof DOMException && err.name === "AbortError")) setLeaveDatesError(err instanceof Error ? err.message : "Failed to load unavailable dates.");
      } finally { if (active) setLeaveDatesLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [showMemberForm, selectedMember?.id, leaveDatesReload]);
  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadMembers(page); }, 250);
    return () => window.clearTimeout(timeout);
  }, [loadMembers, page]);
  useEffect(() => { if (!currentUserId) return; try { const stored = window.localStorage.getItem(`${MEMBER_DISPLAY_FIELDS_STORAGE_KEY}:${currentUserId}`); if (!stored) return; const parsed: unknown = JSON.parse(stored); if (!Array.isArray(parsed)) return; const validFields = parsed.filter((field): field is MemberDisplayField => typeof field === "string" && MEMBER_DISPLAY_FIELDS.some(definition => definition.key === field) && (gameType === "RO3" ? String(field).startsWith("ro3_") || ["characterName", "discordUsername", "job", "priority", "status", "eligible", "updatedAt"].includes(field) : !String(field).startsWith("ro3_"))); setDisplayFields(validFields); } catch {} }, [currentUserId]);
  useEffect(() => { if (!currentUserId) return; try { window.localStorage.setItem(`${MEMBER_DISPLAY_FIELDS_STORAGE_KEY}:${currentUserId}`, JSON.stringify(displayFields)); } catch {} }, [currentUserId, displayFields]);
  function hasDisplayField(field: MemberDisplayField) { const isRo3Field = String(field).startsWith("ro3_"); return (gameType === "RO3" ? isRo3Field || ["characterName", "discordUsername", "job", "priority", "status", "eligible", "updatedAt"].includes(field) : !isRo3Field) && displayFields.includes(field); }
  function toggleDisplayField(field: MemberDisplayField) { setDisplayFields(current => current.includes(field) ? current.filter(value => value !== field) : [...current, field]); }
  function resetDisplayFields() { setDisplayFields([...DEFAULT_MEMBER_DISPLAY_FIELDS, ...(gameType === "RO3" ? RO3_FIELDS.map(key => ("ro3_" + key) as MemberDisplayField).filter(key => ["ro3_hp", "ro3_patk", "ro3_matk", "ro3_pdef", "ro3_mdef", "ro3_damageVsMedium", "ro3_damageReductionVsMedium", "ro3_damageVsDemiHuman", "ro3_damageReductionVsDemiHuman"].includes(key)) : [])]); }
  function applyFieldPreset(preset: "overview" | "roster" | "combat") {
    const identity: MemberDisplayField[] = ["characterName", "discordUsername", "job", "priority", "status", "eligible"];
    const overview: MemberDisplayField[] = [...identity, "updatedAt"];
    const roster: MemberDisplayField[] = ["characterName", "job", "priority", "status", "eligible"];
    const combatRooc: MemberDisplayField[] = ["characterName", "job", "hp", "patk", "matk", "rawPdef", "rawMdef", "pvpDamageBonus", "pvpDamageReduction", "ignorePdef", "ignoreMdef", "damageVsMedium", "damageReductionVsMedium", "damageVsDemiHuman", "damageReductionVsDemiHuman"];
    const combatRo3: MemberDisplayField[] = ["characterName", "job", "ro3_hp", "ro3_patk", "ro3_matk", "ro3_pdef", "ro3_mdef", "ro3_damageVsMedium", "ro3_damageReductionVsMedium", "ro3_damageVsDemiHuman", "ro3_damageReductionVsDemiHuman"];
    setDisplayFields(preset === "overview" ? overview : preset === "roster" ? roster : gameType === "RO3" ? combatRo3 : combatRooc);
  }
  function openNewMember() { if (!canManageMembers) return; setSelectedMember(null); setLeaveDates([]); setShowMemberForm(true); setForm({ ...EMPTY_FORM }); setLeaveDate(""); setLeaveReason(""); setError(null); }
  function openMember(member: Member) { if (!canEditMember(member)) return; setSelectedMember({ ...member, leaveDates: [] }); setShowMemberForm(true); setForm({
    discordUserId: member.discordUserId ?? "", discordUsername: member.discordUsername ?? "", characterName: member.characterName ?? "", job: member.job ?? "",
    active: member.active, eligible: member.eligible, priority: member.priority, remarks: member.remarks ?? "", pdef: toInputValue(member.pdef), mdef: toInputValue(member.mdef),
    pvpDamageBonus: toInputValue(member.pvpDamageBonus), pvpDamageReduction: toInputValue(member.pvpDamageReduction), pdmgPercent: toInputValue(member.pdmgPercent), mdmgPercent: toInputValue(member.mdmgPercent),
    pdmgReductionPercent: toInputValue(member.pdmgReductionPercent), mdmgReductionPercent: toInputValue(member.mdmgReductionPercent), critRes: toInputValue(member.critRes), ignorePdef: toInputValue(member.ignorePdef), ignoreMdef: toInputValue(member.ignoreMdef),
    damageVsMedium: toInputValue(member.damageVsMedium), damageReductionVsMedium: toInputValue(member.damageReductionVsMedium), damageVsSmall: toInputValue(member.damageVsSmall), damageReductionVsSmall: toInputValue(member.damageReductionVsSmall),
    damageVsDemiHuman: toInputValue(member.damageVsDemiHuman), damageReductionVsDemiHuman: toInputValue(member.damageReductionVsDemiHuman), damageVsBrute: toInputValue(member.damageVsBrute), damageReductionVsBrute: toInputValue(member.damageReductionVsBrute),
    equipmentPdefPercent: toInputValue(member.equipmentPdefPercent), equipmentMdefPercent: toInputValue(member.equipmentMdefPercent), patk: toInputValue(member.patk), matk: toInputValue(member.matk), hp: toInputValue(member.hp),
    ro3Stats: Object.fromEntries(RO3_FIELDS.map(key => [key, toInputValue(member.ro3Stats?.[key] ?? null)])),
  }); setLeaveDate(""); setLeaveReason(""); setError(null); }
  function closeMember() { if (saving || deleting || leaveSaving) return; setSelectedMember(null); setLeaveDates([]); setShowMemberForm(false); setForm({ ...EMPTY_FORM }); setLeaveDate(""); setLeaveReason(""); setError(null); }
  function setField<K extends keyof MemberForm>(field: K, value: MemberForm[K]) { setForm(current => ({ ...current, [field]: value })); }
  async function saveMember() {
    if (!canManageMembers && (!selectedMember || !isOwnMember(selectedMember))) { setError("You can only edit your own member profile."); return; }
    try {
      setSaving(true); setError(null);
      const payload = {
        ...(selectedMember ? { id: selectedMember.id } : {}), discordUserId: form.discordUserId.trim(), discordUsername: form.discordUsername.trim(), characterName: form.characterName.trim() || null, job: form.job.trim() || null,
        active: form.active, eligible: form.eligible, priority: form.priority, remarks: form.remarks.trim() || null,
        pdef: parseNumber(form.pdef), mdef: parseNumber(form.mdef), pvpDamageBonus: parseNumber(form.pvpDamageBonus), pvpDamageReduction: parseNumber(form.pvpDamageReduction),
        pdmgPercent: parseNumber(form.pdmgPercent), mdmgPercent: parseNumber(form.mdmgPercent), pdmgReductionPercent: parseNumber(form.pdmgReductionPercent), mdmgReductionPercent: parseNumber(form.mdmgReductionPercent),
        critRes: parseNumber(form.critRes), ignorePdef: parseNumber(form.ignorePdef), ignoreMdef: parseNumber(form.ignoreMdef), damageVsMedium: parseNumber(form.damageVsMedium), damageReductionVsMedium: parseNumber(form.damageReductionVsMedium),
        damageVsSmall: parseNumber(form.damageVsSmall), damageReductionVsSmall: parseNumber(form.damageReductionVsSmall), damageVsDemiHuman: parseNumber(form.damageVsDemiHuman), damageReductionVsDemiHuman: parseNumber(form.damageReductionVsDemiHuman),
        damageVsBrute: parseNumber(form.damageVsBrute), damageReductionVsBrute: parseNumber(form.damageReductionVsBrute), equipmentPdefPercent: parseNumber(form.equipmentPdefPercent), equipmentMdefPercent: parseNumber(form.equipmentMdefPercent),
        patk: parseNumber(form.patk), matk: parseNumber(form.matk), hp: parseNumber(form.hp),
        ...(gameType === "RO3" ? { ro3Stats: Object.fromEntries(RO3_FIELDS.filter(key => form.ro3Stats[key]?.trim() !== "").map(key => [key, parseNumber(form.ro3Stats[key])])) } : {}),
      };
      if (gameType === "RO3") {
        for (const key of ["bladeCrystal", "shieldCrystal", "manaCrystal", "magicDefCrystal"]) {
          const value = parseNumber(form.ro3Stats[key]);
          if (value !== null && (value < 0 || value > 50)) throw new Error(`${RO3_LABELS[key]} must be between 0 and 50.`);
        }
        for (const key of RO3_FIELDS) {
          const value = form.ro3Stats[key]?.trim();
          if (value && parseNumber(value) === null) throw new Error(`${RO3_LABELS[key]} must be a valid number.`);
        }
        for (const key of ["pdef","mdef","pvpDamageBonus","pvpDamageReduction","pdmgPercent","mdmgPercent","pdmgReductionPercent","mdmgReductionPercent","critRes","ignorePdef","ignoreMdef","damageVsMedium","damageReductionVsMedium","damageVsSmall","damageReductionVsSmall","damageVsDemiHuman","damageReductionVsDemiHuman","damageVsBrute","damageReductionVsBrute","equipmentPdefPercent","equipmentMdefPercent","patk","matk","hp"]) delete (payload as Record<string, unknown>)[key];
      }
      if (!payload.characterName) throw new Error("Character name is required.");
      if (!payload.job) throw new Error("Job is required.");
      const response = await fetch("/api/guild/members", { method: selectedMember ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to save member.");
      await loadMembers(); closeMember();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save member."); } finally { setSaving(false); }
  }
  async function deleteMember() { if (!canDeleteMembers || !selectedMember) return; if (!window.confirm(`Delete ${selectedMember.characterName}? This cannot be undone.`)) return; try { setDeleting(true); setError(null); const response = await fetch(`/api/guild/members/${selectedMember.id}`, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to delete member."); await loadMembers(); closeMember(); } catch (err) { setError(err instanceof Error ? err.message : "Failed to delete member."); } finally { setDeleting(false); } }
  async function addLeaveDate() { if (!selectedMember || !leaveDate) return; if (!canManageLeave(selectedMember)) { setError("You can only manage your own unavailable dates."); return; } setLeaveSaving(true); setError(null); try { const response = await fetch("/api/guild/members/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: selectedMember.id, date: leaveDate, reason: leaveReason.trim() || null }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to add unavailable date."); const newLeave = data.leave as NonNullable<Member["leaveDates"]>[number]; const updatedDates = [...leaveDates, newLeave].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); setLeaveDates(updatedDates); setLeaveDate(""); setLeaveReason(""); } catch (err) { setError(err instanceof Error ? err.message : "Failed to add unavailable date."); } finally { setLeaveSaving(false); } }
  async function removeLeaveDate(leaveId: string) { if (!selectedMember) return; if (!canManageLeave(selectedMember)) { setError("You can only manage your own unavailable dates."); return; } if (!window.confirm("Remove this unavailable date?")) return; setLeaveSaving(true); setError(null); try { const response = await fetch(`/api/guild/members/leave?id=${leaveId}`, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to remove unavailable date."); setLeaveDates(current => current.filter(leave => leave.id !== leaveId)); } catch (err) { setError(err instanceof Error ? err.message : "Failed to remove unavailable date."); } finally { setLeaveSaving(false); } }
  const filteredMembers = members;
  const activeCount = summary.active;
  const inactiveCount = summary.inactive;
  const eligibleCount = summary.eligible;
  const linkedCount = summary.linked;

  return (
    <main className="hmdl-management min-h-screen bg-zinc-950 text-zinc-100">
      <div className="hmdl-page">
        <ManagementPageHeader eyebrow="PEOPLE / DIRECTORY" title="Guild Members" description="Search, review and maintain your guild roster." actions={<>{canManageAnyLeave && <Link href="/guild/members/leave/history" className="hmdl-btn hmdl-btn-secondary">Leave History</Link>}{canImportMembers && <button type="button" onClick={() => setShowImport(true)} className="hmdl-btn hmdl-btn-secondary">Import Members</button>}{canManageMembers && <button type="button" onClick={openNewMember} className="hmdl-btn hmdl-btn-primary">＋ Add Member</button>}</>} /><section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Member directory summary"><div className="hmdl-surface p-4"><p className="text-xs font-medium text-zinc-500">Total members</p><p className="mt-2 text-2xl font-semibold tracking-tight">{summary.total}</p><p className="mt-1 text-xs text-zinc-600">Guild roster</p></div><div className="hmdl-surface p-4"><p className="text-xs font-medium text-zinc-500">Active</p><p className="mt-2 text-2xl font-semibold tracking-tight text-emerald-300">{activeCount}</p><p className="mt-1 text-xs text-zinc-600">{inactiveCount} inactive</p></div><div className="hmdl-surface p-4"><p className="text-xs font-medium text-zinc-500">Eligible</p><p className="mt-2 text-2xl font-semibold tracking-tight">{eligibleCount}</p><p className="mt-1 text-xs text-zinc-600">Active and eligible</p></div><div className="hmdl-surface p-4"><p className="text-xs font-medium text-zinc-500">Account linked</p><p className="mt-2 text-2xl font-semibold tracking-tight">{linkedCount}</p><p className="mt-1 text-xs text-zinc-600">{summary.unlinked} not linked</p></div></section>
        {!showMemberForm && error && <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}
        {canFilterMembers ? <div className="hmdl-member-filter-toolbar mb-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 md:grid-cols-[minmax(240px,1fr)_180px_180px]"><input type="search" aria-label="Search guild members" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search members..." className="hmdl-member-filter-control rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"/><select aria-label="Filter members by job" value={jobFilter} onChange={event => { setJobFilter(event.target.value); setPage(1); }} className="hmdl-member-filter-control rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none"><option value="ALL">All Jobs</option>{jobs.map(job => <option key={job} value={job}>{job}</option>)}</select><select aria-label="Filter members by status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className="hmdl-member-filter-control rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none"><option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div> : <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-500">Member filtering and sorting are available to Admin, Manager and Officer roles.</div>}
        <div className="relative mb-6 flex justify-end"><button type="button" onClick={() => setShowFieldPicker(current => !current)} aria-expanded={showFieldPicker} className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white">Choose Fields<span className="ml-2 text-xs text-zinc-500">{displayFields.length}</span></button>{showFieldPicker && <div className="absolute right-0 top-full z-30 mt-2 w-[min(92vw,420px)] rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"><div className="mb-3"><h2 className="text-sm font-semibold text-zinc-200">Display Fields</h2><p className="mt-1 text-xs text-zinc-500">Choose which member information appears in the table.</p></div><div className="mb-3 flex flex-wrap gap-2" aria-label="Column presets"><button type="button" onClick={() => applyFieldPreset("overview")} className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500">Overview</button><button type="button" onClick={() => applyFieldPreset("roster")} className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500">Roster</button><button type="button" onClick={() => applyFieldPreset("combat")} className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500">Combat</button><button type="button" onClick={resetDisplayFields} className="ml-auto text-xs text-zinc-500 transition hover:text-zinc-200">Reset</button></div><div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">{["Identity & Guild", "Combat", "Target / Equipment", "RO3 Stats"].filter(group => gameType === "RO3" ? group === "Identity & Guild" || group === "RO3 Stats" : group !== "RO3 Stats").map(group => <details key={group} open={group === "Identity & Guild"} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"><summary className="cursor-pointer list-none py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 marker:hidden">{group}<span className="float-right text-zinc-600">Show / hide</span></summary><div className="grid grid-cols-2 gap-2 pt-2">{MEMBER_DISPLAY_FIELDS.filter(field => field.group === group).map(field => <label key={field.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"><input type="checkbox" checked={hasDisplayField(field.key)} onChange={() => toggleDisplayField(field.key)} className="h-4 w-4 rounded border-zinc-600 bg-zinc-950"/>{field.label}</label>)}</div></details>)}</div><div className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-600">Your selection is saved on this device.</div></div>}</div>
        <div className="hmdl-table-wrap overflow-x-auto"><table className="hmdl-table w-full min-w-[900px] text-sm"><thead className="border-b border-zinc-800 bg-zinc-900"><tr>{hasDisplayField("characterName") && <th className="px-4 py-3 text-left font-medium text-zinc-400"><button type="button" onClick={() => handleSort("characterName")} disabled={!canFilterMembers} className="text-inherit transition hover:text-white disabled:cursor-default">Character{getSortIndicator("characterName")}</button></th>}{hasDisplayField("discordUsername") && <th className="px-4 py-3 text-left font-medium text-zinc-400"><button type="button" onClick={() => handleSort("discordUsername")} disabled={!canFilterMembers} className="text-inherit transition hover:text-white disabled:cursor-default">Discord{getSortIndicator("discordUsername")}</button></th>}{hasDisplayField("job") && <th className="px-4 py-3 text-left font-medium text-zinc-400"><button type="button" onClick={() => handleSort("job")} disabled={!canFilterMembers} className="text-inherit transition hover:text-white disabled:cursor-default">Job{getSortIndicator("job")}</button></th>}{hasDisplayField("priority") && <th className="px-4 py-3 text-left font-medium text-zinc-400"><button type="button" onClick={() => handleSort("priority")} disabled={!canFilterMembers} className="text-inherit transition hover:text-white disabled:cursor-default">Priority{getSortIndicator("priority")}</button></th>}{hasDisplayField("status") && <th className="px-4 py-3 text-left font-medium text-zinc-400"><button type="button" onClick={() => handleSort("status")} disabled={!canFilterMembers} className="text-inherit transition hover:text-white disabled:cursor-default">Status{getSortIndicator("status")}</button></th>}{hasDisplayField("eligible") && <th className="px-4 py-3 text-left font-medium text-zinc-400"><button type="button" onClick={() => handleSort("eligible")} disabled={!canFilterMembers} className="text-inherit transition hover:text-white disabled:cursor-default">Eligible{getSortIndicator("eligible")}</button></th>}{hasDisplayField("updatedAt") && <th className="px-4 py-3 text-left font-medium text-zinc-400"><button type="button" onClick={() => handleSort("updatedAt")} disabled={!canFilterMembers} className="text-inherit transition hover:text-white disabled:cursor-default">Last Update{getSortIndicator("updatedAt")}</button></th>}{hasDisplayField("hp") && <th className="px-4 py-3 text-right font-medium text-zinc-400">HP</th>}{hasDisplayField("patk") && <th className="px-4 py-3 text-right font-medium text-zinc-400">PATK</th>}{hasDisplayField("matk") && <th className="px-4 py-3 text-right font-medium text-zinc-400">MATK</th>}{hasDisplayField("rawPdef") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Raw PDEF</th>}{hasDisplayField("rawMdef") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Raw MDEF</th>}{hasDisplayField("pvpDamageBonus") && <th className="px-4 py-3 text-right font-medium text-zinc-400">PvP DMG Bonus</th>}{hasDisplayField("pvpDamageReduction") && <th className="px-4 py-3 text-right font-medium text-zinc-400">PvP DMG Reduction</th>}{hasDisplayField("pdmgPercent") && <th className="px-4 py-3 text-right font-medium text-zinc-400">P DMG %</th>}{hasDisplayField("mdmgPercent") && <th className="px-4 py-3 text-right font-medium text-zinc-400">M DMG %</th>}{hasDisplayField("pdmgReductionPercent") && <th className="px-4 py-3 text-right font-medium text-zinc-400">P DMG Reduction %</th>}{hasDisplayField("mdmgReductionPercent") && <th className="px-4 py-3 text-right font-medium text-zinc-400">M DMG Reduction %</th>}{hasDisplayField("critRes") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Crit Res</th>}{hasDisplayField("ignorePdef") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Ignore PDEF</th>}{hasDisplayField("ignoreMdef") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Ignore MDEF</th>}{hasDisplayField("damageVsSmall") && <th className="px-4 py-3 text-right font-medium text-zinc-400">DMG vs Small</th>}{hasDisplayField("damageReductionVsSmall") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Reduction vs Small</th>}{hasDisplayField("damageVsMedium") && <th className="px-4 py-3 text-right font-medium text-zinc-400">DMG vs Medium</th>}{hasDisplayField("damageReductionVsMedium") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Reduction vs Medium</th>}{hasDisplayField("damageVsDemiHuman") && <th className="px-4 py-3 text-right font-medium text-zinc-400">DMG vs Demi-Human</th>}{hasDisplayField("damageReductionVsDemiHuman") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Reduction vs Demi-Human</th>}{hasDisplayField("damageVsBrute") && <th className="px-4 py-3 text-right font-medium text-zinc-400">DMG vs Brute</th>}{hasDisplayField("damageReductionVsBrute") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Reduction vs Brute</th>}{hasDisplayField("equipmentPdefPercent") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Equipment PDEF %</th>}{hasDisplayField("equipmentMdefPercent") && <th className="px-4 py-3 text-right font-medium text-zinc-400">Equipment MDEF %</th>}{gameType === "RO3" && RO3_FIELDS.map(key => hasDisplayField(("ro3_" + key) as MemberDisplayField) && <th key={key} className="px-4 py-3 text-right font-medium text-zinc-400">{RO3_LABELS[key]}</th>)}<th className="px-4 py-3 text-right font-medium text-zinc-400">Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={displayFields.length + 1} className="px-4 py-10 text-center text-sm text-zinc-500">Loading members...</td></tr> : filteredMembers.length === 0 ? <tr><td colSpan={displayFields.length + 1} className="px-4 py-10 text-center text-sm text-zinc-500">No members found.</td></tr> : filteredMembers.map(member => <tr key={member.id} className="border-b border-zinc-800 last:border-0 transition hover:bg-zinc-800/50">{hasDisplayField("characterName") && <td className="px-4 py-3"><Link href={`/guild/members/${member.id}`} className="font-medium text-zinc-100 hover:text-white hover:underline">{member.characterName}</Link></td>}{hasDisplayField("discordUsername") && <td className="px-4 py-3 text-zinc-400">{member.discordUsername ?? "—"}</td>}{hasDisplayField("job") && <td className="px-4 py-3 text-zinc-300">{member.job ?? "—"}</td>}{hasDisplayField("priority") && <td className="px-4 py-3 text-zinc-300">{formatPriority(member.priority)}</td>}{hasDisplayField("status") && <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${member.active ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>{member.active ? "Active" : "Inactive"}</span></td>}{hasDisplayField("eligible") && <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${member.eligible ? "bg-blue-950 text-blue-300" : "bg-zinc-800 text-zinc-400"}`}>{member.eligible ? "Yes" : "No"}</span></td>}{hasDisplayField("updatedAt") && <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{new Date(member.updatedAt).toLocaleString()}</td>}{hasDisplayField("hp") && <td className="px-4 py-3 text-right text-zinc-300">{member.hp ?? "—"}</td>}{hasDisplayField("patk") && <td className="px-4 py-3 text-right text-zinc-300">{member.patk ?? "—"}</td>}{hasDisplayField("matk") && <td className="px-4 py-3 text-right text-zinc-300">{member.matk ?? "—"}</td>}{hasDisplayField("rawPdef") && <td className="px-4 py-3 text-right text-zinc-300">{Math.round(calculateRawPdef(member.pdef, member.equipmentPdefPercent))}</td>}{hasDisplayField("rawMdef") && <td className="px-4 py-3 text-right text-zinc-300">{Math.round(calculateRawMdef(member.mdef, member.equipmentMdefPercent))}</td>}{hasDisplayField("pvpDamageBonus") && <td className="px-4 py-3 text-right text-zinc-300">{member.pvpDamageBonus ?? "—"}</td>}{hasDisplayField("pvpDamageReduction") && <td className="px-4 py-3 text-right text-zinc-300">{member.pvpDamageReduction ?? "—"}</td>}{hasDisplayField("pdmgPercent") && <td className="px-4 py-3 text-right text-zinc-300">{member.pdmgPercent ?? "—"}</td>}{hasDisplayField("mdmgPercent") && <td className="px-4 py-3 text-right text-zinc-300">{member.mdmgPercent ?? "—"}</td>}{hasDisplayField("pdmgReductionPercent") && <td className="px-4 py-3 text-right text-zinc-300">{member.pdmgReductionPercent ?? "—"}</td>}{hasDisplayField("mdmgReductionPercent") && <td className="px-4 py-3 text-right text-zinc-300">{member.mdmgReductionPercent ?? "—"}</td>}{hasDisplayField("critRes") && <td className="px-4 py-3 text-right text-zinc-300">{member.critRes ?? "—"}</td>}{hasDisplayField("ignorePdef") && <td className="px-4 py-3 text-right text-zinc-300">{member.ignorePdef ?? "—"}</td>}{hasDisplayField("ignoreMdef") && <td className="px-4 py-3 text-right text-zinc-300">{member.ignoreMdef ?? "—"}</td>}{hasDisplayField("damageVsSmall") && <td className="px-4 py-3 text-right text-zinc-300">{member.damageVsSmall ?? "—"}</td>}{hasDisplayField("damageReductionVsSmall") && <td className="px-4 py-3 text-right text-zinc-300">{member.damageReductionVsSmall ?? "—"}</td>}{hasDisplayField("damageVsMedium") && <td className="px-4 py-3 text-right text-zinc-300">{member.damageVsMedium ?? "—"}</td>}{hasDisplayField("damageReductionVsMedium") && <td className="px-4 py-3 text-right text-zinc-300">{member.damageReductionVsMedium ?? "—"}</td>}{hasDisplayField("damageVsDemiHuman") && <td className="px-4 py-3 text-right text-zinc-300">{member.damageVsDemiHuman ?? "—"}</td>}{hasDisplayField("damageReductionVsDemiHuman") && <td className="px-4 py-3 text-right text-zinc-300">{member.damageReductionVsDemiHuman ?? "—"}</td>}{hasDisplayField("damageVsBrute") && <td className="px-4 py-3 text-right text-zinc-300">{member.damageVsBrute ?? "—"}</td>}{hasDisplayField("damageReductionVsBrute") && <td className="px-4 py-3 text-right text-zinc-300">{member.damageReductionVsBrute ?? "—"}</td>}{hasDisplayField("equipmentPdefPercent") && <td className="px-4 py-3 text-right text-zinc-300">{member.equipmentPdefPercent ?? "—"}</td>}{hasDisplayField("equipmentMdefPercent") && <td className="px-4 py-3 text-right text-zinc-300">{member.equipmentMdefPercent ?? "—"}</td>}{gameType === "RO3" && RO3_FIELDS.map(key => hasDisplayField(("ro3_" + key) as MemberDisplayField) && <td key={key} className="px-4 py-3 text-right text-zinc-300">{member.ro3Stats?.[key] ?? "—"}</td>)}<td className="px-4 py-3 text-right">{canEditMember(member) ? <button type="button" onClick={() => openMember(member)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white">Edit</button> : <span className="text-xs text-zinc-600">View only</span>}</td></tr>)}</tbody></table></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-500" aria-live="polite">
            Showing {totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalFiltered)} of {totalFiltered.toLocaleString()} matching members
          </p>
          <nav aria-label="Member directory pages" className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={loading || page <= 1} className="min-h-10 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <span className="min-w-24 text-center text-sm text-zinc-500" aria-live="polite">Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={loading || page >= totalPages} className="min-h-10 rounded-lg border border-zinc-700 px-3 text-sm text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </nav>
        </div>
        {showImport && canImportMembers && <ImportMembersModal onClose={() => setShowImport(false)} onImported={async () => { setShowImport(false); await loadMembers(); }} />}
        {showMemberForm && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"><div className="mx-auto my-8 max-w-5xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"><div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4"><div><h2 className="text-lg font-semibold">{selectedMember ? "Edit Member" : "Add Member"}</h2>{userRole === "MEMBER" && selectedMember && isOwnMember(selectedMember) && <p className="mt-1 text-xs text-zinc-500">You are editing your own member profile.</p>}</div><button type="button" onClick={closeMember} disabled={saving || deleting || leaveSaving} className="rounded-lg px-3 py-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-white">✕</button></div><div className="max-h-[75vh] overflow-y-auto p-6">{error && <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error}</div>}<div className="grid gap-6 md:grid-cols-2"><section><h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Basic Information</h3><div className="space-y-4">{canManageMembers && <><div><label className="mb-1 block text-sm text-zinc-400">Discord User ID</label><input type="text" inputMode="numeric" value={form.discordUserId} onChange={event => setField("discordUserId", event.target.value)} placeholder="123456789012345678" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"/><p className="mt-1 text-xs text-zinc-600">The numeric Discord User ID. Keep this as text.</p></div><div><label className="mb-1 block text-sm text-zinc-400">Discord Username</label><input type="text" value={form.discordUsername} onChange={event => setField("discordUsername", event.target.value)} placeholder="jigsaw0226" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"/><p className="mt-1 text-xs text-zinc-600">The current Discord username associated with the account.</p></div></>}{<div><label className="mb-1 block text-sm text-zinc-400">Character Name</label><input type="text" value={form.characterName} onChange={event => setField("characterName", event.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"/></div>}<div><label className="mb-1 block text-sm text-zinc-400">Job</label><select value={form.job} onChange={event => setField("job", event.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"><option value="">Select a job</option>{gameType === "RO3" && (form.job === "Royal Guard" || form.job === "Rune Knight") && <option value={form.job}>{form.job} — legacy; select DPS or Tank</option>}{availableJobs.map(job => <option key={job} value={job}>{job}</option>)}</select></div>{canManageMembers && <><div><label className="mb-1 block text-sm text-zinc-400">Priority</label><select value={form.priority} onChange={event => setField("priority", event.target.value as MemberForm["priority"])} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"><option value="MEMBER">Member</option><option value="OFFICER">Officer</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option><option value="COUNCIL">Council (legacy)</option><option value="LEADER">Leader (legacy)</option></select></div><div className="flex gap-6"><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.active} onChange={event => setField("active", event.target.checked)}/>Active</label><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.eligible} onChange={event => setField("eligible", event.target.checked)}/>Eligible</label></div><div><label className="mb-1 block text-sm text-zinc-400">Remarks</label><textarea value={form.remarks} onChange={event => setField("remarks", event.target.value)} rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"/></div></>}</div></section>{gameType === "RO3" ? <section><h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">RO3 Character Stats</h3><div className="grid grid-cols-2 gap-3">{RO3_FIELDS.map(key => <div key={key}><label className="mb-1 block text-xs text-zinc-500">{RO3_LABELS[key]}</label><input type="number" min="0" max={key.endsWith("Crystal") ? 50 : undefined} step="any" value={form.ro3Stats[key] ?? ""} onChange={event => setForm(current => ({ ...current, ro3Stats: { ...current.ro3Stats, [key]: event.target.value } }))} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"/></div>)}</div><p className="mt-3 text-xs text-zinc-600">Special Dish crystal values must be between 0 and 50.</p></section> : <section><h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Combat Stats</h3><div className="grid grid-cols-2 gap-3">{[["PDEF", "pdef"], ["MDEF", "mdef"], ["PATK", "patk"], ["MATK", "matk"], ["HP", "hp"], ["Crit Res", "critRes"], ["Ignore PDEF", "ignorePdef"], ["Ignore MDEF", "ignoreMdef"], ["PvP DMG Bonus", "pvpDamageBonus"], ["PvP DMG Reduction", "pvpDamageReduction"], ["P DMG %", "pdmgPercent"], ["M DMG %", "mdmgPercent"], ["P DMG Reduction %", "pdmgReductionPercent"], ["M DMG Reduction %", "mdmgReductionPercent"], ["DMG vs Small", "damageVsSmall"], ["Reduction vs Small", "damageReductionVsSmall"], ["DMG vs Medium", "damageVsMedium"], ["Reduction vs Medium", "damageReductionVsMedium"], ["DMG vs Demi-Human", "damageVsDemiHuman"], ["Reduction vs Demi-Human", "damageReductionVsDemiHuman"], ["DMG vs Brute", "damageVsBrute"], ["Reduction vs Brute", "damageReductionVsBrute"], ["Equipment PDEF %", "equipmentPdefPercent"], ["Equipment MDEF %", "equipmentMdefPercent"]].map(([label, field]) => <div key={field}><label className="mb-1 block text-xs text-zinc-500">{label}</label><input type="number" step="any" value={form[field as keyof MemberForm] as string} onChange={event => setField(field as keyof MemberForm, event.target.value as never)} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"/></div>)}</div></section>}</div>{selectedMember && <section className="mt-8 border-t border-zinc-800 pt-6"><div className="mb-4"><h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Unavailable Dates</h3><p className="mt-1 text-xs text-zinc-600">Dates when this member cannot participate.</p></div>{canManageLeave(selectedMember) ? <><div className="grid gap-3 md:grid-cols-[180px_1fr_auto]"><input type="date" value={leaveDate} onChange={event => setLeaveDate(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"/><input type="text" value={leaveReason} onChange={event => setLeaveReason(event.target.value)} placeholder="Reason (optional)" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"/><button type="button" onClick={addLeaveDate} disabled={!leaveDate || leaveSaving} className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold transition hover:hmdl-btn hmdl-btn-primary disabled:cursor-not-allowed disabled:opacity-50">{leaveSaving ? "Saving..." : "Add Date"}</button></div></> : <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-600">You can only manage your own unavailable dates.</p>}<div className="mt-4 space-y-2">{leaveDatesLoading ? <p className="text-sm text-zinc-400" role="status">Loading unavailable dates…</p> : leaveDatesError ? <div className="text-sm text-red-300" role="alert">{leaveDatesError} <button type="button" onClick={() => setLeaveDatesReload(current => current + 1)} className="ml-2 underline">Retry</button></div> : leaveDates.length === 0 ? <p className="text-sm text-zinc-600">No unavailable dates.</p> : leaveDates.map(leave => <div key={leave.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3"><div><div className="text-sm font-medium text-zinc-200">{new Date(leave.date).toLocaleDateString()}</div>{leave.reason && <div className="mt-1 text-xs text-zinc-500">{leave.reason}</div>}</div>{canManageLeave(selectedMember) && <button type="button" onClick={() => removeLeaveDate(leave.id)} disabled={leaveSaving} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">Remove</button>}</div>)}</div></section> }</div><div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4"><div>{canDeleteMembers && selectedMember && <button type="button" onClick={deleteMember} disabled={saving || deleting} className="rounded-lg border border-red-900 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-950/50 disabled:opacity-50">{deleting ? "Deleting..." : "Delete Member"}</button>}</div><div className="flex gap-2"><button type="button" onClick={closeMember} disabled={saving || deleting || leaveSaving} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:opacity-50">Cancel</button><button type="button" onClick={saveMember} disabled={saving || deleting} className="rounded-lg hmdl-btn hmdl-btn-primary px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button></div></div></div></div>}
      </div>
    </main>
  );
}
