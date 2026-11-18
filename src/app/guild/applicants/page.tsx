import Link from "next/link";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";
import ApplicantsClient from "./ApplicantsClient";

export default async function ApplicantsPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "applicants.view")) redirect("/");
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-white"
        >
          ← Dashboard
        </Link>

        <div className="mt-4">
          <ApplicantsClient
            canManage={hasPermission(auth.role, "applicants.manage")}
          />
        </div>
      </div>
    </main>
  );
}
