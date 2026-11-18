"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type GuildUser = {
  id: string;
  username: string;
  discordId: string;
  role: "ADMIN" | "MANAGER" | "OFFICER" | "MEMBER";
};

type Props = {
  currentOwnerUserId: string | null;
  currentUserId: string;
  users: GuildUser[];
};

export default function OwnershipTransfer({
  currentOwnerUserId,
  currentUserId,
  users,
}: Props) {
  const router = useRouter();
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isCurrentOwner = currentOwnerUserId === currentUserId;
  const candidates = users.filter((user) => user.id !== currentUserId);
  const selectedUser = candidates.find(
    (user) => user.id === newOwnerUserId
  );

  async function transferOwnership() {
    if (!isCurrentOwner || saving || !selectedUser) return;

    const confirmed = window.confirm(
      `Transfer guild ownership to ${selectedUser.username}?\n\n` +
        "You will become a Member and lose guild management access. " +
        "Your Guild Member priority will not change."
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/guild/ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerUserId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to transfer guild ownership."
        );
      }

      setSuccess(
        `Guild ownership transferred to ${selectedUser.username}.`
      );
      setNewOwnerUserId("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to transfer guild ownership."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isCurrentOwner) {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Guild Ownership
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Transfer Ownership
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Transfer control of this guild to another guild user. The new owner
          becomes an Admin. You will become a Member. Guild Member priority is
          not changed for either user.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="newGuildOwner"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            New Owner
          </label>
          <select
            id="newGuildOwner"
            value={newOwnerUserId}
            onChange={(event) => setNewOwnerUserId(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select a guild user...</option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username} ({user.role})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={transferOwnership}
          disabled={saving || !selectedUser}
          className="rounded-lg border border-red-900 bg-red-950/40 px-5 py-3 text-sm font-medium text-red-300 transition hover:border-red-700 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Transferring..." : "Transfer Ownership"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-400">
          {success}
        </div>
      )}
    </section>
  );
}
