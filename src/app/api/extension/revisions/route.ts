import { NextResponse } from "next/server";
import { z } from "zod";
import { getMongoDatabase } from "@/lib/mongodb";
import { tokenHash } from "@/lib/server/crypto";
import { completeRevision } from "@/lib/revisions";
import type { AppState } from "@/lib/domain";

const completionPayload = z.object({
  scheduleId: z.string().min(1),
  completedAt: z.string().datetime().optional(),
  outcome: z.enum(["again", "hard", "good", "easy"]).default("good"),
});

async function pairedDevice(request: Request) {
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return null;
  const mongo = await getMongoDatabase();
  if (!mongo) return null;
  const device = await mongo.collection("extension_devices").findOne({
    tokenHash: tokenHash(bearer),
    revokedAt: { $exists: false },
  });
  if (!device) return null;
  await mongo
    .collection("extension_devices")
    .updateOne({ _id: device._id }, { $set: { lastSeenAt: new Date() } });
  return { mongo, device };
}

function localDateKey(value: string, timezoneOffset: number) {
  const shifted = new Date(value).getTime() - timezoneOffset * 60_000;
  return new Date(shifted).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const pairing = await pairedDevice(request);
  if (!pairing)
    return NextResponse.json(
      { error: "Pair the extension to load revisions." },
      { status: 401 },
    );
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get("date");
  const timezoneOffset = Number(url.searchParams.get("timezoneOffset") ?? 0);
  if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))
    return NextResponse.json({ error: "A valid local date is required." }, { status: 400 });

  const workspace = await pairing.mongo
    .collection("workspace_states")
    .findOne({ userId: pairing.device.userId }, { projection: { _id: 0, state: 1 } });
  const state = workspace?.state as AppState | undefined;
  if (!state) return NextResponse.json({ revisions: [] });
  const slots = new Map(state.slots.map((slot) => [slot.id, slot]));
  const problems = new Map(state.problems.map((problem) => [problem.id, problem]));
  const revisions = state.scheduled
    .filter((item) => {
      const slot = slots.get(item.slotId);
      return (
        item.status === "planned" &&
        slot &&
        localDateKey(slot.startsAt, timezoneOffset) === requestedDate
      );
    })
    .map((item) => {
      const problem = problems.get(item.problemId);
      const slot = slots.get(item.slotId)!;
      return {
        scheduleId: item.id,
        problemId: item.problemId,
        title: problem?.title ?? "Revision",
        slug: problem?.slug ?? "",
        url: problem?.url ??
          (problem?.slug
            ? `https://leetcode.com/problems/${problem.slug}/`
            : ""),
        difficulty: problem?.difficulty ?? "medium",
        topics: problem?.topics ?? [],
        minutes: item.minutes,
        reason: item.reason,
        priorityScore: item.priorityScore,
        startsAt: slot.startsAt,
      };
    })
    .filter((item) => item.url)
    .sort(
      (a, b) =>
        a.startsAt.localeCompare(b.startsAt) ||
        b.priorityScore - a.priorityScore,
    );

  return NextResponse.json({ revisions });
}

export async function POST(request: Request) {
  const pairing = await pairedDevice(request);
  if (!pairing)
    return NextResponse.json(
      { error: "Pair the extension to complete revisions." },
      { status: 401 },
    );
  const parsed = completionPayload.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid revision completion." }, { status: 400 });

  const workspace = await pairing.mongo
    .collection("workspace_states")
    .findOne({ userId: pairing.device.userId });
  const state = workspace?.state as AppState | undefined;
  const scheduled = state?.scheduled.find(
    (item) =>
      item.id === parsed.data.scheduleId && item.status === "planned",
  );
  if (!state || !scheduled)
    return NextResponse.json(
      { error: "This revision is no longer pending." },
      { status: 409 },
    );

  const completedAt = parsed.data.completedAt
    ? new Date(parsed.data.completedAt)
    : new Date();
  const next = completeRevision(
    state,
    scheduled.problemId,
    scheduled.id,
    completedAt,
    parsed.data.outcome,
  );
  await pairing.mongo.collection("workspace_states").updateOne(
    { userId: pairing.device.userId },
    {
      $set: {
        state: next,
        version: Math.max(2, Number(workspace?.version ?? 2)),
        updatedAt: new Date(),
      },
    },
  );
  return NextResponse.json({ ok: true, problemId: scheduled.problemId });
}
