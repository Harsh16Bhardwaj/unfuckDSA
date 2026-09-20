import { NextResponse } from "next/server";
import { z } from "zod";
import { secureToken, tokenHash } from "@/lib/server/crypto";
import { getMongoDatabase } from "@/lib/mongodb";

const schema = z.object({ code: z.string().min(8).max(30), name: z.string().min(1).max(80) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid pairing request." }, { status: 400 });
  const db = await getMongoDatabase();
  if (!db) return NextResponse.json({ error: "Pairing storage is unavailable." }, { status: 503 });
  const now = new Date();
  const pairing = await db.collection("extension_pairing_keys").findOne({ codeHash: tokenHash(parsed.data.code.toUpperCase()) });
  if (!pairing) return NextResponse.json({ error: "Pairing key is invalid." }, { status: 403 });
  const rawToken = secureToken();
  await db.collection("extension_devices").createIndex({ tokenHash: 1 }, { unique: true });
  const device = await db.collection("extension_devices").insertOne({ userId: pairing.userId, name: parsed.data.name, tokenHash: tokenHash(rawToken), lastSeenAt: now, createdAt: now });
  return NextResponse.json({ token: rawToken, deviceId: device.insertedId.toHexString() });
}
