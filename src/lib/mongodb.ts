import "server-only";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
let clientPromise: Promise<MongoClient> | undefined;

export function getMongoDatabase() {
  if (!uri) return null;
  clientPromise ??= new MongoClient(uri).connect();
  return clientPromise.then((client) => client.db("unfuckdsa"));
}
