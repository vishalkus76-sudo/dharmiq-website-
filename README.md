# Dharmique — WhatsApp bookings and admin

Original website ka design wahi hai. Customer seva select karke naam, number, optional gotra aur optional ₹200 prasadi bharta hai. Request PostgreSQL mein save hoti hai, phir WhatsApp khulta hai. Customer ko WhatsApp mein **Send** dabana hota hai. UPI aur booking confirmation chat mein aap khud handle karte hain.

## Admin panel

Website ke address ke aage `/admin.html` kholo, jaise:

`https://dharmiq-website.vercel.app/admin.html`

Login ke baad aaj/total visits, booking requests, seva, gotra, prasadi aur charges dikhte hain. Naam/number se search aur status filter hai. Booking ko Confirmed/Cancelled aur payment ko Pending/Paid kar sakte hain. **Paid ko UPI transaction verify karne ke baad hi set karein.**

Visitors approximate browser-tab visits hain: ek tab/day ki ek ginti (India time). Sirf website dekhne walon ke naam/number nahi milte. Tracking lagne se pehle ka history nahi aayega. Booking request save hona WhatsApp Send, confirmed booking ya verified payment nahi hai.

## Live setup — required

1. Vercel project mein ek **PostgreSQL database** connect karein, jaise Neon from Vercel Storage/Marketplace. Dedicated database use karein. Database provider ka connection string project ke `DATABASE_URL` variable mein set hona chahiye (`POSTGRES_URL` bhi supported hai). Provider ke TLS/SSL parameters preserve karein.
2. Vercel project settings mein **Environment Variables** ke andar `ADMIN_PASSWORD` add karein. Apna unique, strong password rakhein, kam se kam 12 characters. Isse public code ya chat mein mat likhein. Database aur password variables Production/Preview ke sahi environment mein set karein. Preview ko production customer database se alag rakhein.
3. Naya code merge/deploy karein. `vercel.json` build `npm run build`, public output `dist`, aur `api/` ki Node functions configure karta hai.
4. Website par test request bhejein, `/admin.html` login karke verify karein. Database tables pehli API request par automatically banti hain; database account ko `dharmique` schema/tables create karne ki permission chahiye.

**Sirf HTML publish karne se admin kaam nahi karega. Database aur server-side password zaroori hain.** Setup missing/outage par website WhatsApp fallback deti hai aur request save hone ki confirmation nahi karti. Admin missing setup par data expose nahi karta.

Password badalna ho to hosting mein `ADMIN_PASSWORD` update karke redeploy karein; old sessions reject ho jayenge. Sessions 12 hours mein expire hote hain. Password reset ke liye hosting account use karein. Koi default/public password nahi hai.

## Local developer setup

Node.js 24+, npm and PostgreSQL 17 (tested). App uses standard PostgreSQL protocol through `pg`, not a browser database or localStorage for customer records.

```sh
npm ci
cp .env.example .env.local
# Privately set DATABASE_URL and ADMIN_PASSWORD in .env.local.
node --env-file=.env.local server.mjs
```

Open `http://localhost:3000/` and `http://localhost:3000/admin.html`. No build is needed for local source preview. Production:

```sh
npm run build
```

Only public HTML, assets and media go into `dist`; environment files, database state, server source and tests are excluded. API functions are deployed separately from `api/` by Vercel. A purely static host (such as GitHub Pages) does not run this admin backend.

## Tests

Use a separate synthetic test PostgreSQL database named `dharmique_test` or `dharmique_test_*`; never use the customer database. Test setup/cleanup truncates tables only in that dedicated database.

```sh
# TEST_DATABASE_URL is set privately in a local test env file.
node --env-file=.env.test --test tests/*.test.mjs
npm run build
npm audit --omit=dev --audit-level=high
```

Tests cover auth, CSRF, cookies/session expiry/revocation, public/private routes, request validation, server-calculated fees, duplicate request protection, database persistence, visits, status concurrency, SQL parameterization, throttling and Vercel pre-parsed requests. Browser checks cover bilingual customer submission, WhatsApp fallback during an outage, admin login/search/status/payment/logout and mobile layout. No payment or WhatsApp message is sent by the tests.

## Where to edit

- Main page: `index.html`; offerings: `chadhava.html`.
- Customer form and look: `assets/booking-form.js`, `assets/booking-form.css`.
- Seva names/prices, ₹200 prasadi, WhatsApp number/message: `assets/booking-message.js` (server also imports these prices).
- Admin page: `admin.html`, `assets/admin.js`, `assets/admin.css`.
- Backend/auth/validation: `api/`, `lib/api.js`; PostgreSQL schema: `lib/db.js`.
- Visitor counter: `assets/visits.js`; deployment/build: `vercel.json`, `build.mjs`.

No payment gateway is required. Customer details remain private behind admin session authentication. Browser sessions use HttpOnly/SameSite cookies (Secure on production), login attempts are limited in PostgreSQL, and state-changing API requests require the website's origin.
