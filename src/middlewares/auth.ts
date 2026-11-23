import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import type { UserRole } from "../types/index.js";

// public keys published by Better Auth (client app) at /api/auth/jwks
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    const authUrl = process.env.AUTH_URL;
    if (!authUrl) throw new Error("AUTH_URL is not defined in environment variables");
    jwks = createRemoteJWKSet(new URL("/api/auth/jwks", authUrl));
  }
  return jwks;
}

// 1. checks the Bearer token  2. loads the user from DB  3. blocks blocked users
export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).send({ message: "Unauthorized: no token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: process.env.AUTH_URL,
      audience: process.env.AUTH_URL,
    });
    userId = String(payload.sub);
  } catch {
    res.status(401).send({ message: "Unauthorized: invalid or expired token" });
    return;
  }

  if (!ObjectId.isValid(userId)) {
    res.status(401).send({ message: "Unauthorized: invalid user" });
    return;
  }

  // always read role and blocked status from the database, not from the token
  const user = await collections.users().findOne({ _id: new ObjectId(userId) });

  if (!user) {
    res.status(401).send({ message: "Unauthorized: user not found" });
    return;
  }

  if (user.isBlocked) {
    res.status(403).send({ message: "Your account has been blocked" });
    return;
  }

  req.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role || "customer",
  };

  next();
}

// use after verifyToken
function verifyRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      res.status(403).send({ message: "Forbidden: you do not have access" });
      return;
    }
    next();
  };
}

export const verifyAdmin = verifyRole("admin");
export const verifyCustomer = verifyRole("customer");
