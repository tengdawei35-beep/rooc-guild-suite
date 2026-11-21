import Link from "next/link";
import { requirePageAuth } from "@/lib/auth";
import { isRoocGuild } from "@/lib/auth/modules";
import Ro3OptInsClient from "./Ro3OptInsClient";

export default async function Ro3OptInsPage() {
  const auth = await requirePageAuth();
  const isRooc = await isRoocGuild(auth.guild.id);
  if (isRooc) {
    return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-5xl px-6 py-10"><Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link><div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8"><h1 className="text-xl font-semibold">RO3 Opt-ins unavailable</h1><p className="mt-2 text-sm text-zinc-400">Member resource opt-ins are only available to RO3 guilds.</p></div></div></main>;
  }
  return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-5xl px-6 py-10"><Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link><header className="mt-8"><p className="text-sm font-medium uppercase tracking-widest text-zinc-500">{auth.guild.name}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">My Resource Opt-ins</h1><p className="mt-2 text-sm text-zinc-400">Choose the Cards, Equipment and Echoes you want to be considered for.</p></header><Ro3OptInsClient /></div></main>;
}
