import { NextResponse } from "next/server";
import { deleteCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  await deleteCurrentSession();
  return NextResponse.json({ ok: true, redirectTo: new URL("/login", request.url).toString() });
}
