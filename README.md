# HotelFlow PMS 0.2

Projekt React dhe TypeScript me server Node.js dhe SQLite. Hyrja bëhet me email dhe fjalëkalim. Databaza dhe të gjitha migrimet krijohen automatikisht kur nis serveri. Nuk nevojitet Corepack, pnpm, shërbim databaze në cloud ose migrim manual.

## Nisja në Windows

Instalo **Node.js 24 LTS ose më të ri**. Nxirre ZIP-in në një dosje të re, p.sh. `C:\Projects\HotelFlow-PMS`, dhe hap terminalin aty. Mos e vendos sipër versionit të vjetër dhe mos kopjo databazën e vjetër: kjo paketë ka model të ri llogarish. Versioni i vjetër ruhet veçmas.

```powershell
node --version
npm install
npm run dev
```

Hap `http://localhost:5173`. Krijo llogari me email dhe fjalëkalim me të paktën 12 karaktere. Pastaj konfiguro pronën ose provo pronën shembull. Nuk ka fjalëkalim të përbashkët ose llogari admin të paracaktuar.

Serveri API punon në `http://localhost:3001`; Vite dërgon `/api` te ai. Mbaje terminalin hapur. Databaza ruhet te `data/hotelflow.sqlite`. Dhomat, rezervimet dhe llogaritë nuk humbasin kur rifreskon faqen.

Për instalim të riprodhueshëm përdor `npm ci` në vend të `npm install`. `package-lock.json` përfshihet.

## Strukturë e lexueshme

- `src/components`: kontrollet e përbashkëta dhe konfigurimi i Booking Engine.
- `src/pages`: çdo faqe në skedar më vete.
- `src/lib`: tipi i të dhënave, formatimet, kërkesat API dhe gjendja e ndërfaqes.
- `server/modules`: autentikimi, rezervimet, raportet dhe simulatori i kanaleve.
- `server/providers`: pagesat, dërgimi i email-eve dhe eksporti PDF/Word/CSV.
- `server/db`: databaza dhe migrimet SQL të versionuara.
- `tests`: teste integrimi me kërkesa të vërteta HTTP dhe SQLite.
- `docs`: udhëzimi Word dhe shënimet për aktivizim.

```powershell
npm run check
npm test
npm run build
npm run format
```

Prettier formaton kodin me indentim dhe blloqe. `npm run build` kontrollon TypeScript dhe krijon frontend-in në `dist`.

## Funksionet

Dashboard dhe kalendar me 7 ose 14 ditë, konfigurim pronash, dhoma/çmime bazë, rezervime, ndryshime datash dhe dhome, anulim/no-show, check-in/out, detyra pastrimi, caktim punonjësish, pagesa manuale dhe online, histori klientësh, ftesa/role, email-e me radhë/riprovim, abonime dhe Booking Engine publik me link të veçantë.

Prona nuk publikohet automatikisht. Te Booking Engine cakto adresën, politikat dhe aktivizo publikimin. Butoni Hap faqen hap `/book/emri-prones`. Të gjitha rezervimet përdorin të njëjtin inventar; databaza refuzon mbivendosjet.

Pagesat manuale janë regjistrime arkëtimi, jo përpunim i kartës. Pagesat online ruhen si të paguara vetëm pas webhook-ut të verifikuar. Pagesa pas anulimit ose që tejkalon bilancin shfaqet për pajtim te Pagesat; rimbursimi kryhet te ofruesi, jo automatikisht nga ky version.

## Raportet

Zënia/parashikimi; vlera e netëve me ADR dhe RevPAR; arkëtimet; detyrimet; mbërritjet; largimet; pastrimi; burimet; anulimet/no-show; historiku i klientëve; historiku i veprimeve; detyrat e stafit. Çdo raport ka filtra datash dhe eksport PDF, Word DOCX dhe CSV.

Raportet operative të pastrimit dhe stafit tregojnë gjendjen aktuale. Zënia historike përdor kapacitetin aktual, sepse ndryshimet historike të inventarit nuk ruhen në këtë version. Vlera e netëve është e ndarë nga arkëtimet. Raportet nuk janë fatura fiskale.

## Rolet

Pronar: konfigurim, operim, financa, ftesa, role, arkëtim dhe abonim.

Menaxher: operim, raporte, detyra, email-e dhe konfigurim prone; jo ndryshim rolesh ose abonim.

Recepsion: rezervime, check-in/out, pagesa dhe lista operative; jo raporte financiare menaxheriale ose administrim stafi.

Pastrim: gjendja e dhomave dhe raporti i pastrimit; pa klientë, pagesa ose raporte financiare. Nuk mund të ndryshojë një detyrë të caktuar një punonjësi tjetër. Lejet kontrollohen në server.

