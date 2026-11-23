import Link from "next/link";
import { HMDL_MARK } from "@/lib/hmdl-brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const params =
    await searchParams;

  let errorMessage =
    "";

  switch (
    params.error
  ) {
    case "no_guild_access":
      errorMessage =
        "Your Discord account does not have access to this guild.";

      break;

    case "authentication_failed":
      errorMessage =
        "Discord authentication failed. Please try again.";

      break;

    case "missing_code":
      errorMessage =
        "Discord did not return an authorization code.";

      break;
  }

  return (
    <main className="hmdl-auth-workspace flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="hmdl-auth-card w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="text-center">
          <img src={HMDL_MARK} alt="HMDL — Heimdall" className="mx-auto mb-5 h-28 w-28 rounded-xl object-contain" />
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300/80">HEIMDALL · GUILD MANAGEMENT SUITE</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Welcome back</h1>

          <p className="mt-2 text-sm text-zinc-500">
            Sign in with Discord to
            continue.
          </p>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <a
          href="/api/auth/discord"
          className="mt-8 flex w-full items-center justify-center rounded-lg hmdl-btn hmdl-btn-primary px-4 py-3 text-sm font-semibold transition"
        >
          Continue with Discord
        </a>

        <p className="mt-6 text-center text-xs leading-5 text-zinc-600">
          Access is controlled by your
          guild membership and role.
        </p>
      </div>
    </main>
  );
}
