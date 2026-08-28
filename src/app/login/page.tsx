import Link from "next/link";

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
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">
            ROO Guild Suite
          </h1>

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
          className="mt-8 flex w-full items-center justify-center rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
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