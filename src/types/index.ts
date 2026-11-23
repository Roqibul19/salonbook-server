import { ObjectId } from "mongodb";

export type ServiceStatus = "active" | "inactive";

export interface Service {
  _id?: ObjectId;
  serviceName: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  image: string;
  status: ServiceStatus;
  createdAt: Date;
}
