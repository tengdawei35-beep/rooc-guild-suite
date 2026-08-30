"use client";

import { useEffect, useState } from "react";

const channels = [
  { key: "roster", label: "Roster updates", description: "Roster generation, edits, additions, removals and deletions." },
  { key: "bid", label: "Bid pages complete", description: "Only fires when an allocation finishes and bid pages are ready. Members in the bid are mentioned." },
  { key: "stats", label: "Stats reminders", description: "Reminds members whose core combat statistics are incomplete." },
] as const;

type Channel = (typeof channels)[number]["key"];

export default function NotificationsForm() {
  const [configured, setConfigured] = useState<Record<Channel, boolean>>({ roster: false, bid: false, stats: false });
  const [values, setValues] = useState<Record<Channel, string>>({ roster: "", bid: "", stats: "" });
  const [clear, setClear] = useState<Record<Channel, boolean>>({ roster: false, bid: false, stats: false });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/guild/notifications", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Failed to load notification settings.");
        setConfigured(result.configured);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load notification settings."));
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/guild/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterWebhookUrl: values.roster || undefined,
          bidWebhookUrl: values.bid || undefined,
          statsWebhookUrl: values.stats || undefined,
          clearRoster: clear.roster,
          clearBid: clear.bid,
          clearStats: clear.stats,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to save notification settings.");
      setValues({ roster: "", bid: "", stats: "" });
      setClear({ roster: false, bid: false, stats: false });
      const refreshed = await fetch("/api/guild/notifications", { cache: "no-store" });
      const refreshedData = await refreshed.json();
      setConfigured(refreshedData.configured);
      setMessage("Discord notification settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notification settings.");
    } finally {
      setSaving(false);
    }
  }

  async function test(type: Channel) {
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/guild/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Test failed.");
      setMessage(`${channels.find((channel) => channel.key === type)?.label} test sent.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed.");
    }
  }

  return (
    <div className="space-y-6">
      {channels.map((channel) => (
        <div key={channel.key} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold">{channel.label}</h2>
              <p className="mt-1 text-sm text-zinc-500">{channel.description}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs ${configured[channel.key] ? "bg-emerald-950 text-emerald-400" : "bg-zinc-900 text-zinc-600"}`}>
              {configured[channel.key] ? "Configured" : "Not configured"}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="url"
              value={values[channel.key]}
              onChange={(event) => setValues((current) => ({ ...current, [channel.key]: event.target.value }))}
              placeholder={configured[channel.key] ? "Paste a new webhook URL to replace it" : "https://discord.com/api/webhooks/..."}
              disabled={clear[channel.key]}
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500 disabled:opacity-40"
            />
            <button type="button" onClick={() => test(channel.key)} disabled={!configured[channel.key]} className="rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-30">
              Test
            </button>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <input type="checkbox" checked={clear[channel.key]} onChange={(event) => setClear((current) => ({ ...current, [channel.key]: event.target.checked }))} />
            Disable this notification channel
          </label>
        </div>
      ))}

      {error && <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">{message}</div>}

      <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-50">
        {saving ? "Saving..." : "Save Discord Notifications"}
      </button>

      <p className="text-xs leading-5 text-zinc-600">
        Create Discord webhooks in the channels where you want HMDL to post. Webhook URLs are stored server-side and are never displayed back in the UI.
      </p>
    </div>
  );
}
