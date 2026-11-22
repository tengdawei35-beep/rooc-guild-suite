import { requirePageAuth, hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";
import ApplicantsClient from "./ApplicantsClient";

export default async function ApplicantsPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "applicants.view")) redirect("/");
  return (
    <main className="hmdl-management min-h-screen text-white">
      <div className="hmdl-page">

        <div>
          <ApplicantsClient
            canManage={hasPermission(auth.role, "applicants.manage")}
          />
        </div>
      </div>
    </main>
  );
}
