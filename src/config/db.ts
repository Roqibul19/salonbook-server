import { MongoClient, Db } from "mongodb";
import type { Service, User } from "../types/index.js";

let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  const client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.DB_NAME || "salonbook");
  console.log("MongoDB connected");
  return db;
}

function getDB(): Db {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return db;
}

export const collections = {
  users: () => getDB().collection<User>("users"), // managed by Better Auth
  services: () => getDB().collection<Service>("services"),
};
