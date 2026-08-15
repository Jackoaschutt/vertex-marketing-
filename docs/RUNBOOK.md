# Runbook — Vesper Commerce

Everything an operator needs: run it, deploy it, connect the integrations, add
the first product, launch.

---

## 1. What is in the box

| Layer | Where | Status |
| --- | --- | --- |
| Storefront | `/store` | REAL |
| Admin | `/ops` | REAL |
| HTTP API | `/api/commerce/*` | REAL |
| Domain logic | `lib/commerce/*` | REAL |
| Database schema | `supabase/migrations/011_commerce_core.sql` | REAL |
| Demo data driver | `lib/commerce/db/driver-memory.ts` | DEMO — active only when no database is configured |
| Mock supplier | `lib/commerce/suppliers/adapter-mock.ts` | MOCK |
| CJ supplier | `lib/commerce/suppliers/adapter-cj.ts` | REAL, **unverified** |
| Generic HTTP supplier | `lib/commerce/suppliers/adapter-http.ts` | REAL |
| Ad channel clients | `lib/commerce/marketing/channels.ts` | TODO (manual entry is REAL) |

The existing **PropGuard** app is untouched. It still owns `/`, `/dashboard`,
`/session`, `/journal`, `/analytics`, `/accounts`, `/settings`, `/squad`,
`/login`, `/signup` and `/api/*` (excluding `/api/commerce/*`).

---

## 2. Run it locally

```bash
npm install
npm run dev          # http://localhost:3000/store  and  /ops
```

With no `.env.local` at all the storefront runs on seeded demo data. `/ops`
denies access until you set `COMMERCE_ADMIN_EMAILS`, and even then needs
Supabase Auth to have a session to check.

```bash
npm run typecheck    # tsc --noEmit
npm test             # compiles lib + tests to CJS, runs node --test (55 tests)
npm run build        # production build
```

---

## 3. Connect the database

1. Create a Supabase project.
2. Run every migration in `supabase/migrations/` in filename order. The commerce
   schema is `011_commerce_core.sql`; migrations `001`–`010` belong to PropGuard
   and are safe to run alongside it.
3. Set in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
4. Restart. The `DEMO DATA` banner in `/ops` disappears. **If the banner is still
   there, the database is not connected** — nothing you do in the admin is being
   saved.

Every `ds_` table has RLS enabled with no policies, so the anon key can read
nothing. All access is server-side through the service-role key.

---

## 4. Open the admin

```
COMMERCE_ADMIN_EMAILS=you@yourdomain.com,cofounder@yourdomain.com
```

Sign in through the existing `/login` page with a Supabase account whose email is
on that list, then go to `/ops`. An empty allowlist denies everyone — that is
deliberate, so a half-configured deployment never exposes the admin.

---

## 5. Connect Stripe

1. `STRIPE_SECRET_KEY` — the commerce checkout uses the same Stripe account as
   PropGuard's subscription billing.
2. Add a **second** webhook endpoint in the Stripe dashboard:
   - URL: `https://<your-domain>/api/commerce/webhooks/stripe`
   - Events: `checkout.session.completed`, `charge.refunded`
3. Put that endpoint's signing secret in `STRIPE_COMMERCE_WEBHOOK_SECRET`.

Keep it separate from `STRIPE_WEBHOOK_SECRET`. The commerce handler ignores any
event without `metadata.commerce === 'vesper'`, so the two cannot interfere.

**Local testing:**
```bash
stripe listen --forward-to localhost:3000/api/commerce/webhooks/stripe
stripe trigger checkout.session.completed
```

Without `STRIPE_SECRET_KEY`, `POST /api/commerce/checkout` returns a 503 naming
exactly what is missing. It never pretends a payment succeeded.

---

## 6. Connect a supplier

Suppliers are rows in `ds_suppliers`. The `adapter` column selects the code path.

### Option A — generic HTTP adapter (recommended for most suppliers)

```sql
insert into ds_suppliers (name, slug, adapter, config) values (
  'Example Supplier', 'example', 'http',
  '{
     "baseUrl": "https://api.example-supplier.com/v1",
     "tokenEnv": "EXAMPLE_SUPPLIER_TOKEN",
     "authHeader": "Authorization",
     "authScheme": "Bearer",
     "costUnit": "major",
     "paths": {
       "products":  "/products",
       "product":   "/products/{sku}",
       "inventory": "/inventory/{sku}",
       "price":     "/products/{sku}/price",
       "orders":    "/orders",
       "order":     "/orders/{ref}",
       "tracking":  "/orders/{ref}/tracking"
     },
     "fields": {
       "sku": "sku", "title": "name", "cost": "price",
       "shipping": "shipping_fee", "stock": "quantity",
       "orderRef": "order_id", "orderStatus": "status",
       "trackingNumber": "tracking_number", "carrier": "carrier"
     }
   }'::jsonb
);
```

