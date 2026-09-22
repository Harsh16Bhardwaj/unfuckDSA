import { NextResponse } from "next/server";
import { z } from "zod";
import { getMongoDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import type { AppState } from "@/lib/domain";
import { mergeWorkspaceStates } from "@/lib/workspace-merge";

const payload = z.object({ state: z.record(z.string(), z.unknown()), version: z.number().int().positive().default(1) });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const userId = user.id;
  const mongo = await getMongoDatabase();
  if (!mongo) return NextResponse.json({ error: "Workspace storage is unavailable." }, { status: 503 });
  const data = await mongo.collection("workspace_states").findOne({ userId }, { projection: { _id: 0, state: 1, version: 1, revision: 1, updatedAt: 1 } });
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
  const states = mongo.collection("workspace_states");
  await states.createIndex({ userId: 1 }, { unique: true });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await states.findOne({ userId });
    const revision = typeof current?.revision === "number" ? current.revision : 0;
    const state = mergeWorkspaceStates(
      current?.state as Partial<AppState> | undefined,
      parsed.data.state as Partial<AppState>,
    );
    const filter = current
      ? { _id: current._id, ...(revision ? { revision } : { revision: { $exists: false } }) }
      : { userId, revision: { $exists: false } };
    try {
      const result = await states.updateOne(
        filter,
        { $set: { userId, state, version: parsed.data.version, revision: revision + 1, updatedAt: new Date() } },
        { upsert: !current },
      );
      if (result.matchedCount || result.upsertedCount) {
        return NextResponse.json({ ok: true, workspace: { state, version: parsed.data.version, revision: revision + 1 } });
      }
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("E11000")) throw error;
    }
  }

  return NextResponse.json({ error: "Workspace changed concurrently. Retry the save." }, { status: 409 });
}
