import Stripe from "stripe";

let stripe: Stripe | null = null;

// create the Stripe client only when it is first needed
export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
    stripe = new Stripe(key);
  }
  return stripe;
}

export const CURRENCY = "usd";
