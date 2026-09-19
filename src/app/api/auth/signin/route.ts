import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, ensureAuthIndexes, verifyPassword } from "@/lib/auth";
import { getMongoDatabase } from "@/lib/mongodb";

const schema = z.object({ identity: z.string().min(3).max(254), password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your email or username and password." }, { status: 400 });
  let db = null;
  try {
    db = await getMongoDatabase();
  } catch {
    return NextResponse.json({ error: "MongoDB Atlas is currently unreachable. Check Network Access in Atlas, then try again." }, { status: 503 });
  }
  if (!db) return NextResponse.json({ error: "The MongoDB connection variable is missing from this deployment." }, { status: 503 });
  await ensureAuthIndexes();
  const identity = parsed.data.identity.trim().toLowerCase();
  const user = await db.collection("users").findOne({ $or: [{ emailNormalized: identity }, { usernameNormalized: identity }] });
  if (!user || typeof user.passwordSalt !== "string" || typeof user.passwordHash !== "string" || !(await verifyPassword(parsed.data.password, user.passwordSalt, user.passwordHash))) {
    return NextResponse.json({ error: "That login does not match an account." }, { status: 401 });
  }
  await createSession(user._id);
  return NextResponse.json({ ok: true });
}
