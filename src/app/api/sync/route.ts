import { and, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { withTenant } from "@/db";
import { syncOps } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/dal";
import * as finance from "@/modules/finance/actions";
import * as tutoring from "@/modules/tutoring/actions";

/**
 * Replays writes that were made offline.
 *
 * The client sends one batch instead of one request per write: fewer function
 * calls, and the database wakes once. Every op carries the id it was given on
 * the device; that id is recorded here after it succeeds, so a batch whose
 * reply never arrived can be sent again without creating anything twice.
 *
 * Each op runs through the same Server Action the online app calls, so the
 * permission checks, validation and tenant isolation are identical.
 */

type Handler = (payload: Record<string, unknown>, file: File | null) => Promise<ActionResult<unknown>>;

function form(payload: Record<string, unknown>, file: File | null): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") data.set(key, value);
    else if (value !== null && value !== undefined) data.set(key, String(value));
  }
  if (file) data.set("photo", file, file.name || "photo.webp");
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payloads are validated by each action's own zod schema
const json = (action: (input: any) => Promise<ActionResult<unknown>>): Handler => (payload) => action(payload);

const HANDLERS: Record<string, Handler> = {
  saveTransaction: json(finance.saveTransaction),
  deleteTransaction: json(finance.deleteTransaction),
  saveWallet: json(finance.saveWallet),
  archiveWallet: json(finance.archiveWallet),
  deleteWallet: json(finance.deleteWallet),
  saveCategory: json(finance.saveCategory),
  archiveCategory: json(finance.archiveCategory),
  saveDebt: json(finance.saveDebt),
  addDebtPayment: json(finance.addDebtPayment),
  deleteDebtPayment: json(finance.deleteDebtPayment),
  deleteDebt: json(finance.deleteDebt),
  setDebtSettled: json(finance.setDebtSettled),
  saveStudent: json(tutoring.saveStudent),
  archiveStudent: json(tutoring.archiveStudent),
  addManualLesson: json(tutoring.addManualLesson),
  updateLesson: json(tutoring.updateLesson),
  deleteLesson: json(tutoring.deleteLesson),
  recordPayment: json(tutoring.recordPayment),
  deletePayment: json(tutoring.deletePayment),
  checkIn: (payload, file) => tutoring.checkIn(form(payload, file)),
  checkOut: (payload, file) => tutoring.checkOut(form(payload, file)),
};

const opsSchema = z.array(
  z.object({
    id: z.string().min(8).max(64),
    name: z.string().min(1).max(40),
    ownerId: z.uuid(),
    payload: z.record(z.string(), z.unknown()).default({}),
  }),
).max(20);

/** Ids are only needed while a device might still retry; a month is plenty. */
const KEEP_DAYS = 30;

/** Nothing was written, so the id must not stay claimed: let the device retry. */
function release(userId: string, opId: string) {
  return withTenant(userId, (tx) => tx.delete(syncOps).where(and(eq(syncOps.userId, userId), eq(syncOps.opId, opId))));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.formData();
  const parsed = opsSchema.safeParse(JSON.parse(String(body.get("ops") ?? "[]")));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const op of parsed.data) {
    if (op.ownerId !== user.id) {
      results.push({ id: op.id, ok: false, error: "Thao tác này thuộc tài khoản khác." });
      continue;
    }
    const handler = HANDLERS[op.name];
    if (!handler) {
      results.push({ id: op.id, ok: false, error: "Thao tác không còn được hỗ trợ." });
      continue;
    }

    // The id is claimed before the work starts, not after: two devices (or a
    // tab that reconnected twice) can send the same op at the same moment, and
    // only the request that wins the insert is allowed to apply it.
    const [claimed] = await withTenant(user.id, (tx) =>
      tx
        .insert(syncOps)
        .values({ opId: op.id, userId: user.id, action: op.name })
        .onConflictDoNothing()
        .returning({ opId: syncOps.opId }),
    );
    if (!claimed) {
      results.push({ id: op.id, ok: true }); // already applied, or being applied
      continue;
    }

    const file = body.get(`file:${op.id}`);
    try {
      const result = await handler(op.payload, file instanceof File ? file : null);
      if (result.ok) {
        results.push({ id: op.id, ok: true });
      } else {
        await release(user.id, op.id);
        results.push({ id: op.id, ok: false, error: result.error });
      }
    } catch (error) {
      console.error("[sync]", op.name, error);
      await release(user.id, op.id);
      results.push({ id: op.id, ok: false, error: "Máy chủ không xử lý được thao tác này." });
    }
  }

  if (Math.random() < 0.05) {
    await withTenant(user.id, (tx) =>
      tx
        .delete(syncOps)
        .where(and(eq(syncOps.userId, user.id), lt(syncOps.createdAt, sql`now() - interval '${sql.raw(String(KEEP_DAYS))} days'`))),
    );
  }

  return Response.json({ results });
}
