import { NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  return (await getPlatformAdmin()) ? true : false;
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(request.url);
  const affiliateId = url.searchParams.get("id");

  if (affiliateId) {
    const affiliates = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; code: string; discountPercent: number; commissionPercent: number; active: boolean }>>(`
      SELECT "id", "name", "code", "discountPercent", "commissionPercent", "active"
      FROM "Affiliate" WHERE "id" = $1 LIMIT 1`, affiliateId);
    if (!affiliates[0]) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const referrals = await prisma.$queryRawUnsafe<Array<{
      id: string; guildId: string | null; guildName: string | null; stripeSubscriptionId: string | null; createdAt: Date;
    }>>(`
      SELECT r."id", r."guildId", g."name" AS "guildName", r."stripeSubscriptionId", r."createdAt"
      FROM "AffiliateReferral" r
      LEFT JOIN "Guild" g ON g."id" = r."guildId"
      WHERE r."affiliateId" = $1
      ORDER BY r."createdAt" DESC`, affiliateId);

    const commissions = await prisma.$queryRawUnsafe<Array<{
      id: string; referralId: string; stripeInvoiceId: string; amountCents: number; currency: string; status: string; createdAt: Date; paidAt: Date | null;
    }>>(`
      SELECT "id", "referralId", "stripeInvoiceId", "amountCents", "currency", "status", "createdAt", "paidAt"
      FROM "AffiliateCommission"
      WHERE "affiliateId" = $1
      ORDER BY "createdAt" DESC`, affiliateId);

    return NextResponse.json({ affiliate: affiliates[0], referrals, commissions: commissions.map(c => ({ ...c, amountCents: Number(c.amountCents) })) });
  }

  const affiliates = await prisma.$queryRawUnsafe<Array<{
    id: string; name: string; code: string; discountPercent: number; commissionPercent: number; active: boolean;
    referralCount: bigint; commissionCount: bigint; commissionCents: bigint;
  }>>(`
    SELECT a."id", a."name", a."code", a."discountPercent", a."commissionPercent", a."active",
      (SELECT COUNT(*) FROM "AffiliateReferral" r WHERE r."affiliateId" = a."id") AS "referralCount",
      (SELECT COUNT(*) FROM "AffiliateCommission" c WHERE c."affiliateId" = a."id") AS "commissionCount",
      COALESCE((SELECT SUM(c."amountCents") FROM "AffiliateCommission" c WHERE c."affiliateId" = a."id"), 0) AS "commissionCents"
    FROM "Affiliate" a
    ORDER BY a."active" DESC, a."createdAt" DESC
  `);

  return NextResponse.json(affiliates.map((a) => ({ ...a, referralCount: Number(a.referralCount), commissionCount: Number(a.commissionCount), commissionCents: Number(a.commissionCents) })));
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; id?: string; name?: string; code?: string; discountPercent?: number; commissionPercent?: number; active?: boolean };
    const action = body.action ?? "create";

    if (action === "toggle") {
      if (!body.id) return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
      const rows = await prisma.$queryRawUnsafe<Array<{ active: boolean }>>(`SELECT "active" FROM "Affiliate" WHERE "id" = $1 LIMIT 1`, body.id);
      if (!rows[0]) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      await prisma.$executeRawUnsafe(`UPDATE "Affiliate" SET "active" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2`, !rows[0].active, body.id);
      return NextResponse.json({ ok: true });
    }

    if (action === "markPaid") {
      if (!body.id) return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
      const result = await prisma.$executeRawUnsafe(`UPDATE "AffiliateCommission" SET "status" = 'PAID', "paidAt" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "status" <> 'PAID'`, body.id);
      if (!result) return NextResponse.json({ error: "NOT_FOUND_OR_ALREADY_PAID" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    const name = body.name?.trim();
    const code = body.code?.trim().toUpperCase();
    const discountPercent = Number(body.discountPercent ?? 10);
    const commissionPercent = Number(body.commissionPercent ?? 20);
    if (!name || name.length > 100) return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
    if (!code || !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return NextResponse.json({ error: "INVALID_DISCOUNT" }, { status: 400 });
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) return NextResponse.json({ error: "INVALID_COMMISSION" }, { status: 400 });

    if (action === "update") {
      if (!body.id) return NextResponse.json({ error: "ID_REQUIRED" }, { status: 400 });
      const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "Affiliate" WHERE "id" = $1 LIMIT 1`, body.id);
      if (!existing[0]) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      await prisma.$executeRawUnsafe(`UPDATE "Affiliate" SET "name" = $1, "code" = $2, "discountPercent" = $3, "commissionPercent" = $4, "active" = $5, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $6`, name, code, discountPercent, commissionPercent, body.active ?? true, body.id);
      return NextResponse.json({ ok: true });
    }

    const id = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`INSERT INTO "Affiliate" ("id", "name", "code", "discountPercent", "commissionPercent", "active") VALUES ($1, $2, $3, $4, $5, TRUE)`, id, name, code, discountPercent, commissionPercent);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN AFFILIATES]", error);
    if (String(error).includes("Affiliate_code_key")) return NextResponse.json({ error: "CODE_ALREADY_EXISTS" }, { status: 409 });
    return NextResponse.json({ error: "AFFILIATE_OPERATION_FAILED" }, { status: 500 });
  }
}
