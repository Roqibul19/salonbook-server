import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { CURRENCY, getStripe } from "../config/stripe.js";
import { verifyToken, verifyCustomer } from "../middlewares/auth.js";

const router = Router();

router.use(verifyToken, verifyCustomer);

// POST /payments/create-checkout-session  { appointmentId }
// Only a CONFIRMED + UNPAID appointment of the logged-in customer can be paid
router.post("/create-checkout-session", async (req: Request, res: Response) => {
  const { appointmentId } = req.body ?? {};
  if (typeof appointmentId !== "string" || !ObjectId.isValid(appointmentId)) {
    res.status(400).send({ message: "Invalid appointment ID" });
    return;
  }

  const customerId = new ObjectId(req.user!.id);
  const appointment = await collections.appointments().findOne({ _id: new ObjectId(appointmentId), customerId });

  if (!appointment) {
    res.status(404).send({ message: "Appointment not found" });
    return;
  }
  if (appointment.paymentStatus === "paid") {
    res.status(400).send({ message: "This appointment is already paid" });
    return;
  }
  if (appointment.status !== "confirmed") {
    res.status(400).send({ message: `You cannot pay for a ${appointment.status} appointment` });
    return;
  }

  const service = await collections.services().findOne({ _id: appointment.serviceId });
  const clientUrl = process.env.CLIENT_URL;

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: req.user!.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: Math.round(appointment.servicePrice * 100), // cents
          product_data: {
            name: service?.serviceName || "Salon appointment",
            description: `${appointment.appointmentDate} at ${appointment.timeSlot}`,
            ...(service?.image ? { images: [service.image] } : {}),
          },
        },
      },
    ],
    metadata: {
      appointmentId: appointment._id.toString(),
      customerId: customerId.toString(),
    },
    success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/payment/cancel?appointment=${appointment._id.toString()}`,
  });

  res.send({ url: session.url });
});

// GET /payments/session/:sessionId - used by the Payment Success page.
// It only READS data; the payment status is changed by the verified webhook.
router.get("/session/:sessionId", async (req: Request<{ sessionId: string }>, res: Response) => {
  const { sessionId } = req.params;
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    res.status(400).send({ message: "Invalid session ID" });
    return;
  }

  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    res.status(404).send({ message: "Payment session not found" });
    return;
  }

  // customers can only look at their own payment
  if (session.metadata?.customerId !== req.user!.id) {
    res.status(403).send({ message: "Forbidden: this payment does not belong to you" });
    return;
  }

  const appointmentId = session.metadata?.appointmentId;
  const appointment = appointmentId ? await collections.appointments().findOne({ _id: new ObjectId(appointmentId) }) : null;
  const service = appointment ? await collections.services().findOne({ _id: appointment.serviceId }) : null;

  res.send({
    stripeStatus: session.payment_status, // what Stripe says
    paymentStatus: appointment?.paymentStatus ?? "unpaid", // what our DB says (set by webhook)
    amount: (session.amount_total ?? 0) / 100,
    currency: session.currency,
    appointment: appointment
      ? {
          _id: appointment._id,
          appointmentDate: appointment.appointmentDate,
          timeSlot: appointment.timeSlot,
          serviceName: service?.serviceName,
        }
      : null,
  });
});

// GET /payments/my - the logged-in customer's payment history
router.get("/my", async (req: Request, res: Response) => {
  const transactions = await collections
    .transactions()
    .aggregate([
      { $match: { customerId: new ObjectId(req.user!.id) } },
      { $sort: { createdAt: -1 } },
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
      { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  res.send(transactions);
});

export default router;
