import { NextResponse } from "next/server";
import { z } from "zod";
import { tokenHash } from "@/lib/server/crypto";
import { getMongoDatabase } from "@/lib/mongodb";

const schema = z.object({
  idempotencyKey: z.string().min(8).max(150),
  title: z.string().min(1).max(240),
  url: z.url(),
  activeMinutes: z.number().int().positive().max(1440),
  code: z.string().max(100_000).optional(),
});

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return NextResponse.json({ error: "Device token required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid capture payload." }, { status: 400 });
  const db = await getMongoDatabase();
  if (!db) return NextResponse.json({ error: "Capture storage is unavailable." }, { status: 503 });
  const device = await db.collection("extension_devices").findOne({ tokenHash: tokenHash(bearer), revokedAt: { $exists: false } });
  if (!device) return NextResponse.json({ error: "Device is not paired." }, { status: 401 });
  const now = new Date();
  await db.collection("extension_devices").updateOne({ _id: device._id }, { $set: { lastSeenAt: now } });
  await db.collection("extension_captures").createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true });
  await db.collection("extension_captures").updateOne({ userId: device.userId, idempotencyKey: parsed.data.idempotencyKey }, { $setOnInsert: { userId: device.userId, deviceId: device._id, idempotencyKey: parsed.data.idempotencyKey, createdAt: now }, $set: { title: parsed.data.title, url: parsed.data.url, activeMinutes: parsed.data.activeMinutes, code: parsed.data.code } }, { upsert: true });
  const capture = await db.collection("extension_captures").findOne({ userId: device.userId, idempotencyKey: parsed.data.idempotencyKey });
  if (!capture) return NextResponse.json({ error: "Capture could not be stored." }, { status: 500 });
  return NextResponse.json({ captureId: capture._id.toHexString() });
}
