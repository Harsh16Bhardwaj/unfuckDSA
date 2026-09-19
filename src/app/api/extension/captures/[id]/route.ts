import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getMongoDatabase } from "@/lib/mongodb";

export async function GET(_request: Request, context: RouteContext<"/api/extension/captures/[id]">) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Capture was not found." }, { status: 404 });
  const db = await getMongoDatabase();
  if (!db) return NextResponse.json({ error: "Capture storage is unavailable." }, { status: 503 });
  const data = await db.collection("extension_captures").findOne({ _id: new ObjectId(id), userId: user.id });
  if (!data) return NextResponse.json({ error: "Capture was not found." }, { status: 404 });
  if (!data.consumedAt) await db.collection("extension_captures").updateOne({ _id: data._id }, { $set: { consumedAt: new Date() } });
  return NextResponse.json({ id, title: data.title, url: data.url, active_minutes: data.activeMinutes, code: data.code, consumed_at: data.consumedAt });
}
