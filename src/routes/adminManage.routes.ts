import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { verifyToken, verifyAdmin } from "../middlewares/auth.js";

const router = Router();

// every route in this file is admin only (checked on the server)
router.use(verifyToken, verifyAdmin);

// GET /admin/stats - numbers for the admin overview
router.get("/stats", async (req: Request, res: Response) => {
  const [totalCustomers, activeServices, totalAppointments, pending, confirmed, successfulPayments] =
    await Promise.all([
      collections.users().countDocuments({ role: { $ne: "admin" } }),
      collections.services().countDocuments({ status: "active" }),
      collections.appointments().countDocuments(),
      collections.appointments().countDocuments({ status: "pending" }),
      collections.appointments().countDocuments({ status: "confirmed" }),
      collections.transactions().countDocuments({ status: "paid" }),
    ]);

  res.send({ totalCustomers, activeServices, totalAppointments, pending, confirmed, successfulPayments });
});

// ---------------- appointments ----------------

// GET /admin/appointments?status=pending - all appointment requests with customer + service info
router.get("/appointments", async (req: Request, res: Response) => {
  const { status } = req.query;
  const match: Record<string, unknown> = {};
  if (status === "pending" || status === "confirmed" || status === "cancelled") match.status = status;

  const appointments = await collections
    .appointments()
    .aggregate([
      { $match: match },
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
      {
        $lookup: {
          from: "users",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
          pipeline: [{ $project: { name: 1, email: 1, image: 1, phone: 1 } }],
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  res.send(appointments);
});

// PATCH /admin/appointments/:id/confirm - only pending appointments can be confirmed
router.patch("/appointments/:id/confirm", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    res.status(400).send({ message: "Invalid appointment ID" });
    return;
  }

  const result = await collections
    .appointments()
    .updateOne({ _id: new ObjectId(id), status: "pending" }, { $set: { status: "confirmed" } });

  if (result.matchedCount === 0) {
    const exists = await collections.appointments().findOne({ _id: new ObjectId(id) });
    res
      .status(exists ? 400 : 404)
      .send({ message: exists ? `A ${exists.status} appointment cannot be confirmed` : "Appointment not found" });
    return;
  }

  res.send({ message: "Appointment confirmed" });
});

// PATCH /admin/appointments/:id/cancel - pending or confirmed (not paid) appointments
router.patch("/appointments/:id/cancel", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    res.status(400).send({ message: "Invalid appointment ID" });
    return;
  }

  const appointment = await collections.appointments().findOne({ _id: new ObjectId(id) });
  if (!appointment) {
    res.status(404).send({ message: "Appointment not found" });
    return;
  }
  if (appointment.status === "cancelled") {
    res.status(400).send({ message: "This appointment is already cancelled" });
    return;
  }
  if (appointment.paymentStatus === "paid") {
    res.status(400).send({ message: "A paid appointment cannot be cancelled here" });
    return;
  }

  await collections
    .appointments()
    .updateOne(
      { _id: appointment._id, status: { $in: ["pending", "confirmed"] }, paymentStatus: "unpaid" },
      { $set: { status: "cancelled" } }
    );

  res.send({ message: "Appointment cancelled" });
});

// ---------------- transactions ----------------

// GET /admin/transactions - read only (payment records are written only by the Stripe webhook)
router.get("/transactions", async (req: Request, res: Response) => {
  const transactions = await collections
    .transactions()
    .aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
          pipeline: [{ $project: { name: 1, email: 1, image: 1 } }],
        },
      },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
          pipeline: [
            { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "service" } },
            { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
            { $project: { appointmentDate: 1, timeSlot: 1, serviceName: "$service.serviceName" } },
          ],
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  res.send(transactions);
});

// ---------------- users ----------------

// GET /admin/users - all registered customers
router.get("/users", async (req: Request, res: Response) => {
  const users = await collections
    .users()
    .aggregate([
      { $match: { role: { $ne: "admin" } } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "appointments",
          localField: "_id",
          foreignField: "customerId",
          as: "appointments",
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          image: 1,
          phone: 1,
          role: 1,
          isBlocked: 1,
          createdAt: 1,
          appointmentCount: { $size: "$appointments" },
        },
      },
    ])
    .toArray();

  res.send(users);
});

// PATCH /admin/users/:id/block  and  /admin/users/:id/unblock
async function setBlocked(req: Request<{ id: string }>, res: Response, isBlocked: boolean) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    res.status(400).send({ message: "Invalid user ID" });
    return;
  }
  if (id === req.user!.id) {
    res.status(400).send({ message: "You cannot change your own status" });
    return;
  }

  const user = await collections.users().findOne({ _id: new ObjectId(id) });
  if (!user) {
    res.status(404).send({ message: "User not found" });
    return;
  }
  if (user.role === "admin") {
    res.status(400).send({ message: "Admin accounts cannot be blocked" });
    return;
  }

  await collections.users().updateOne({ _id: user._id }, { $set: { isBlocked } });

  // log the user out everywhere when blocked
  if (isBlocked) {
    await collections.sessions().deleteMany({ userId: user._id });
  }

  res.send({ message: isBlocked ? "User blocked" : "User unblocked" });
}

router.patch("/users/:id/block", (req: Request<{ id: string }>, res: Response) => setBlocked(req, res, true));
router.patch("/users/:id/unblock", (req: Request<{ id: string }>, res: Response) => setBlocked(req, res, false));

export default router;
