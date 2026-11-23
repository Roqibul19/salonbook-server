import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { verifyToken, verifyAdmin } from "../middlewares/auth.js";
import { validateService } from "../utils/validateService.js";
import type { Service } from "../types/index.js";

const router = Router();

// every route in this file is admin only (checked on the server)
router.use(verifyToken, verifyAdmin);

// GET /admin/services - all services (active + inactive)
router.get("/services", async (req: Request, res: Response) => {
  const services = await collections.services().find().sort({ createdAt: -1 }).toArray();
  res.send(services);
});

// GET /admin/services/:id - single service for the edit form
router.get("/services/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    res.status(400).send({ message: "Invalid service ID" });
    return;
  }

  const service = await collections.services().findOne({ _id: new ObjectId(id) });
  if (!service) {
    res.status(404).send({ message: "Service not found" });
    return;
  }
  res.send(service);
});

// POST /admin/services - add a new service
router.post("/services", async (req: Request, res: Response) => {
  const result = validateService(req.body);
  if (!result.ok) {
    res.status(400).send({ message: result.message });
    return;
  }

  const newService: Service = {
    ...(result.data as Omit<Service, "_id" | "createdAt" | "status">),
    status: result.data.status || "active",
    createdAt: new Date(),
  };

  const insertResult = await collections.services().insertOne(newService);
  res.status(201).send({ message: "Service added successfully", insertedId: insertResult.insertedId });
});

// PATCH /admin/services/:id - update service info or status
router.patch("/services/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    res.status(400).send({ message: "Invalid service ID" });
    return;
  }

  const result = validateService(req.body, true);
  if (!result.ok) {
    res.status(400).send({ message: result.message });
    return;
  }

  const updateResult = await collections
    .services()
    .updateOne({ _id: new ObjectId(id) }, { $set: result.data });

  if (updateResult.matchedCount === 0) {
    res.status(404).send({ message: "Service not found" });
    return;
  }
  res.send({ message: "Service updated successfully" });
});

// DELETE /admin/services/:id
router.delete("/services/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    res.status(400).send({ message: "Invalid service ID" });
    return;
  }

  const deleteResult = await collections.services().deleteOne({ _id: new ObjectId(id) });
  if (deleteResult.deletedCount === 0) {
    res.status(404).send({ message: "Service not found" });
    return;
  }
  res.send({ message: "Service deleted successfully" });
});

export default router;
