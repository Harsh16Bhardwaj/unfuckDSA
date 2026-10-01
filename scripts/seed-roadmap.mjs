import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";

nextEnv.loadEnvConfig(process.cwd());

const [email, file, flag] = process.argv.slice(2);
if (!email || !file || (flag && flag !== "--apply")) {
  console.error("Usage: node scripts/seed-roadmap.mjs <account-email> <roadmap.json> [--apply]");
  process.exit(1);
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");

const { phases, notes } = JSON.parse(await readFile(file, "utf8"));
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
if (!Array.isArray(phases) || phases.length === 0 || !Array.isArray(notes) ||
  phases.some((phase) => !phase.id || !phase.title || !datePattern.test(phase.startsOn) || !datePattern.test(phase.endsOn) || phase.startsOn > phase.endsOn || !Array.isArray(phase.topics)) ||
  new Set(phases.map((phase) => phase.id)).size !== phases.length) {
  throw new Error("Roadmap data is incomplete or has duplicate phase IDs.");
}
const ordered = [...phases].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
if (ordered.some((phase, index) => index > 0 && phase.startsOn <= ordered[index - 1].endsOn)) {
  throw new Error("Roadmap phases overlap.");
}

const client = await new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 7000 }).connect();
try {
  const database = client.db("unfuckdsa");
  const user = await database.collection("users").findOne({ emailNormalized: email.toLowerCase() }, { projection: { _id: 1, username: 1 } });
  if (!user) throw new Error("The exact account email was not found.");
  const workspace = await database.collection("workspace_states").findOne({ userId: user._id.toHexString() });
  if (!workspace) throw new Error("This account has no cloud workspace.");
  console.log(JSON.stringify({ account: user.username, phases: ordered.length, first: ordered[0].startsOn, last: ordered.at(-1).endsOn, existingPhases: workspace.state?.roadmapPhases?.length ?? 0, existingSlots: workspace.state?.slots?.length ?? 0, existingProblems: workspace.state?.problems?.length ?? 0, mode: flag === "--apply" ? "apply" : "preview" }));
  if (flag === "--apply") {
    const result = await database.collection("workspace_states").updateOne(
      { _id: workspace._id, revision: workspace.revision },
      { $set: { "state.roadmapPhases": ordered, "state.roadmapNotes": notes, updatedAt: new Date() }, $inc: { revision: 1 } },
    );
    if (result.matchedCount !== 1) throw new Error("Workspace changed during import. Run the command again.");
    console.log("Roadmap saved to this account only.");
  }
} finally {
  await client.close();
}
