import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

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

app.use((req: Request, res: Response) => {
  res.status(404).send({ message: "Route not found" });
});

app.listen(port, () => {
  console.log(`SalonBook server running on port ${port}`);
});
