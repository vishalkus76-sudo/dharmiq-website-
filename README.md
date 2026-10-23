# Dharmique — WhatsApp bookings and admin

Customer current website par seva select karke naam, number, city (main page) aur optional sankalp/message bharta hai. Request PostgreSQL mein save hoti hai, phir WhatsApp khulta hai. Customer ko WhatsApp mein **Send** dabana hota hai. UPI aur booking confirmation chat mein aap khud handle karte hain.

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

## Redesigned page bookings

The current `index.html` and `chadhava.html` forms call `saveSevaRequest` from `assets/booking-save.js` before opening WhatsApp. Keep this script and the `/api/bookings` call when editing either page; a direct WhatsApp link alone does not create an admin record. Both pages also load `assets/visits.js` for visitor counting. The single green enquiry button saves first, then opens `whatsapp://send` in the current tab on phones (the WhatsApp app must be installed), or `wa.me` on desktop. If a phone requires another tap after the async save, the same button opens the app without saving a duplicate. A failed save is clearly reported; pressing that same button again provides the direct WhatsApp fallback. Editing the form starts a new save attempt.

City and optional sankalp/message are stored with the request and displayed privately in admin. Missing fields in older requests remain blank. The current Rajbhog offering uses service ID `rajbhog-251` (₹251); historical `rajbhog` records retain their saved ₹151 fee. When changing service names/prices, update both page text and `assets/booking-message.js` so the server catalog matches.

Every current booking form has an optional ₹200 prasadi box checkbox. Its price and updated total appear only inside the form, are included in the WhatsApp message, and are saved with the booking for admin. A new service selection opens with this optional box unchecked. For services without a fixed fee, the form shows seva fee + ₹200 instead of inventing a total.

## Where to edit

- Main page: `index.html`; offerings: `chadhava.html`.
- Current customer form and look: inline in `index.html` and `chadhava.html`; persistence: `assets/booking-save.js`. Older shared form: `assets/booking-form.js`, `assets/booking-form.css`.
- Seva names/prices and ₹200 prasadi: `assets/booking-message.js` (server also imports these prices). Current WhatsApp number/messages: inline `WHATSAPP_NUMBER` and submit handlers in both customer HTML pages; legacy shared form uses `assets/booking-message.js`. Keep all destinations set to `919555669751`.
- Admin page: `admin.html`, `assets/admin.js`, `assets/admin.css`.
- Backend/auth/validation: `api/`, `lib/api.js`; PostgreSQL schema: `lib/db.js`.
- Visitor counter: `assets/visits.js`; deployment/build: `vercel.json`, `build.mjs`.

No payment gateway is required. Customer details remain private behind admin session authentication. Browser sessions use HttpOnly/SameSite cookies (Secure on production), login attempts are limited in PostgreSQL, and state-changing API requests require the website's origin.

## Customer-supplied homepage photos

The nine supplied JPGs are saved in the repository and included in the public build. Replace a file with the same name to update its photo. `index.html` holds the `serviceImages`/`templeImages` order and banner image paths. Both existing Ann Seva thali images stay unchanged.

| Place | Photo file |
| --- | --- |
| Chadhava service card | `chadhava-seva.jpg` |
| Ganga Pujan card | `ganga-pujan.jpg` |
| Kashi prasadi box card | `kashi-prasadi-box.jpg` |
| Dev Deepawali banner | `dev-deepawali.jpg` |
| Chadhava banner, Mahadev | `mahadev-chadhava.jpg` |
| Shri Kashi Vishwanath | `kashi-vishwanath.jpg` |
| Durga Mandir, Durgakund | `durga-kund.jpg` |
| Sankat Mochan Hanuman | `sankat-mochan.jpg` |
| Kashi Char Dham collage | `kashi-char-dham.jpg` |

The product box and four-part temple collage fit fully inside their existing image areas. Other photos use the existing cover layout. All original uploads are retained without re-encoding.
