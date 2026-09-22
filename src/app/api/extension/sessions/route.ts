import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMongoDatabase } from "@/lib/mongodb";
import { tokenHash } from "@/lib/server/crypto";

const sessionSchema = z.object({
  id: z.string().min(8).max(160),
  title: z.string().min(1).max(240),
  url: z.url().max(1000),
  startedAt: z.number().int().nonnegative(),
  activeMinutes: z.number().int().positive().max(1440),
  code: z.string().max(100_000),
  finishedAt: z.iso.datetime(),
  skipRevision: z.boolean(),
  status: z.enum(["solved_independently", "solved_with_hints", "stuck", "stopped"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  priority: z.enum(["normal", "high"]),
  revisionMinutes: z.union([z.literal(10), z.literal(20), z.literal(30)]),
  template: z.enum(["default", "relaxed", "custom"]),
  topics: z.array(z.string().max(80)).max(20),
  approach: z.string().max(20_000),
  blocker: z.string().max(20_000),
  hint: z.string().max(20_000),
  notes: z.string().max(40_000),
  needsVisual: z.boolean(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const db = await getMongoDatabase();
  if (!db) return NextResponse.json({ error: "Session storage is unavailable." }, { status: 503 });
  const records = await db
    .collection("extension_session_records")
    .find({ userId: user.id }, { projection: { _id: 0, userId: 0, deviceId: 0, createdAt: 0, updatedAt: 0 } })
    .sort({ finishedAt: -1 })
    .limit(1000)
    .toArray();
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return NextResponse.json({ error: "Device token required." }, { status: 401 });
  const parsed = sessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid extension session." }, { status: 400 });
  const db = await getMongoDatabase();
  if (!db) return NextResponse.json({ error: "Session storage is unavailable." }, { status: 503 });
  const device = await db.collection("extension_devices").findOne({ tokenHash: tokenHash(bearer), revokedAt: { $exists: false } });
  if (!device) return NextResponse.json({ error: "Device is not paired." }, { status: 401 });

  const records = db.collection("extension_session_records");
  await records.createIndex({ userId: 1, id: 1 }, { unique: true });
  const now = new Date();
  await records.updateOne(
    { userId: device.userId, id: parsed.data.id },
    {
      $setOnInsert: { userId: device.userId, deviceId: device._id, createdAt: now },
      $set: { ...parsed.data, updatedAt: now },
    },
    { upsert: true },
  );
  await db.collection("extension_devices").updateOne({ _id: device._id }, { $set: { lastSeenAt: now } });
  return NextResponse.json({ ok: true, id: parsed.data.id });
}