Then set `EXAMPLE_SUPPLIER_TOKEN` in the environment. Check the field mapping
against the supplier's own documentation before routing an order.

### Option B — CJdropshipping

```sql
update ds_suppliers set adapter = 'cj' where slug = 'your-supplier';
```
plus `CJ_EMAIL` and `CJ_API_KEY`.

⚠️ The CJ adapter is written to CJ's published Developer API v2 shapes but has
**not** been executed against a live account. Place one low-value test order end
to end and confirm the order id, status and tracking fields come back as the
adapter expects before sending customer orders through it.

### Map variants to supplier SKUs

```sql
insert into ds_supplier_products
  (supplier_id, variant_id, supplier_sku, supplier_cost_cents, supplier_ship_cents)
values ('<supplier-uuid>', '<variant-uuid>', 'SUPPLIER-SKU-123', 1180, 300);
```

Unmapped variants are sent using our own SKU, which the supplier will reject —
the order lands in `needs_attention` with the reason attached rather than
failing silently, but mapping first is better.

### Supplier webhooks (optional)

Set `SUPPLIER_WEBHOOK_SECRET` (`openssl rand -hex 32`) and point the supplier at
`POST /api/commerce/webhooks/supplier`, signing the raw body with HMAC-SHA256
and sending the hex digest in `x-supplier-signature`:

```json
{ "reference": "<supplier order ref>", "status": "shipped",
  "trackingNumber": "...", "carrier": "...", "trackingUrl": "..." }
```

Without the secret the endpoint rejects everything. It never accepts unsigned
input.

---

## 7. Turn on AI and email

```
ANTHROPIC_API_KEY=...        # product copy + business analyst
RESEND_API_KEY=...           # transactional email
COMMERCE_FROM_EMAIL=orders@yourdomain.com
```

Without the Anthropic key, copy generation and the analyst fall back to
deterministic generators and are badged `FALLBACK` / `rules engine` in the UI.

Without the Resend key the console transport is used: **emails are rendered and
logged but never delivered.** Customers will not receive order confirmations.
This is the single most commonly missed step before launch.

---

## 8. Schedule the automations

```
CRON_SECRET=$(openssl rand -hex 32)
```

Point any scheduler at:

```
POST https://<your-domain>/api/commerce/automations/run?which=daily
Authorization: Bearer <CRON_SECRET>
```

Suggested cadence: `which=daily` every morning, `which=weekly` on Mondays.

**Vercel Cron** — add `vercel.json`:
```json
{ "crons": [{ "path": "/api/commerce/automations/run?which=daily", "schedule": "0 7 * * *" }] }
```
Vercel Cron does not send a custom Authorization header, so either sign in and
use the "Run now" button in `/ops/automations`, or trigger it from GitHub Actions
where you control the headers.

---

## 9. Add your first product

**Path A — through the UI (recommended).**

1. `/ops/research` → fill in the candidate, the economics and the fourteen
   0–5 signals. The score updates live; margin and shipping are computed from
   your numbers rather than judged.
2. **Save candidate** → it lands in `researching`, unpublished. A high score
   never publishes anything on its own.
3. `/ops/products` → move it `researching → validation → approved`.
4. **Generate copy** → writes a full content set (title, description, benefits,
   FAQ, meta tags, ad angles, UGC and TikTok hooks, Meta ad concepts, email
   angles, branded image prompts), saved unapproved and scanned for fabricated
   claims.
5. Add images. Put files under `public/store-media/` and insert rows:
   ```sql
   insert into ds_product_images (product_id, url, alt, position)
   values ('<product-uuid>', '/store-media/your-image.jpg', 'Descriptive alt text', 0);
   ```
6. Map the variant to a supplier SKU (section 6).
7. **Publish**. It appears at `/store/product/<slug>` immediately.

**Path B — through the API.**

```bash
curl -X POST https://<domain>/api/commerce/products \
  -H 'Content-Type: application/json' \
  --cookie "<your session cookie>" \
  -d '{"name":"Halo Bedside Light","priceCents":4900,"costCents":1180,
       "shippingCostCents":420,"category":"light","shipDaysMin":6,"shipDaysMax":11,
       "research":{"searchDemand":4,"socialInterest":4,"marketSize":4,"competition":3,
                   "saturation":3,"problemSeverity":4,"differentiation":4,"impulseBuy":4,
                   "creativePotential":4,"brandability":4,"repeatPurchase":2,
                   "refundRisk":4,"qualityRisk":4,"regulatoryRisk":5}}'
```

---

## 10. Rebrand the store

Everything brand-related lives in **`lib/commerce/brand.ts`**: name, legal
entity, tagline, positioning, voice rules, claim prohibitions, categories, trust
statements, contact details, shipping and returns policy. Change that one file
and the storefront, the policy pages, the emails and the AI copy prompts all
follow.

