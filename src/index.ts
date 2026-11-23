import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import serviceRoutes from "./routes/service.routes.js";

dotenv.config({ quiet: true });

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [process.env.CLIENT_URL as string],
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send({ message: "SalonBook server is running" });
});

app.use("/services", serviceRoutes);

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
