"use client";

import { useEffect, useState } from "react";

type Allocation = {
  id: string;
  resource: string;
  member: string;
  amount: number;
  status: string;
  date: string;
  notes?: string | null;
};

export default function ResourceHistoryClient() {
  const [items, setItems] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/guild/resources/history", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Failed to load allocation history.");
        setItems(data.allocations ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load allocation history."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-4 py-6 text-gray-100 md:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Resource Allocation History</h1>
        <p className="mt-1 text-sm text-gray-400">A transparent record of resources distributed to guild members.</p>

        {error && <div className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">{error}</div>}
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-800 bg-[#111]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#151515]">
                <tr className="border-b border-gray-800">
                  {['Date', 'Resource', 'Recipient', 'Amount', 'Status', 'Notes'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Loading history...</td></tr> : items.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No allocations recorded yet.</td></tr> : items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-800/80 hover:bg-[#171717]">
                    <td className="px-4 py-3 text-gray-400">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-200">{item.resource}</td>
                    <td className="px-4 py-3 text-gray-300">{item.member}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-200">{item.amount}</td>
                    <td className="px-4 py-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2 py-1 text-xs text-gray-300">{item.status}</span></td>
                    <td className="px-4 py-3 text-gray-500">{item.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
