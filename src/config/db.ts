import { MongoClient, Db } from "mongodb";
import type { Appointment, Service, Transaction, User } from "../types/index.js";

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

  // one transaction per Stripe checkout session (protects against duplicate webhook events)
  await db.collection("transactions").createIndex({ stripeSessionId: 1 }, { unique: true });

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
  appointments: () => getDB().collection<Appointment>("appointments"),
  transactions: () => getDB().collection<Transaction>("transactions"),
  sessions: () => getDB().collection("session"), // managed by Better Auth
};
