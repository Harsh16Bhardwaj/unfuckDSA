import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import {
  getCurrentUser,
  hashPassword,
  verifyPassword,
  createSession,
} from "@/lib/auth";
import { getMongoDatabase } from "@/lib/mongodb";

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json(
      { error: "Use a new password between 10 and 128 characters." },
      { status: 400 },
    );
  const db = await getMongoDatabase();
  if (!db)
    return NextResponse.json(
      { error: "Account service is unavailable. Try again." },
      { status: 503 },
    );
  const id = new ObjectId(user.id);
  const stored = await db.collection("users").findOne({ _id: id });
  if (!stored)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  if (
    stored.passwordLockedUntil &&
    new Date(stored.passwordLockedUntil).getTime() > Date.now()
  )
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  if (
    !(await verifyPassword(
      body.data.currentPassword,
      stored.passwordSalt,
      stored.passwordHash,
    ))
  ) {
    const failures = (stored.passwordFailures ?? 0) + 1;
    await db
      .collection("users")
      .updateOne(
        { _id: id },
        {
          $set: {
            passwordFailures: failures >= 5 ? 0 : failures,
            passwordLockedUntil:
              failures >= 5 ? new Date(Date.now() + 900000) : null,
          },
        },
      );
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 },
    );
  }
  if (body.data.currentPassword === body.data.newPassword)
    return NextResponse.json(
      { error: "Choose a different new password." },
      { status: 400 },
    );
  const password = await hashPassword(body.data.newPassword);
  const changed = await db
    .collection("users")
    .updateOne(
      { _id: id, passwordHash: stored.passwordHash },
      {
        $set: {
          passwordHash: password.hash,
          passwordSalt: password.salt,
          passwordFailures: 0,
          passwordLockedUntil: null,
        },
      },
    );
  if (!changed.modifiedCount)
    return NextResponse.json(
      { error: "Your password changed elsewhere. Sign in again." },
      { status: 409 },
    );
  await db.collection("sessions").deleteMany({ userId: id });
  await createSession(id);
  return NextResponse.json({ ok: true });
}