Ftesa e stafit skadon pas 48 orësh. Pa shërbim email-i në zhvillim, pronari merr një link lokal për provë. Në prodhim linku dërgohet vetëm te email-i i ftuar. Pezullimi ose ndryshimi i rolit mbyll sesionet ekzistuese të atij anëtari.

## Email-et reale

Kopjo `.env.example` si `.env` dhe vendos:

```dotenv
RESEND_API_KEY=re_...
MAIL_FROM=HotelFlow <reservations@domeni-yt.com>
APP_URL=http://localhost:5173
```

Verifiko domenin te Resend. Pa këto vlera, email-et ruhen në pritje dhe nuk shënohen si të dërguara. Worker-i provon deri në 8 herë me vonesë në rritje dhe çelës idempotence. Statusi `accepted` do të thotë pranuar nga ofruesi; nuk provon dorëzim në inbox. Nuk ka webhook të bounce/delivery në këtë version.

Verifikimi, rikuperimi i fjalëkalimit, ftesat, konfirmimet dhe ndryshimet e rezervimeve janë implementuar. Për të provuar rikuperimin fund më fund kërkohet dërgim real email-i ose kontroll administrativ i databazës lokale. Mos publiko përmbajtjen e email-eve të autentikimit në një panel të përbashkët.

## Pagesat reale dhe abonimet

Përdoret Stripe Checkout, Stripe Connect për llogaritë e akomodimeve dhe Customer Portal për abonimin e biznesit. Kërkohet një llogari platforme e përshtatshme; ofruesi duhet të mbështesë vendin, biznesin dhe modelin e arkëtimit. Nuk është aktivizuar ose verifikuar një llogari reale nga kjo paketë.

Në `.env`:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
```

Krijo çmimet përsëritëse te ofruesi. Paketat Starter/Pro në ndërfaqe janë zgjedhje plani; nuk ka çmime të fshehta ose plan me pagesë të aktivizuar lokalisht. Çmimi shfaqet nga Checkout. Prova lokale është 14 ditë. Kur përfundon prova ose abonimi, ruhen leximet dhe operimi i rezervimeve ekzistuese; krijimi i rezervimeve të reja kërkon akses aktiv.

Endpoint-i: `POST /api/webhooks/stripe`. Aktivizo ngjarjet:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Për arkëtimet e akomodimeve konfiguro edhe ngjarjet e llogarive Connect që përdor platforma. Nënshkrimi verifikohet mbi trupin e papërpunuar. Ridrejtimi te success_url nuk shënon pagesën si të paguar. Ngjarjet e përsëritura nuk krijojnë pagesë të dytë. Pas ridrejtimit rifresko panelin pasi mbërrin webhook-u.

Te Abonimi lidhet llogaria e arkëtimit të biznesit përmes faqes së sigurt të ofruesit. Pagesat e vizitorëve drejtohen te kjo llogari e lidhur. Abonimi i HotelFlow përdor llogarinë e platformës. Numrat e kartave nuk ruhen në databazë ose kod.

Dokumentacioni: https://docs.stripe.com/api/checkout/sessions/create dhe https://docs.stripe.com/connect/direct-charges dhe https://resend.com/docs/api-reference/emails/send-email

## Nisja e paketës së ndërtuar

```powershell
npm run build
```

Në `.env` ndrysho `APP_URL=http://localhost:3001` për provën lokale të paketës së ndërtuar, pastaj:

```powershell
npm start
```

Hap `http://localhost:3001`. Në prodhim vendos `NODE_ENV=production`, `APP_URL=https://domeni-yt`, TLS dhe reverse proxy drejt `127.0.0.1:3001`. Cookie-t kërkojnë HTTPS në prodhim. Frontend-i nuk merr asnjë sekret. Ruaj databazën në disk persistent, jo në filesystem të përkohshëm të një hosti.

```powershell
npm run backup
```

Kjo krijon kopje konsistente te `data/backups`. Për rikthim ndalo serverin dhe rikthe një kopje të kontrolluar në një direktori të re të të dhënave; ruaj gjithmonë origjinalin. Përdor monitorim, kopje rezervë jashtë serverit dhe prova rikthimi përpara operimit real.

## Kufizime të rëndësishme

Channel Manager është simulator dhe kontratë adapter-i, jo lidhje aktive me kanalet. Ende duhen integrimet dhe miratimet reale. Ky version përdor një dhomë fizike për rezervim dhe një çmim bazë për natë. Nuk përfshin plane sezonale, fiskalizim, lidhje bankare, llogaritje automatike taksash, rimbursim automatik, shumë dhoma në një rezervim ose MFA. Menaxhimi i shumë organizatave për një përdorues nuk ka ende zgjedhës në hyrje. Testimi Linux nuk provon automatikisht çdo konfigurim Windows. Përpara shitjes duhen pilot, testim ngarkese, rishikim sigurie dhe integrime në sandbox me llogaritë e tua.
# Helion
