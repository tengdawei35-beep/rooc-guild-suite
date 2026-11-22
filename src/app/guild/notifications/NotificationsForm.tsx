"use client";
import { useEffect, useState } from "react";

const channels = [
  { key: "roster", label: "Roster updates", description: "Roster generation, edits, additions, removals and deletions." },
  { key: "bid", label: "Bid pages complete", description: "Only fires when an allocation finishes and bid pages are ready." },
  { key: "stats", label: "Stats reminders", description: "Reminds members whose core combat statistics are incomplete." },
  { key: "calls", label: "Call To Arms", description: "Party-ready announcements and 30-minute reminders for Call To Arms events." },
] as const;
type Channel = (typeof channels)[number]["key"];

export default function NotificationsForm() {
  const [configured, setConfigured] = useState<Record<Channel, boolean>>({ roster: false, bid: false, stats: false, calls: false });
  const [values, setValues] = useState<Record<Channel, string>>({ roster: "", bid: "", stats: "", calls: "" });
  const [clear, setClear] = useState<Record<Channel, boolean>>({ roster: false, bid: false, stats: false, calls: false });
  const [eventChannelId, setEventChannelId] = useState("");
  const [hasEventChannel, setHasEventChannel] = useState(false);
  const [clearEventChannel, setClearEventChannel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/guild/notifications", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to load notification settings.");
      setConfigured(result.configured);
      setHasEventChannel(Boolean(result.configured.eventChannelId));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load().catch(err => setError(err instanceof Error ? err.message : "Failed to load notification settings."));
  }, []);

  async function save() {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/guild/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterWebhookUrl: values.roster || undefined,
          bidWebhookUrl: values.bid || undefined,
          statsWebhookUrl: values.stats || undefined,
          callsWebhookUrl: values.calls || undefined,
          clearRoster: clear.roster, clearBid: clear.bid, clearStats: clear.stats, clearCalls: clear.calls,
          eventChannelId: eventChannelId || undefined,
          clearEventChannel,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to save notification settings.");
      setValues({ roster: "", bid: "", stats: "", calls: "" });
      setClear({ roster: false, bid: false, stats: false, calls: false });
      setEventChannelId(""); setClearEventChannel(false);
      await load(); setMessage("Discord notification settings saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save notification settings."); }
    finally { setSaving(false); }
  }

  async function test(type: Channel) {
    setMessage(""); setError("");
    try {
      const response = await fetch("/api/guild/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Test failed.");
      setMessage(`${channels.find(c => c.key === type)?.label} test sent.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Test failed."); }
  }

  return <div className="space-y-6">\n    <details className="rounded-xl border border-indigo-900/60 bg-indigo-950/20 p-5">
      <summary className="cursor-pointer list-none font-semibold text-indigo-100"><span className="mr-2 text-indigo-300">＋</span>How to create a Discord webhook — step-by-step guide</summary>
      <div className="mt-4 space-y-5 text-sm leading-6 text-zinc-300">
        <p>A webhook lets Heimdall post updates into a Discord channel without requiring the HMDL bot for these notification types. Create one webhook for each destination channel you want to use.</p>
        <ol className="list-decimal space-y-3 pl-5">
          <li><strong className="text-zinc-100">Open your Discord server.</strong> Choose the server and channel where you want a notification to appear.</li>
          <li><strong className="text-zinc-100">Open Server Settings.</strong> Select the server name at the top of the channel list, then choose Server Settings.</li>
          <li><strong className="text-zinc-100">Open Integrations → Webhooks.</strong> You need the <strong>Manage Webhooks</strong> permission. If Webhooks is unavailable, ask a server administrator to grant access or create the webhook for you.</li>
          <li><strong className="text-zinc-100">Create the webhook.</strong> Select New Webhook / Create Webhook, give it a recognisable name such as “Heimdall Notifications”, and choose the destination channel.</li>
          <li><strong className="text-zinc-100">Copy the webhook URL.</strong> Use Copy Webhook URL, then return to this Heimdall page.</li>
          <li><strong className="text-zinc-100">Paste it into the matching notification field</strong> below and select Save Discord Notifications.</li>
          <li><strong className="text-zinc-100">Send a test.</strong> Once saved, use the Test button beside that notification. Check the selected Discord channel for the test message.</li>
        </ol>
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200/90"><strong>Keep the webhook URL private.</strong> Anyone with the URL may be able to post messages to its channel. Heimdall stores it server-side and does not display the saved URL again. If it is exposed, regenerate it in Discord and replace it here.</div>
        <p className="text-xs text-zinc-500">Discord may move or rename menu items as its interface changes. If you cannot create a webhook, ask a server administrator to do it or grant you Manage Webhooks.</p>
      </div>
    </details>

    {loading && <p role="status" className="text-sm text-zinc-400">Loading saved notification settings…</p>}
    {channels.map(channel => <div key={channel.key} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">{channel.label}</h2><p className="mt-1 text-sm text-zinc-500">{channel.description}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${configured[channel.key] ? "bg-emerald-950 text-emerald-400" : "bg-zinc-900 text-zinc-600"}`}>{configured[channel.key] ? "Configured" : "Not configured"}</span></div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="url" value={values[channel.key]} onChange={e => setValues(current => ({ ...current, [channel.key]: e.target.value }))} placeholder={configured[channel.key] ? "Paste a new webhook URL to replace it" : "https://discord.com/api/webhooks/..."} disabled={clear[channel.key]} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500 disabled:opacity-40" /><button type="button" onClick={() => test(channel.key)} disabled={!configured[channel.key]} className="rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-30">Test</button></div>
      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={clear[channel.key]} onChange={e => setClear(current => ({ ...current, [channel.key]: e.target.checked }))} />Disable this notification channel</label>
    </div>)}
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">Event attendance channel</h2><p className="mt-1 text-sm text-zinc-500">HMDL posts event attendance messages and 48-hour reminders here. The HMDL Discord bot must be added to your server with permission to send messages.</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${hasEventChannel ? "bg-emerald-950 text-emerald-400" : "bg-zinc-900 text-zinc-600"}`}>{hasEventChannel ? "Configured" : "Not configured"}</span></div>
      <input value={eventChannelId} onChange={e => setEventChannelId(e.target.value)} placeholder="Discord channel ID" disabled={clearEventChannel} className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-500 disabled:opacity-40" />
      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={clearEventChannel} onChange={e => setClearEventChannel(e.target.checked)} />Clear event notification channel</label>
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300"><span>{error}</span><button type="button" onClick={() => void load().catch(err => setError(err instanceof Error ? err.message : "Failed to load notification settings."))} disabled={loading} className="underline underline-offset-4 disabled:opacity-50">Retry loading</button></div>}
    {message && <div role="status" aria-live="polite" className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">{message}</div>}
    <button type="button" onClick={save} disabled={saving || loading} className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-50">{saving ? "Saving..." : "Save Discord Notifications"}</button>
    <p className="text-xs leading-5 text-zinc-600">Webhook URLs are stored server-side and are never displayed back in the UI. The event channel uses the HMDL bot rather than a webhook so members can respond with buttons.</p>
  </div>;
}
