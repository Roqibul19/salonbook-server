import { Router, Request, Response } from "express";
import { ObjectId, Filter, Sort } from "mongodb";
import { collections } from "../config/db.js";
import { SERVICE_CATEGORIES } from "../utils/constants.js";
import type { Service } from "../types/index.js";

const router = Router();

// escape special regex characters so user search text is treated as plain text
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /services?search=&category=&sort=price_asc|price_desc&limit=
// Public: only active services
router.get("/", async (req: Request, res: Response) => {
  const { search, category, sort, limit } = req.query;

  const filter: Filter<Service> = { status: "active" };

  if (typeof search === "string" && search.trim()) {
    filter.serviceName = { $regex: escapeRegex(search.trim()), $options: "i" };
  }

  if (typeof category === "string" && category.trim()) {
    filter.category = category.trim();
  }

  let sortBy: Sort = { createdAt: -1 };
  if (sort === "price_asc") sortBy = { price: 1 };
  if (sort === "price_desc") sortBy = { price: -1 };

  let cursor = collections.services().find(filter).sort(sortBy);

  const limitNumber = Number(limit);
  if (Number.isInteger(limitNumber) && limitNumber > 0) {
    cursor = cursor.limit(limitNumber);
  }

  const services = await cursor.toArray();
  res.send(services);
});

// GET /services/categories
// Public: all categories with number of active services in each
router.get("/categories", async (req: Request, res: Response) => {
  const counts = await collections
    .services()
    .aggregate<{ _id: string; count: number }>([
      { $match: { status: "active" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ])
    .toArray();

  const result = SERVICE_CATEGORIES.map((name) => ({
    name,
    count: counts.find((c) => c._id === name)?.count || 0,
  }));

  res.send(result);
});

// GET /services/:id
// Public: single active service
router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    res.status(400).send({ message: "Invalid service ID" });
    return;
  }

  const service = await collections
    .services()
    .findOne({ _id: new ObjectId(id), status: "active" });

  if (!service) {
    res.status(404).send({ message: "Service not found or not available" });
    return;
  }

  res.send(service);
});

export default router;
