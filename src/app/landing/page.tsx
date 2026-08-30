import Link from "next/link";

const DISCORD_URL = "https://discord.gg/48yTtF9UxP";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight">HMDL</p>
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Heimdall</p>
          </div>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="text-sm text-zinc-400 transition hover:text-white">
            Discord ↗
          </a>
        </header>

        <section className="flex flex-1 items-center justify-center py-20">
          <div className="w-full max-w-4xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-zinc-500">Guild management, simplified.</p>
            <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-7xl">Heimdall</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-400 sm:text-xl">
              Manage your guild, events, rosters, raids, bidding, resources and members from one place.
            </p>

            <div className="mx-auto mt-12 grid max-w-3xl gap-4 md:grid-cols-3">
              <Link href="/pricing" className="group rounded-2xl border border-zinc-700 bg-zinc-900 p-7 text-left transition hover:-translate-y-1 hover:border-zinc-500 hover:bg-zinc-800">
                <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">New User</p>
                <h2 className="mt-3 text-2xl font-semibold">Choose your plan</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Compare HMDL packages and features, then start your subscription.</p>
                <span className="mt-6 inline-block text-sm font-semibold text-white">View packages →</span>
              </Link>

              <Link href="/login" className="group rounded-2xl border border-zinc-700 bg-zinc-900 p-7 text-left transition hover:-translate-y-1 hover:border-zinc-500 hover:bg-zinc-800">
                <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Existing User</p>
                <h2 className="mt-3 text-2xl font-semibold">Login</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Sign in with Discord and continue to your guild dashboard.</p>
                <span className="mt-6 inline-block text-sm font-semibold text-white">Continue →</span>
              </Link>

              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="group rounded-2xl border border-zinc-700 bg-zinc-900 p-7 text-left transition hover:-translate-y-1 hover:border-zinc-500 hover:bg-zinc-800">
                <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Community</p>
                <h2 className="mt-3 text-2xl font-semibold">Discord</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Join the official HMDL community for support, updates and discussion.</p>
                <span className="mt-6 inline-block text-sm font-semibold text-white">Join Discord ↗</span>
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
          HMDL · Heimdall
        </footer>
      </div>
    </main>
  );
}
