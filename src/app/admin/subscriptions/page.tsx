import { redirect } from "next/navigation";

import ManagementPageHeader from "@/app/ManagementPageHeader";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

function statusClass(status: string) {
  if (status === "ACTIVE" || status === "TRIALING") {
    return "border-emerald-900 bg-emerald-950/30 text-emerald-400";
  }
  if (status === "PAST_DUE") {
    return "border-amber-900 bg-amber-950/30 text-amber-400";
  }
  if (status === "CANCELED" || status === "INCOMPLETE") {
    return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

export default async function AdminSubscriptionsPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");

  const subscriptions = await prisma.guildSubscription.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      guild: { select: { id: true, name: true } },
      plan: { select: { name: true, priceCents: true, currency: true } },
    },
  });

  const activeCount = subscriptions.filter((item) =>
    item.status === "ACTIVE" || item.status === "TRIALING"
  ).length;
  const pastDueCount = subscriptions.filter((item) =>
    item.status === "PAST_DUE"
  ).length;
  const complimentaryCount = subscriptions.filter((item) =>
    item.provider === "complimentary"
  ).length;

  return (
    <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page">
        <ManagementPageHeader
          eyebrow="PLATFORM · BILLING"
          title="Subscriptions"
          description="Review subscription plans, billing status and access across all guilds."
        />

        <section aria-label="Subscription overview" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Total subscriptions" value={subscriptions.length} />
          <Summary label="Active / trialing" value={activeCount} />
          <Summary label="Past due" value={pastDueCount} />
          <Summary label="Complimentary" value={complimentaryCount} />
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
            <div>
              <h2 className="font-semibold text-white">All subscriptions</h2>
              <p className="mt-1 text-sm text-zinc-500">Most recently created subscriptions appear first.</p>
            </div>
            <span className="text-xs text-zinc-500">{subscriptions.length} records</span>
          </div>

          {subscriptions.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <h3 className="font-medium text-zinc-200">No subscriptions yet</h3>
              <p className="mt-2 text-sm text-zinc-500">Guild subscriptions will appear here when they are created.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="hmdl-table w-full min-w-[54rem]">
                <thead>
                  <tr>
                    <th scope="col">Guild</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Status</th>
                    <th scope="col">Provider</th>
                    <th scope="col">Price</th>
                    <th scope="col">Period ends</th>
                    <th scope="col">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td>
                        <span className="font-medium text-zinc-100">{subscription.guild.name}</span>
                      </td>
                      <td>{subscription.plan.name}</td>
                      <td>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(subscription.status)}`}>
                          {subscription.status.replaceAll("_", " ")}
                        </span>
                        {subscription.cancelAtPeriodEnd && (
                          <span className="ml-2 text-xs text-amber-400">Cancels at period end</span>
                        )}
                      </td>
                      <td className="capitalize">{subscription.provider ?? "—"}</td>
                      <td>{formatPrice(subscription.plan.priceCents, subscription.plan.currency)}</td>
                      <td>{formatDate(subscription.currentPeriodEnd)}</td>
                      <td>{formatDate(subscription.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="mt-3 text-xs text-zinc-600">This view is read-only. Subscription changes and payment-provider actions are not performed from this page.</p>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}
