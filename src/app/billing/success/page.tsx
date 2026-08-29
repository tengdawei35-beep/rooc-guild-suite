import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">ROO Guild Suite</p>
        <h1 className="mt-3 text-2xl font-semibold">Payment received</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Your payment has been received. Stripe is confirming the subscription and your guild will be provisioned automatically.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200">
          Continue to dashboard
        </Link>
      </section>
    </main>
  );
}
