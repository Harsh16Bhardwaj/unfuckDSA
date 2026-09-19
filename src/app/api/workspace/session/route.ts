import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMongoDatabase } from "@/lib/mongodb";

const schema = z.object({
  title: z.string().min(1).max(240),
  url: z.string().max(1000),
  slug: z.string().min(1).max(240),
  source: z.enum(["leetcode", "manual"]),
  topics: z.array(z.string().max(80)).max(20),
  difficulty: z.enum(["easy", "medium", "hard"]),
  priority: z.enum(["normal", "high"]),
  revisionMinutes: z.union([z.literal(10), z.literal(20), z.literal(30)]),
  template: z.enum(["default", "relaxed", "custom"]),
  customIntervals: z.array(z.number().int().positive().max(365)).max(20).optional(),
  approach: z.string().max(20_000), blocker: z.string().max(20_000), hint: z.string().max(20_000), notes: z.string().max(40_000),
  needsVisual: z.boolean(), activeMinutes: z.number().int().positive().max(1440),
  status: z.enum(["solved_independently", "solved_with_hints", "stuck", "stopped"]),
  dueAt: z.iso.datetime(), startedAt: z.iso.datetime(), endedAt: z.iso.datetime(),
  idempotencyKey: z.string().min(8).max(160), code: z.string().max(100_000).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session payload." }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const db = await getMongoDatabase();
  if (!db) return NextResponse.json({ error: "Workspace storage is unavailable." }, { status: 503 });
  const value = parsed.data;
  await Promise.all([
    db.collection("problem_records").createIndex({ userId: 1, source: 1, slug: 1 }, { unique: true }),
    db.collection("study_session_records").createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true }),
  ]);
  await db.collection("problem_records").updateOne({ userId: user.id, source: value.source, slug: value.slug }, { $set: { ...value, userId: user.id, updatedAt: new Date() } }, { upsert: true });
  const problem = await db.collection("problem_records").findOne({ userId: user.id, source: value.source, slug: value.slug });
  if (!problem) return NextResponse.json({ error: "Problem could not be saved." }, { status: 500 });
  await db.collection("study_session_records").updateOne({ userId: user.id, idempotencyKey: value.idempotencyKey }, { $set: { userId: user.id, problemId: problem._id, ...value, updatedAt: new Date() } }, { upsert: true });
  const session = await db.collection("study_session_records").findOne({ userId: user.id, idempotencyKey: value.idempotencyKey });
  if (!session) return NextResponse.json({ error: "Session could not be saved." }, { status: 500 });
  return NextResponse.json({ problemId: problem._id.toHexString(), sessionId: session._id.toHexString() });
}
