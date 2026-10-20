# Dharmique

काशी की सेवा बुकिंग वेबसाइट — Hindi/English, booking requests, WhatsApp handoff, private tracking, festival calendar, gallery, admin and optional Razorpay payments.

## Run / कैसे चलाएँ

Requires **Node.js 24+**. There are no npm dependencies to install.

```sh
cp .env.example .env
npm start
```

Open `http://localhost:3000`. The main page is `index.html`; the team dashboard is `/admin.html`. Old alternative home page URLs redirect to the current home page on the Node server. `chadhava.html` links to the integrated booking form.

### Admin login

Set `ADMIN_PASSWORD` to a strong password of at least 16 characters in `.env`, then restart the server. If unset, the server creates a random password in `.data/admin-password` (or `DATA_DIR/admin-password`). Open that private file locally to obtain your password. Never publish it or commit `.env` or `.data`.

In the dashboard:

1. **Bookings:** Search requests, agree the date/location/offerings and amount with the customer, then set `confirmed`. Set `completed` after performing the seva. Cancellation does not issue a payment refund automatically; reconcile any paid amount with the gateway.
2. **Website content:** Edit service names, descriptions, prices (whole INR; blank means ask for a quote), locations, timing and availability. Existing bookings retain their agreed prices. Once checkout starts, the amount cannot change; unresolved checkouts must be reconciled before cancellation. Cancelled bookings cannot be reopened.
3. Add checked festival dates and request deadlines, team names/roles, and genuine reviews with consent. All content has Hindi and English fields. No reviews or staff identities have been invented.
4. Set your actual cancellation, rescheduling and refund terms. The initial copy asks customers to obtain terms before paying. Click **Save website content** and refresh the public page.

Sessions expire after eight hours and after a server restart. There is one administrator password; there are no separate staff accounts. Booking lists show the latest 1,000 requests. The initial catalog is seeded from `assets/catalog.json` only when a database is created; subsequent edits live in SQLite.

## Customer flow

1. Choose a seva, date, name, phone, optional gotra, occasion and intention. Consent is required.
2. Save the **reference and private access code**, or download them. Access codes are displayed once and stored only as a hash on the server. They are not included in the WhatsApp message.
3. Press the WhatsApp link to actually send details to the team. Creating a request does not send a WhatsApp message automatically or confirm availability.
4. Track using the reference and code. After team confirmation, online payment appears if configured. Successful capture is verified on the server before a payment receipt is offered. Print the receipt or save it as PDF from the browser print dialog.
5. To create another request, use **Save details & start another request**. This downloads the previous reference before resetting the form.

No SMS, automatic WhatsApp messages, prasad courier, photo delivery or automatic refunds are included. Those services must be arranged with the team.

## Online payment / Razorpay

Add your own Razorpay account keys to `.env` (start with test mode):

```dotenv
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Enable automatic capture in your Razorpay account. Register `https://YOUR-DOMAIN/api/payments/webhook` for **payment.captured**, using the same webhook secret. Razorpay Checkout handles card/UPI details; this server does not store them. The server creates an order for the confirmed amount and validates both the Checkout signature and the provider's captured payment, amount, currency and order before marking it paid. The signed webhook reconciles captures if a browser closes. Repeated verification is safe.

Before enabling live keys, test a successful payment, failed payment, browser closing after payment, captured webhook delivery and a refund in your own Razorpay test account. Provider operations and checkout UI have **not been verified against a real account** in this task. The automated suite uses an explicitly synthetic fetch fixture; the installed CodeRabbit emulator v0.0.1 does not offer Razorpay. No gateway keys are bundled. Without keys, customers can create and track requests and contact the team for payment instructions.

## Publish / अपनी hosting पर कैसे जोड़ें

This update adds a server and database. Use a host that runs a persistent **Node 24+ process**, such as a VPS or a Node web service with a persistent disk.

1. Upload/publish this repository's files and set the start command to `npm start`. Build/install commands are unnecessary because the app has no dependencies.
2. Set `ADMIN_PASSWORD`, `PUBLIC_ORIGIN=https://YOUR-DOMAIN` (exact origin, no trailing slash), and `DATA_DIR` to a private persistent disk directory. Set `PORT` if your host requires it.
3. Route your domain to the service through HTTPS. The proxy must preserve the public `Host` header. `PUBLIC_ORIGIN` enables Secure admin cookies and rejects other origins. Never share one production `.data` directory between multiple server processes.
4. Configure your domain/HTTPS and Razorpay only when ready. Keep secrets in the host's environment settings. Never put them in HTML or JavaScript.
5. Keep private backups of the SQLite data directory using SQLite-aware backup tooling. Do not place backups in the public assets folder. Store personal information only as long as needed and handle correction/deletion requests through the published contact address. This small app does not include automated retention or self-service deletion.
6. Check the gallery assets and replace any media you do not own or want to publish. The gallery reuses files that were already in this repository; it does not assert they document a specific completed booking.

**GitHub Pages or static-only hosting:** The layout, gallery, bilingual services and WhatsApp fallback work when files are served statically. Saved booking references, admin, tracking, catalog edits and payments require this Node server. If the API is unavailable, the form clearly offers a WhatsApp message and does not claim to have saved a booking. Do not double-click the HTML files as `file://`; serve them over HTTP.

Changes here are workspace files and a local preview; they do not update an existing public domain until deployed to its hosting.

## Checks

```sh
npm test
```

Integration tests use temporary SQLite databases and randomly generated synthetic credentials. They check consent/date/phone validation, rejection of client-supplied amounts, origin checks, protected admin access, private tracking, persistence, catalog updates and unavailable services. Synthetic gateway tests check signature/amount/capture validation and webhook reconciliation. They never contact a payment provider. The preview contains no real payment credentials.
