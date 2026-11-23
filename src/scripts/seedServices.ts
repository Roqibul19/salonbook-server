// Adds sample salon services (only if the services collection is empty).
// Usage: npm run seed
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import type { Service } from "../types/index.js";

dotenv.config({ quiet: true });

const now = Date.now();
// give each service a slightly different createdAt so "newest first" sorting is stable
const at = (i: number) => new Date(now - i * 60_000);

const services: Omit<Service, "_id">[] = [
  {
    serviceName: "Signature Haircut & Blow-Dry",
    category: "Haircut & Styling",
    description:
      "A personalised consultation, precision haircut and a smooth, bouncy blow-dry finish tailored to your face shape and lifestyle.",
    price: 25,
    duration: 45,
    image: "https://i.ibb.co/7tVrSLQp/salonbook-cut.jpg",
    status: "active",
    createdAt: at(0),
  },
  {
    serviceName: "Men's Classic Cut",
    category: "Haircut & Styling",
    description:
      "Clean, sharp and timeless. Includes wash, scissor or clipper cut, neck shave and styling with premium products.",
    price: 15,
    duration: 30,
    image: "https://i.ibb.co/bM5tv1n6/salonbook-men.jpg",
    status: "active",
    createdAt: at(1),
  },
  {
    serviceName: "Full Hair Coloring",
    category: "Hair Coloring",
    description:
      "Rich, long-lasting all-over color using ammonia-free formulas, finished with a nourishing gloss for extra shine.",
    price: 60,
    duration: 120,
    image: "https://i.ibb.co/Kxn8sKzD/salonbook-color.jpg",
    status: "active",
    createdAt: at(2),
  },
  {
    serviceName: "Balayage Highlights",
    category: "Hair Coloring",
    description:
      "Hand-painted, sun-kissed highlights that grow out softly and naturally. Includes toner and blow-dry.",
    price: 85,
    duration: 150,
    image: "https://i.ibb.co/sdFByYzx/salonbook-balayage.jpg",
    status: "active",
    createdAt: at(3),
  },
  {
    serviceName: "Keratin Smoothing Treatment",
    category: "Hair Treatment",
    description:
      "Tames frizz and adds mirror-like shine for up to three months. Ideal for thick, curly or unmanageable hair.",
    price: 90,
    duration: 120,
    image: "https://i.ibb.co/qF0nwrVD/salonbook-keratin.jpg",
    status: "active",
    createdAt: at(4),
  },
  {
    serviceName: "Hydrating Glow Facial",
    category: "Facial & Skincare",
    description:
      "Deep cleansing, gentle exfoliation and a hydrating mask that leaves skin plump, fresh and glowing.",
    price: 40,
    duration: 60,
    image: "https://i.ibb.co/8gzBY9xg/salonbook-hydra.jpg",
    status: "active",
    createdAt: at(5),
  },
  {
    serviceName: "Deep Cleansing Facial",
    category: "Facial & Skincare",
    description:
      "Targets clogged pores and excess oil with steam, extractions and a purifying clay mask.",
    price: 35,
    duration: 50,
    image: "https://i.ibb.co/Ldb5zpmS/salonbook-deep.jpg",
    status: "active",
    createdAt: at(6),
  },
  {
    serviceName: "Bridal Makeup",
    category: "Makeup",
    description:
      "Long-wear, camera-ready bridal look with skin prep, lashes and a trial consultation to perfect your style.",
    price: 120,
    duration: 150,
    image: "https://i.ibb.co/tp9xHKxp/salonbook-bridal.jpg",
    status: "active",
    createdAt: at(7),
  },
  {
    serviceName: "Party Makeup",
    category: "Makeup",
    description:
      "A glamorous yet comfortable look for parties and special events, from soft glam to bold evening styles.",
    price: 45,
    duration: 60,
    image: "https://i.ibb.co/9mJgRP66/salonbook-party.jpg",
    status: "active",
    createdAt: at(8),
  },
  {
    serviceName: "Classic Manicure & Pedicure",
    category: "Manicure & Pedicure",
    description:
      "Nail shaping, cuticle care, relaxing hand and foot massage, and a polish color of your choice.",
    price: 30,
    duration: 60,
    image: "https://i.ibb.co/4nR4832k/salonbook-mani.jpg",
    status: "active",
    createdAt: at(9),
  },
  {
    serviceName: "Gel Nail Art",
    category: "Manicure & Pedicure",
    description:
      "Chip-resistant gel polish with custom nail art designs that last up to three weeks.",
    price: 25,
    duration: 45,
    image: "https://i.ibb.co/PvsQ80PR/salonbook-gel.jpg",
    status: "inactive",
    createdAt: at(10),
  },
  {
    serviceName: "Relaxing Full Body Massage",
    category: "Spa & Massage",
    description:
      "A soothing Swedish massage with warm aromatic oils to release tension and restore calm.",
    price: 55,
    duration: 60,
    image: "https://i.ibb.co/601WXrmd/salonbook-massage.jpg",
    status: "active",
    createdAt: at(11),
  },
  {
    serviceName: "Hot Stone Therapy",
    category: "Spa & Massage",
    description:
      "Heated basalt stones melt away deep muscle tension for complete relaxation of body and mind.",
    price: 70,
    duration: 75,
    image: "https://i.ibb.co/5XCjV1c0/salonbook-stone.jpg",
    status: "active",
    createdAt: at(12),
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not defined in .env");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const collection = client
      .db(process.env.DB_NAME || "salonbook")
      .collection<Omit<Service, "_id">>("services");

    const count = await collection.countDocuments();
    if (count > 0) {
      console.log(`Services collection already has ${count} services. Nothing added.`);
      return;
    }

    const result = await collection.insertMany(services);
    console.log(`Added ${result.insertedCount} sample services.`);
  } finally {
    await client.close();
  }
}

seed();
