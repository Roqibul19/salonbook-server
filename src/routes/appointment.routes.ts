import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { verifyToken, verifyCustomer } from "../middlewares/auth.js";
import { TIME_SLOTS } from "../utils/constants.js";
import { addDays, isValidDateString, todayString } from "../utils/date.js";
import type { Appointment } from "../types/index.js";

const router = Router();

const MAX_DAYS_AHEAD = 60;
const ACTIVE_STATUSES: Appointment["status"][] = ["pending", "confirmed"];

// GET /appointments/booked-slots?serviceId=...&date=YYYY-MM-DD
// Public helper for the booking form: which time slots are already taken
router.get("/booked-slots", async (req: Request, res: Response) => {
  const { serviceId, date } = req.query;

  if (typeof serviceId !== "string" || !ObjectId.isValid(serviceId)) {
    res.status(400).send({ message: "Invalid service ID" });
    return;
  }
  if (typeof date !== "string" || !isValidDateString(date)) {
    res.status(400).send({ message: "Invalid date" });
    return;
  }

  const booked = await collections
    .appointments()
    .find(
      { serviceId: new ObjectId(serviceId), appointmentDate: date, status: { $in: ACTIVE_STATUSES } },
      { projection: { timeSlot: 1 } }
    )
    .toArray();

  res.send(booked.map((a) => a.timeSlot));
});

// everything below needs a logged-in customer
router.use(verifyToken, verifyCustomer);

// POST /appointments - customer submits an appointment request
router.post("/", async (req: Request, res: Response) => {
  const customerId = new ObjectId(req.user!.id);
  const { serviceId, appointmentDate, timeSlot } = req.body ?? {};
  const message = String(req.body?.message ?? "").trim().slice(0, 500);

  // 1. validate input
  if (typeof serviceId !== "string" || !ObjectId.isValid(serviceId)) {
    res.status(400).send({ message: "Invalid service ID" });
    return;
  }
  if (typeof appointmentDate !== "string" || !isValidDateString(appointmentDate)) {
    res.status(400).send({ message: "Please select a valid appointment date" });
    return;
  }

  const today = todayString();
  if (appointmentDate < today) {
    res.status(400).send({ message: "Appointment date cannot be in the past" });
    return;
  }
  if (appointmentDate > addDays(today, MAX_DAYS_AHEAD)) {
    res.status(400).send({ message: `You can book up to ${MAX_DAYS_AHEAD} days in advance` });
    return;
  }
  if (!(TIME_SLOTS as readonly string[]).includes(timeSlot)) {
    res.status(400).send({ message: "Please select a valid time slot" });
    return;
  }

  // 2. only active services can be booked
  const service = await collections.services().findOne({ _id: new ObjectId(serviceId) });
  if (!service) {
    res.status(404).send({ message: "Service not found" });
    return;
  }
  if (service.status !== "active") {
    res.status(400).send({ message: "This service is not available for booking" });
    return;
  }

  // 3. prevent duplicate active appointments for the same date and time slot
  const slotTaken = await collections.appointments().findOne({
    serviceId: service._id,
    appointmentDate,
    timeSlot,
    status: { $in: ACTIVE_STATUSES },
  });
  if (slotTaken) {
    res.status(409).send({ message: "This time slot is already booked. Please choose another one." });
    return;
  }

  const customerBusy = await collections.appointments().findOne({
    customerId,
    appointmentDate,
    timeSlot,
    status: { $in: ACTIVE_STATUSES },
  });
  if (customerBusy) {
    res.status(409).send({ message: "You already have an appointment at this date and time." });
    return;
  }

  // 4. save with default statuses
  const appointment: Appointment = {
    serviceId: service._id!,
    customerId,
    appointmentDate,
    timeSlot,
    message,
    servicePrice: service.price,
    paymentStatus: "unpaid",
    status: "pending",
    createdAt: new Date(),
  };

  const result = await collections.appointments().insertOne(appointment);
  res.status(201).send({ message: "Appointment request submitted successfully", insertedId: result.insertedId });
});

// GET /appointments/my - the logged-in customer's own appointments
router.get("/my", async (req: Request, res: Response) => {
  const appointments = await collections
    .appointments()
    .aggregate([
      { $match: { customerId: new ObjectId(req.user!.id) } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          as: "service",
          pipeline: [{ $project: { serviceName: 1, image: 1, category: 1, duration: 1 } }],
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  res.send(appointments);
});

// PATCH /appointments/:id/cancel - customer cancels their own PENDING request
router.patch("/:id/cancel", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    res.status(400).send({ message: "Invalid appointment ID" });
    return;
  }

  const appointment = await collections.appointments().findOne({
    _id: new ObjectId(id),
    customerId: new ObjectId(req.user!.id), // only their own
  });

  if (!appointment) {
    res.status(404).send({ message: "Appointment not found" });
    return;
  }
  if (appointment.status !== "pending") {
    res.status(400).send({ message: `A ${appointment.status} appointment cannot be cancelled` });
    return;
  }

  await collections
    .appointments()
    .updateOne({ _id: appointment._id, status: "pending" }, { $set: { status: "cancelled" } });

  res.send({ message: "Appointment cancelled successfully" });
});

export default router;
