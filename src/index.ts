import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import serviceRoutes from "./routes/service.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import adminManageRoutes from "./routes/adminManage.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import { getAllowedOrigins } from "./utils/clientUrl.js";

dotenv.config({ quiet: true });

const app = express();
const port = process.env.PORT || 5000;

// CLIENT_URL can hold more than one URL separated by commas (e.g. local + live)
app.use(
  cors({
    origin: getAllowedOrigins(),
    credentials: true,
  })
);

// make sure MongoDB is connected before any route runs (works on Vercel too)
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Failed to connect to MongoDB:", (error as Error).message);
    res.status(503).send({ message: "Database is not available. Please try again." });
  }
});

// Stripe webhook needs the raw body, so it must come before express.json()
app.use("/payments/webhook", webhookRoutes);

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send({ message: "SalonBook server is running" });
});

app.use("/services", serviceRoutes);
app.use("/admin", adminRoutes);
app.use("/admin", adminManageRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/payments", paymentRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).send({ message: "Route not found" });
});

// global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).send({ message: "Something went wrong on the server" });
});

// on Vercel the app is exported as a serverless function, locally we start a normal server
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`SalonBook server running on port ${port}`);
  });
}

export default app;
