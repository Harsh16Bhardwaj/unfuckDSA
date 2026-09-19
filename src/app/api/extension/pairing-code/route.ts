import { NextResponse } from "next/server";
import { pairingCode, tokenHash } from "@/lib/server/crypto";
import { getCurrentUser } from "@/lib/auth";
import { getMongoDatabase } from "@/lib/mongodb";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const db = await getMongoDatabase();
  if (!db) return NextResponse.json({ error: "Pairing storage is unavailable." }, { status: 503 });
  const code = pairingCode();
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.collection("extension_pairing_codes").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("extension_pairing_codes").insertOne({ userId: user.id, codeHash: tokenHash(code), expiresAt, createdAt: new Date() });
  return NextResponse.json({ code, expiresAt });
}
