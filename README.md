# SalonBook — Server

REST API for **SalonBook**, a salon appointment booking platform. Customers browse salon services, request appointments and pay for confirmed appointments with Stripe. Admins manage services, appointments, customers and payment transactions.

This server is built with **Express.js + TypeScript + MongoDB**. Every protected route verifies a **JWT** issued by Better Auth (running in the client app), and every role check happens on the server.

## 🔗 Links

| | |
|---|---|
| Live Website | _Coming soon_ |
| Live API | _Coming soon_ |
| Client Repository | https://github.com/Roqibul19/salonbook-client |
| Server Repository | https://github.com/Roqibul19/salonbook-server |

## ✨ Important Features

- **JWT verification middleware** — tokens are verified with the public keys (JWKS) published by Better Auth.
- **Server-side role checks** — `verifyAdmin` and `verifyCustomer` protect every private API. Role and blocked status are always read from the database, not from the token.
- **Blocked users** cannot use any protected API; blocking a user also signs them out everywhere.
- **Services API** — public list with search by name, category filter, price sorting and limit; only active services are public.
- **Admin service management** — create, update, delete and activate/deactivate services with input validation (positive price and duration, valid category, image required).
- **Appointments** — customers request appointments (default `pending` / `unpaid`), cancel their own pending requests and see only their own appointments.
- **Booking conflict protection** — no duplicate active appointment for the same service, date and time slot; past dates and invalid slots are rejected.
- **Admin appointment management** — confirm pending appointments, cancel pending or confirmed (unpaid) appointments.
- **Stripe Checkout** — only a confirmed and unpaid appointment of the logged-in customer can be paid.
- **Verified Stripe webhook** — payment status is changed to `paid` and the transaction is saved **only** after a verified `checkout.session.completed` event. Duplicate events are ignored.
- **Read-only transactions** for admins — payment records cannot be edited manually.
- Admin dashboard statistics, customer list and block/unblock.
- Proper error handling with clear JSON error messages and correct HTTP status codes.

## 🛠️ Technology Stack

- Node.js
- Express.js 5
- TypeScript
- MongoDB (official Node.js driver)
- jose (JWT / JWKS verification)
- Stripe
- dotenv, cors
- tsx (development)

## 🗂️ Database Collections

| Collection | Purpose |
|---|---|
| `users` | Managed by Better Auth — name, email, image, role, isBlocked |
| `services` | serviceName, category, description, price, duration, image, status, createdAt |
| `appointments` | serviceId, customerId, appointmentDate, timeSlot, message, servicePrice, paymentStatus, status, createdAt |
| `transactions` | appointmentId, customerId, amount, currency, stripeSessionId, status, createdAt |

## 📡 API Overview

| Method | Endpoint | Access |
|---|---|---|
| GET | `/services` (`?search=&category=&sort=price_asc\|price_desc&limit=`) | Public |
| GET | `/services/categories` | Public |
| GET | `/services/:id` | Public |
| GET | `/appointments/booked-slots?serviceId=&date=` | Public |
| POST | `/appointments` | Customer |
| GET | `/appointments/my` | Customer |
| PATCH | `/appointments/:id/cancel` | Customer |
| POST | `/payments/create-checkout-session` | Customer |
| GET | `/payments/session/:sessionId` | Customer |
| GET | `/payments/my` | Customer |
| POST | `/payments/webhook` | Stripe (signature verified) |
| GET | `/admin/stats` | Admin |
| GET / POST | `/admin/services` | Admin |
| GET / PATCH / DELETE | `/admin/services/:id` | Admin |
| GET | `/admin/appointments` | Admin |
| PATCH | `/admin/appointments/:id/confirm` · `/cancel` | Admin |
| GET | `/admin/users` | Admin |
| PATCH | `/admin/users/:id/block` · `/unblock` | Admin |
| GET | `/admin/transactions` | Admin |

## 🔐 Required Environment Variables

Create a `.env` file in the project root. **Names only — never commit real values.**

```
PORT
CLIENT_URL
AUTH_URL
MONGODB_URI
DB_NAME
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

| Variable | Description |
|---|---|
| `PORT` | Port for the local server (e.g. 5000) |
| `CLIENT_URL` | URL of the client app (used for CORS and Stripe redirects) |
| `AUTH_URL` | URL where Better Auth runs (the client app) — used to verify JWTs |
| `MONGODB_URI` | MongoDB connection string |
| `DB_NAME` | Database name |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

## ⚙️ Installation

```bash
git clone https://github.com/Roqibul19/salonbook-server.git
cd salonbook-server
npm install
```

Then create the `.env` file with the variables above.

## ▶️ How to Run Locally

```bash
# development (auto reload)
npm run dev

# production build
npm run build
npm start
```

The API runs on `http://localhost:5000`. The client app must also be running, because it provides authentication.

### Helpful scripts

```bash
# add sample salon services (only when the services collection is empty)
npm run seed

# give the admin role to an existing account (sign up first)
npm run make-admin -- admin@example.com
```

### Testing Stripe webhooks locally

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to localhost:5000/payments/webhook
```

Use Stripe test card `4242 4242 4242 4242` with any future expiry date and any CVC.

## 👨‍💻 Developer

Developed by **Md Roqibul Haque** — [GitHub](https://github.com/Roqibul19)
