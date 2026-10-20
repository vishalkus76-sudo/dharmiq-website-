# Dharmique — simple WhatsApp booking

Customer website par seva, naam, date aur optional gotra/occasion bharta hai. **“WhatsApp पर बुक करें”** dabane se details wala WhatsApp message khulta hai. Customer wahan **Send** dabata hai. Aap usi chat mein date, final amount aur UPI payment details decide karte ho.

Website par payment gateway, admin login, booking database, access code ya automated payment receipt nahi hai. Form submit hone ka matlab booking confirmed ya payment received nahi hai. Confirmation, UPI transaction verification, changes aur refunds WhatsApp par aap khud handle karte ho.

## Live website par kaise lagega?

Existing site: https://dharmiq-website.vercel.app

Naya code `coderabbit/add-more-features/5dfbb9b0` branch mein hai. Public website abhi `main` par purana version dikha sakti hai.

1. GitHub par repository kholo aur is branch ke changes ko `main` mein merge karo.
2. Agar Vercel project is GitHub repository ke `main` se connected hai, deployment apne aap shuru hogi.
3. Vercel dashboard mein is website ka project kholo → **Deployments** → latest production deployment **Ready** hone do. Zaroorat ho to `main` ki latest deployment ko **Redeploy** karo.
4. https://dharmiq-website.vercel.app kholo aur refresh karo.

`vercel.json` build command `npm run build` aur output folder `dist` set karta hai. Node-based build Vercel karta hai; website kholne ya use karne ke liye aapke computer par Node install karna zaroori nahi hai. Koi payment keys, database ya environment variables configure nahi karne hain.

## Content badalna

- Seva names, descriptions, prices, availability, team, reviews aur checked festival dates: `assets/catalog.json`.
- Main page text aur FAQ: `index.html`.
- Existing WhatsApp number: `assets/booking.js` aur page ke contact links. Current number **+91 95556 69751** hai.
- Existing photos/video reuse kiye gaye hain. Koi fake review ya team identity add nahi ki gayi.
- Customer ki permission ke bina review publish mat karein. Apni actual cancellation/refund terms hi likhein.

## Optional developer preview

Node.js 24+; dependencies install karne ki zaroorat nahi:

```sh
npm run build
npm start
```

Open http://localhost:3000. `server.mjs` sirf local static preview ke liye hai. Production mein sirf `dist/` ki files serve hoti hain. `build.mjs` sirf public HTML, browser assets aur media copy karta hai; private `.data`, `.env`, tests aur server source deploy nahi hote. Purane preview ka private local data `.data` mein ho to build use copy nahi karta.

GitHub Pages ya doosri static hosting ke liye bhi `dist/` ki files use kar sakte ho. Relative asset links repository ke subpath par bhi kaam karte hain.

## Checks

```sh
npm test
npm run build
```

Tests WhatsApp destination, Hindi URL encoding, form details, English occasion labels aur UPI instructions verify karte hain. Browser checks form validation, both languages, mobile layout, WhatsApp handoff, chadhava page aur static hosting cover karte hain. WhatsApp message khud nahi bheja jata; customer ko Send dabana hota hai. UPI transaction website verify nahi karti.
