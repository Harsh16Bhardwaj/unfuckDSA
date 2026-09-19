import { NextResponse } from "next/server";
import { z } from "zod";
import { getMongoDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

const payload = z.object({ state: z.record(z.string(), z.unknown()), version: z.number().int().positive().default(1) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const userId = user.id;
  const mongo = await getMongoDatabase();
  if (!mongo) return NextResponse.json({ error: "Workspace storage is unavailable." }, { status: 503 });
  const data = await mongo.collection("workspace_states").findOne({ userId }, { projection: { _id: 0, state: 1, version: 1, updatedAt: 1 } });
  return NextResponse.json({ workspace: data });
}

export async function PUT(request: Request) {
  const parsed = payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid workspace state." }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const userId = user.id;
  const mongo = await getMongoDatabase();
  if (!mongo) return NextResponse.json({ error: "Workspace storage is unavailable." }, { status: 503 });
  await mongo.collection("workspace_states").updateOne({ userId }, { $set: { userId, state: parsed.data.state, version: parsed.data.version, updatedAt: new Date() } }, { upsert: true });
  return NextResponse.json({ ok: true });
}
