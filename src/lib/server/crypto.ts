import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function secureToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function tokenHash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function pairingCode() {
  return randomBytes(6).toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-");
}
