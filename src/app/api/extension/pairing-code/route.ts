import { NextResponse } from "next/server";
import { pairingCode, tokenHash } from "@/lib/server/crypto";
import { getCurrentUser } from "@/lib/auth";
import { getMongoDatabase } from "@/lib/mongodb";

async function getOrCreatePairingKey() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const db = await getMongoDatabase();
  if (!db) return NextResponse.json({ error: "Pairing storage is unavailable." }, { status: 503 });
  await Promise.all([
    db.collection("extension_pairing_keys").createIndex({ userId: 1 }, { unique: true }),
    db.collection("extension_pairing_keys").createIndex({ codeHash: 1 }, { unique: true }),
  ]);
  const code = pairingCode();
  const pairing = await db.collection("extension_pairing_keys").findOneAndUpdate(
    { userId: user.id },
    {
      $setOnInsert: {
        userId: user.id,
        code,
        codeHash: tokenHash(code),
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  return NextResponse.json({ code: pairing?.code ?? code });
}

export const GET = getOrCreatePairingKey;
export const POST = getOrCreatePairingKey;
