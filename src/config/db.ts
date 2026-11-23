import { MongoClient, Db } from "mongodb";
import type { Appointment, Service, Transaction, User } from "../types/index.js";

let db: Db | null = null;
let connecting: Promise<Db> | null = null;

// connects once and reuses the same connection (also across serverless requests)
export function connectDB(): Promise<Db> {
  if (db) return Promise.resolve(db);
  if (connecting) return connecting;

  connecting = (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    const client = new MongoClient(uri);
    await client.connect();
    const database = client.db(process.env.DB_NAME || "salonbook");

    // one transaction per Stripe checkout session (protects against duplicate webhook events)
    await database.collection("transactions").createIndex({ stripeSessionId: 1 }, { unique: true });

    console.log("MongoDB connected");
    db = database;
    return database;
  })();

  // allow a retry on the next request if connecting failed
  connecting.catch(() => {
    connecting = null;
  });

  return connecting;
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
