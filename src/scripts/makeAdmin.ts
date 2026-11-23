// Securely give admin role to an existing user (run from terminal only).
// Usage: npm run make-admin -- user@example.com
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ quiet: true });

async function makeAdmin() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Please provide an email. Example: npm run make-admin -- admin@salonbook.com");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not defined in .env");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const users = client.db(process.env.DB_NAME || "salonbook").collection("users");

    const result = await users.updateOne({ email }, { $set: { role: "admin", isBlocked: false } });

    if (result.matchedCount === 0) {
      console.error(`No user found with email: ${email}. Sign up first, then run this again.`);
      process.exitCode = 1;
    } else {
      console.log(`${email} is now an admin.`);
    }
  } finally {
    await client.close();
  }
}

makeAdmin();
