import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-admin";

const cards = [
  { href: "/admin/guild-creators", title: "Guild Creators", description: "Manage approved guild creators, guild limits, and complimentary access.", label: "Creator access" },
  { href: "/admin/affiliates", title: "Affiliates", description: "Manage influencer referral codes, referrals, and commission activity.", label: "Referral program" },
  { href: "/admin/guilds", title: "Guilds", description: "View and manage guilds across the ROO Guild Suite platform.", label: "Platform" },
  { href: "/admin/users", title: "Users", description: "Review platform users and their guild relationships.", label: "Platform" },
  { href: "/admin/subscriptions", title: "Subscriptions", description: "Review platform-wide subscription and billing activity.", label: "Billing" },
  { href: "/admin/settings", title: "System Settings", description: "Platform-level configuration and administrative controls.", label: "Configuration" },
];

export default async function AdminPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
        <div className="mt-8">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Platform Administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Platform-level tools for managing ROO Guild Suite. These controls are separate from individual guild administration.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-zinc-600 hover:bg-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{card.label}</p>
              <h2 className="mt-2 text-lg font-semibold group-hover:text-white">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{card.description}</p>
              <p className="mt-5 text-sm font-medium text-zinc-500 group-hover:text-zinc-300">Open →</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