Colours and type are in `tailwind.config.ts` (`ink` / `sand` / `clay` / `moss`)
and `app/globals.css` (`.commerce-scope`).

---

## 11. Deploy

Vercel:

1. Import the repo. Framework preset: Next.js. No build-command changes needed.
2. Set every variable from `.env.example` that applies.
3. Set `NEXT_PUBLIC_APP_URL` to the production origin — canonical URLs, Open
   Graph tags, the sitemap and Stripe redirect URLs all derive from it.
4. Deploy, then register the commerce Stripe webhook against the live URL.

To serve the storefront at the site root instead of `/store`, set
`COMMERCE_ROOT=true`. Middleware then rewrites `/` to `/store`. Nothing is
deleted; unset it to restore PropGuard's landing page.

---

## 12. Shopify

This build does **not** use Shopify — the storefront, cart, checkout and admin
are all in this repository, so there is no Shopify subscription and no theme
layer.

If you want Shopify anyway, the pieces are already here:

- `server.py` (the Python MCP server) contains a working Shopify Admin REST
  product-create path. Set `SHOPIFY_STORE` and `SHOPIFY_ADMIN_TOKEN` and it
  publishes products with AI-written copy.
- To push this catalogue into Shopify instead, write a `ShopifyAdapter` against
  `lib/commerce/suppliers/types.ts`-style boundaries and mirror `ds_products`
  into Shopify products. Nothing in the storefront depends on the admin, so the
  two can run side by side during a migration.

Decide one way or the other before launch — running both storefronts against one
inventory without a sync job will oversell.

---

## 13. Launch checklist

- [ ] Supabase connected; `DEMO DATA` banner gone from `/ops`
- [ ] `COMMERCE_ADMIN_EMAILS` set and you can reach `/ops`
- [ ] Stripe live keys + commerce webhook registered and verified
- [ ] `RESEND_API_KEY` set; place a test order and confirm the email arrives
- [ ] A real supplier connected and one live test order fulfilled end to end
- [ ] Policy pages rewritten with your real entity, address and jurisdiction
      (`lib/commerce/brand.ts` + `app/store/pages/[slug]/page.tsx`)
- [ ] At least one product published with real photography and real copy
- [ ] `NEXT_PUBLIC_APP_URL` set to the production origin
- [ ] `/robots.txt` and `/store-sitemap.xml` return the production domain
- [ ] `CRON_SECRET` set and the daily automation firing

---

## 14. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `/ops` says "Not authorised" | `COMMERCE_ADMIN_EMAILS` empty, or your email is not on it | Set it and sign in with that account |
| `DEMO DATA` banner will not go away | Supabase env vars missing or wrong | Check `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| Checkout returns 503 | `STRIPE_SECRET_KEY` not set | Set it; the response body names the missing variables |
| Paid orders never appear | Commerce webhook not registered, or wrong secret | Check `STRIPE_COMMERCE_WEBHOOK_SECRET` and the Stripe dashboard's delivery log |
| Orders stuck in `needs_attention` | Supplier rejected them | `/ops/orders` shows the exact reason; fix and press Retry (idempotent) |
| Customers get no email | Console transport is active | Set `RESEND_API_KEY` and `COMMERCE_FROM_EMAIL` |
| ROAS and CPA show `—` | No ad spend recorded | Enter spend in `/ops/marketing`. A dash means "not computable", never zero |
| AI copy is badged `FALLBACK` | `ANTHROPIC_API_KEY` not set | Set it, then regenerate |
| Product will not publish | Status is not sellable | Move it to `approved`, `testing`, `winner` or `scaling` first |

---

## 15. Where things live

```
app/store/…                    storefront pages
app/ops/…                      admin dashboard
app/api/commerce/…             HTTP API
app/robots.txt/                generated robots.txt
app/store-sitemap.xml/         generated sitemap

lib/commerce/
  brand.ts                     brand + policy single source of truth
  config.ts                    which integrations are actually configured
  money.ts                     integer-cent money helpers
  cart.ts                      server-side cart pricing
  validate.ts                  request validation
  auth.ts                      admin allowlist + cron secret
  http.ts                      route helpers, error translation, rate limiting
  seo.ts                       metadata + JSON-LD
  db/                          driver interface, Supabase driver, demo driver, repositories
  research/scoring.ts          the 100-point rubric + lifecycle machine
  suppliers/                   adapter interface, mock, CJ, generic HTTP, registry
  orders/                      order creation + fulfilment pipeline
  analytics/                   profit engine + attribution
  ai/                          Anthropic client, content pipeline, analyst, guardrails
  automation/jobs.ts           daily + weekly jobs
  email/                       transports + 9 templates
  marketing/channels.ts        ad channel interface

components/store/…             storefront UI
components/ops/…               admin UI
tests/…                        node --test suite
```
