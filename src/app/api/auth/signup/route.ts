import { NextResponse } from "next/server";
import { z } from "zod";
import { getMongoDatabase } from "@/lib/mongodb";
import { createSession, ensureAuthIndexes, hashPassword } from "@/lib/auth";

const schema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the supplied account details." }, { status: 400 });
  let db = null;
  try { db = await getMongoDatabase(); } catch { /* handled as unavailable below */ }
  if (!db) return NextResponse.json({ error: "Account storage is not configured." }, { status: 503 });
  try {
    await ensureAuthIndexes();
    const { salt, hash } = await hashPassword(parsed.data.password);
    const result = await db.collection("users").insertOne({
      email: parsed.data.email.trim(),
      emailNormalized: parsed.data.email.trim().toLowerCase(),
      username: parsed.data.username.trim(),
      usernameNormalized: parsed.data.username.trim().toLowerCase(),
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date(),
    });
    await createSession(result.insertedId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const duplicate = error && typeof error === "object" && "code" in error && error.code === 11000;
    return NextResponse.json({ error: duplicate ? "That email or username is already in use." : "Could not create the account." }, { status: duplicate ? 409 : 500 });
  }
}
