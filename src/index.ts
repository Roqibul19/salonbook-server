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

dotenv.config({ quiet: true });

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [process.env.CLIENT_URL as string],
    credentials: true,
  })
);

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

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`SalonBook server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  });
