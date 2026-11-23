import { ObjectId } from "mongodb";

export type UserRole = "customer" | "admin";

export interface User {
  _id: ObjectId;
  name: string;
  email: string;
  image?: string | null;
  phone?: string | null;
  role: UserRole;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// the logged-in user attached to req.user by verifyToken
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

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
