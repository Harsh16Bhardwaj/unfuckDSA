import "server-only";

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { getMongoDatabase } from "./mongodb";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "unfuckdsa_session";
const SESSION_DAYS = 30;

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

type UserDocument = {
  _id: ObjectId;
  email: string;
  emailNormalized: string;
  username: string;
  usernameNormalized: string;
  passwordHash: string;
  passwordSalt: string;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function database() {
  const db = await getMongoDatabase();
  if (!db) throw new Error("Account storage is not configured.");
  return db;
}

export async function ensureAuthIndexes() {
  const db = await database();
  await Promise.all([
    db.collection("users").createIndex({ emailNormalized: 1 }, { unique: true }),
    db.collection("users").createIndex({ usernameNormalized: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("workspace_states").createIndex({ userId: 1 }, { unique: true }),
  ]);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return { salt, hash: derived.toString("hex") };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function createSession(userId: ObjectId) {
  const db = await database();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.collection("sessions").insertOne({ tokenHash: tokenHash(token), userId, createdAt: new Date(), expiresAt });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const db = await getMongoDatabase();
  if (!db) return null;
  const session = await db.collection("sessions").findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
  if (!session || !(session.userId instanceof ObjectId)) return null;
  const user = await db.collection<UserDocument>("users").findOne({ _id: session.userId });
  if (!user) return null;
  return { id: user._id.toHexString(), email: user.email, username: user.username };
}

export async function deleteCurrentSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const db = await getMongoDatabase();
  if (token && db) await db.collection("sessions").deleteOne({ tokenHash: tokenHash(token) });
  jar.delete(COOKIE_NAME);
}
