"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type GameType = "ROOC" | "RO3";

type GuildData = {
  id: string;
  name: string;
  discordGuildId: string;
  gameType: GameType;
};

const GAME_OPTIONS: { value: GameType; label: string; description: string }[] = [
  { value: "ROOC", label: "ROO Classic", description: "Ragnarok Online Origin Classic" },
  { value: "RO3", label: "RO3", description: "Ragnarok Online 3" },
];

export default function GuildForm({ guild }: { guild: GuildData }) {
  const router = useRouter();
  const [name, setName] = useState(guild.name);
  const [discordGuildId, setDiscordGuildId] = useState(guild.discordGuildId);
  const [gameType, setGameType] = useState<GameType>(guild.gameType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (gameType !== guild.gameType) {
      const currentLabel = GAME_OPTIONS.find((game) => game.value === guild.gameType)?.label;
      const nextLabel = GAME_OPTIONS.find((game) => game.value === gameType)?.label;
      const confirmed = window.confirm(
        `Switch this guild from ${currentLabel} to ${nextLabel}? Existing game-specific data will be preserved and will not be converted.`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/guild", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, discordGuildId, gameType }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save guild.");
      }

      setSuccess("Guild settings saved successfully.");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to save guild.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium text-zinc-300">Guild Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="My Guild"
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-400"
        />
      </div>

      <div>
        <label htmlFor="discordGuildId" className="mb-2 block text-sm font-medium text-zinc-300">Discord Guild ID</label>
        <input
          id="discordGuildId"
          type="text"
          value={discordGuildId}
          onChange={(event) => setDiscordGuildId(event.target.value)}
          placeholder="123456789012345678"
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-white outline-none transition focus:border-zinc-400"
        />
        <p className="mt-2 text-xs text-zinc-500">The Discord server ID associated with this guild.</p>
      </div>

      <div>
        <label htmlFor="gameType" className="mb-2 block text-sm font-medium text-zinc-300">Game</label>
        <select
          id="gameType"
          value={gameType}
          onChange={(event) => setGameType(event.target.value as GameType)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-zinc-400"
        >
          {GAME_OPTIONS.map((game) => (
            <option key={game.value} value={game.value}>{game.label} — {game.description}</option>
          ))}
        </select>
        <p className="mt-2 text-xs text-zinc-500">
          Changing the game switches the active game module. Existing stats, bidding history and allocation records are preserved and are not converted.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-400">{success}</div>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
