import { SERVICE_CATEGORIES } from "./constants.js";
import type { Service, ServiceStatus } from "../types/index.js";

type ServiceInput = Omit<Service, "_id" | "createdAt">;

type ValidationResult =
  | { ok: true; data: Partial<ServiceInput> }
  | { ok: false; message: string };

// partial = true is used for updates (only validate the fields that were sent)
export function validateService(body: any, partial = false): ValidationResult {
  const data: Partial<ServiceInput> = {};

  const has = (key: string) => body?.[key] !== undefined;
  const need = (key: string) => !partial || has(key);

  if (need("serviceName")) {
    const name = String(body?.serviceName ?? "").trim();
    if (!name) return { ok: false, message: "Service name is required" };
    data.serviceName = name;
  }

  if (need("category")) {
    const category = String(body?.category ?? "").trim();
    if (!(SERVICE_CATEGORIES as readonly string[]).includes(category)) {
      return { ok: false, message: "Please select a valid category" };
    }
    data.category = category;
  }

  if (need("description")) {
    const description = String(body?.description ?? "").trim();
    if (!description) return { ok: false, message: "Description is required" };
    data.description = description;
  }

  if (need("price")) {
    const price = Number(body?.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, message: "Price must be a positive number" };
    }
    data.price = price;
  }

  if (need("duration")) {
    const duration = Number(body?.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      return { ok: false, message: "Duration must be a positive number" };
    }
    data.duration = duration;
  }

  if (need("image")) {
    const image = String(body?.image ?? "").trim();
    if (!image.startsWith("https://")) {
      return { ok: false, message: "Service image is required" };
    }
    data.image = image;
  }

  if (has("status")) {
    if (body.status !== "active" && body.status !== "inactive") {
      return { ok: false, message: "Status must be active or inactive" };
    }
    data.status = body.status as ServiceStatus;
  }

  if (partial && Object.keys(data).length === 0) {
    return { ok: false, message: "Nothing to update" };
  }

  return { ok: true, data };
}
