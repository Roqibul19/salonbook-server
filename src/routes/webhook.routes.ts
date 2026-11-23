import express, { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import type Stripe from "stripe";
import { collections } from "../config/db.js";
import { getStripe } from "../config/stripe.js";

const router = Router();

// Stripe needs the RAW body to verify the signature, so this route
// is mounted BEFORE express.json() in index.ts
router.post("/", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    res.status(400).send({ message: "Missing Stripe signature" });
    return;
  }

  // 1. verify that the event really comes from Stripe
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    res.status(400).send({ message: "Invalid signature" });
    return;
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        await recordPayment(session, "paid");
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
      await recordPayment(event.data.object as Stripe.Checkout.Session, "failed");
    }

    res.send({ received: true });
  } catch (err) {
    console.error("Webhook handling failed:", err);
    // a 500 makes Stripe retry the event later
    res.status(500).send({ message: "Webhook handling failed" });
  }
});

// 2. save the transaction and (for paid) mark the appointment as paid
async function recordPayment(session: Stripe.Checkout.Session, status: "paid" | "failed") {
  const appointmentId = session.metadata?.appointmentId;
  const customerId = session.metadata?.customerId;
  if (!appointmentId || !ObjectId.isValid(appointmentId) || !customerId || !ObjectId.isValid(customerId)) {
    console.error("Webhook session is missing metadata:", session.id);
    return;
  }

  // the same event can arrive more than once - only save it the first time
  const exists = await collections.transactions().findOne({ stripeSessionId: session.id });
  if (!exists) {
    await collections.transactions().insertOne({
      appointmentId: new ObjectId(appointmentId),
      customerId: new ObjectId(customerId),
      amount: (session.amount_total ?? 0) / 100,
      currency: session.currency ?? "usd",
      stripeSessionId: session.id,
      status,
      createdAt: new Date(),
    });
  }

  if (status === "paid") {
    await collections
      .appointments()
      .updateOne(
        { _id: new ObjectId(appointmentId), customerId: new ObjectId(customerId), status: "confirmed" },
        { $set: { paymentStatus: "paid" } }
      );
  }
}

export default router;
