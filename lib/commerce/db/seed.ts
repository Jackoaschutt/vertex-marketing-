/**
 * DEMO SEED DATA.
 *
 * Used only by the MemoryDriver, i.e. only when no database is configured.
 * It exists so the storefront, ops dashboard, order pipeline and analytics can
 * all be exercised end to end with zero credentials.
 *
 * It is NOT loaded into Postgres and is never used when the Supabase driver is
 * active. Product copy here is deliberately plausible-but-generic and makes no
 * factual claims (no certifications, studies, ratings or customer counts).
 */

type Row = Record<string, unknown>

const now = new Date()
const iso = (daysAgo = 0) =>
  new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
const day = (daysAgo = 0) => iso(daysAgo).slice(0, 10)

const SUP_MOCK = '10000000-0000-4000-8000-000000000001'
const SUP_ALT = '10000000-0000-4000-8000-000000000002'

const P = {
  halo: '20000000-0000-4000-8000-000000000001',
  drift: '20000000-0000-4000-8000-000000000002',
  umbra: '20000000-0000-4000-8000-000000000003',
  ridge: '20000000-0000-4000-8000-000000000004',
  ember: '20000000-0000-4000-8000-000000000005',
  quill: '20000000-0000-4000-8000-000000000006',
}

const V = {
  haloWarm: '30000000-0000-4000-8000-000000000001',
  haloSand: '30000000-0000-4000-8000-000000000002',
  drift: '30000000-0000-4000-8000-000000000003',
  umbra: '30000000-0000-4000-8000-000000000004',
  ridge: '30000000-0000-4000-8000-000000000005',
  ember: '30000000-0000-4000-8000-000000000006',
}

function product(p: Partial<Row> & { id: string; slug: string; name: string }): Row {
  return {
    tagline: null,
    category: null,
    target_audience: null,
    problem_solved: null,
    supplier_id: SUP_MOCK,
    supplier_url: null,
    product_url: null,
    cost_cents: 0,
    shipping_cost_cents: 0,
    price_cents: 0,
    compare_at_cents: null,
    ship_days_min: 7,
    ship_days_max: 12,
    demand_score: 0,
    margin_score: 0,
    competition_score: 0,
    problem_score: 0,
    creative_score: 0,
    brandability_score: 0,
    shipping_score: 0,
    repeat_score: 0,
    risk_score: 0,
    product_score: 0,
    research_inputs: {},
    status: 'researching',
    published: false,
    featured: false,
    position: 0,
    ad_spend_cents: 0,
    revenue_cents: 0,
    orders_count: 0,
    sessions_count: 0,
    refunds_cents: 0,
    refunds_count: 0,
    meta_title: null,
    meta_description: null,
    date_discovered: iso(60),
    date_tested: null,
    created_at: iso(60),
    updated_at: iso(1),
    ...p,
  }
}

function variant(v: Partial<Row> & { id: string; product_id: string; sku: string }): Row {
  return {
    title: 'Default',
    options: {},
    price_cents: 0,
    cost_cents: 0,
    stock: 120,
    is_default: true,
    position: 0,
    created_at: iso(60),
    updated_at: iso(1),
    ...v,
  }
}

export function buildSeed(): Record<string, Row[]> {
  const ds_suppliers: Row[] = [
    {
      id: SUP_MOCK,
      name: 'Northline Fulfilment (demo)',
      slug: 'northline',
      adapter: 'mock',
      config: {},
      website: null,
      contact_email: null,
      default_ship_days_min: 7,
      default_ship_days_max: 12,
      is_active: true,
      notes: 'MOCK supplier used for demo data. Replace with a real supplier before launch.',
      created_at: iso(90),
      updated_at: iso(90),
    },
    {
      id: SUP_ALT,
      name: 'Harbourside Goods (demo)',
      slug: 'harbourside',
      adapter: 'mock',
      config: {},
      website: null,
      contact_email: null,
      default_ship_days_min: 9,
      default_ship_days_max: 16,
      is_active: true,
      notes: 'Second MOCK supplier, used to demonstrate multi-supplier order splitting.',
      created_at: iso(90),
      updated_at: iso(90),
    },
  ]

  const ds_products: Row[] = [
    product({
      id: P.halo,
      slug: 'halo-bedside-light',
      name: 'Halo Bedside Light',
      tagline: 'Warm, dimmable light that does not wake the room.',
      category: 'light',
      target_audience: 'Adults 28–45 who read in bed and share a bedroom',
      problem_solved:
        'Overhead lights are too bright to read by at 11pm, and phone screens make it harder to fall asleep afterwards.',
      cost_cents: 1180,
      shipping_cost_cents: 420,
      price_cents: 4900,
      ship_days_min: 6,
      ship_days_max: 11,
      demand_score: 16,
      margin_score: 13,
      competition_score: 9,
      problem_score: 13,
      creative_score: 8,
      brandability_score: 9,
      shipping_score: 4,
      repeat_score: 2,
      risk_score: 4,
      product_score: 78,
      status: 'winner',
      published: true,
      featured: true,
      position: 1,
      ad_spend_cents: 412_000,
      revenue_cents: 1_186_000,
      orders_count: 212,
      sessions_count: 9_450,
      refunds_cents: 24_500,
      refunds_count: 5,
      date_tested: iso(45),
      meta_title: 'Halo Bedside Light — warm dimmable reading light | Vesper',
      meta_description:
        'A warm, stepless dimmable bedside light for reading at night without waking the room. Tracked delivery, 30-day returns.',
    }),
    product({
      id: P.drift,
      slug: 'drift-sound-machine',
      name: 'Drift Sound Machine',
      tagline: 'Covers the sounds that keep you awake.',
      category: 'sound',
      target_audience: 'Light sleepers in flats, terraces and shared houses',
      problem_solved:
        'Traffic, neighbours and a partner on a different schedule interrupt sleep, and phone apps drain the battery and interrupt with notifications.',
      cost_cents: 1420,
      shipping_cost_cents: 480,
      price_cents: 5400,
      ship_days_min: 7,
      ship_days_max: 13,
      demand_score: 15,
      margin_score: 13,
      competition_score: 8,
      problem_score: 14,
      creative_score: 7,
      brandability_score: 8,
      shipping_score: 4,
      repeat_score: 2,
      risk_score: 4,
      product_score: 75,
      status: 'scaling',
      published: true,
      featured: true,
      position: 2,
      ad_spend_cents: 268_000,
      revenue_cents: 702_000,
      orders_count: 118,
      sessions_count: 6_120,
      refunds_cents: 10_800,
      refunds_count: 2,
      date_tested: iso(38),
    }),
    product({
      id: P.umbra,
      slug: 'umbra-weighted-eye-mask',
      name: 'Umbra Weighted Eye Mask',
      tagline: 'Blocks the light, holds still all night.',
      category: 'sleep',
      target_audience: 'Shift workers, frequent travellers, early-summer sleepers',
      problem_solved:
        'Ordinary eye masks slip off, press on the eyes, and let light in at the nose.',
      cost_cents: 640,
      shipping_cost_cents: 260,
      price_cents: 2900,
      ship_days_min: 5,
      ship_days_max: 10,
      demand_score: 13,
      margin_score: 13,
      competition_score: 6,
      problem_score: 12,
      creative_score: 8,
      brandability_score: 8,
      shipping_score: 5,
      repeat_score: 3,
      risk_score: 4,
      product_score: 72,
      status: 'testing',
      published: true,
      position: 3,
      ad_spend_cents: 96_000,
      revenue_cents: 118_900,
      orders_count: 41,
      sessions_count: 3_310,
      refunds_cents: 5_800,
      refunds_count: 2,
      date_tested: iso(12),
      supplier_id: SUP_ALT,
    }),
    product({
      id: P.ridge,
      slug: 'ridge-recovery-roller',
      name: 'Ridge Recovery Roller',
      tagline: 'Ten minutes on the floor before bed.',
      category: 'recovery',
      target_audience: 'Desk workers who train 2–4 times a week',
      problem_solved:
        'Sitting all day and training in the evening leaves the back and legs tight at bedtime.',
      cost_cents: 980,
      shipping_cost_cents: 720,
      price_cents: 3900,
      ship_days_min: 8,
      ship_days_max: 15,
      demand_score: 11,
      margin_score: 10,
      competition_score: 5,
      problem_score: 10,
      creative_score: 6,
      brandability_score: 6,
      shipping_score: 3,
      repeat_score: 1,
      risk_score: 3,
      product_score: 55,
      status: 'loser',
      published: false,
      position: 4,
      ad_spend_cents: 143_000,
      revenue_cents: 66_300,
      orders_count: 17,
      sessions_count: 2_980,
      refunds_cents: 7_800,
      refunds_count: 2,
      date_tested: iso(30),
    }),
    product({
      id: P.ember,
      slug: 'ember-warm-lamp-bulb',
      name: 'Ember Warm Bulb (2-pack)',
      tagline: 'Turns any lamp you already own into evening light.',
      category: 'light',
      target_audience: 'Existing Halo customers and renters who cannot change fittings',
      problem_solved:
        'Most household bulbs are cool-white and keep the room feeling like daytime after 9pm.',
      cost_cents: 420,
      shipping_cost_cents: 180,
      price_cents: 1900,
      ship_days_min: 5,
      ship_days_max: 9,
      demand_score: 10,
      margin_score: 12,
      competition_score: 5,
      problem_score: 9,
      creative_score: 5,
      brandability_score: 7,
      shipping_score: 5,
      repeat_score: 5,
      risk_score: 4,
      product_score: 62,
      status: 'approved',
      published: true,
      position: 5,
    }),
    product({
      id: P.quill,
      slug: 'quill-evening-journal',
      name: 'Quill Evening Journal',
      tagline: 'Empty your head before you get into bed.',
      category: 'desk',
      target_audience: 'People who lie awake running through tomorrow',
      problem_solved:
        'Unfinished thoughts from the day surface the moment the light goes off.',
      cost_cents: 520,
      shipping_cost_cents: 340,
      price_cents: 2400,
      ship_days_min: 6,
      ship_days_max: 12,
      demand_score: 8,
      margin_score: 11,
      competition_score: 6,
      problem_score: 9,
      creative_score: 7,
      brandability_score: 9,
      shipping_score: 4,
      repeat_score: 4,
      risk_score: 5,
      product_score: 63,
      status: 'validation',
      published: false,
      position: 6,
    }),
  ]

  const ds_product_variants: Row[] = [
    variant({
      id: V.haloWarm,
      product_id: P.halo,
      sku: 'VSP-HALO-CHR',
      title: 'Charcoal',
      options: { finish: 'Charcoal' },
      price_cents: 4900,
      cost_cents: 1180,
      stock: 86,
      is_default: true,
    }),
    variant({
      id: V.haloSand,
      product_id: P.halo,
      sku: 'VSP-HALO-SND',
      title: 'Sand',
      options: { finish: 'Sand' },
      price_cents: 4900,
      cost_cents: 1180,
      stock: 7,
      is_default: false,
      position: 1,
    }),
    variant({
      id: V.drift,
      product_id: P.drift,
      sku: 'VSP-DRIFT-01',
      price_cents: 5400,
      cost_cents: 1420,
      stock: 140,
    }),
    variant({
      id: V.umbra,
      product_id: P.umbra,
      sku: 'VSP-UMBRA-01',
      price_cents: 2900,
      cost_cents: 640,
      stock: 260,
    }),
    variant({
      id: V.ridge,
      product_id: P.ridge,
      sku: 'VSP-RIDGE-01',
      price_cents: 3900,
      cost_cents: 980,
      stock: 45,
    }),
    variant({
      id: V.ember,
      product_id: P.ember,
      sku: 'VSP-EMBER-2PK',
      price_cents: 1900,
      cost_cents: 420,
      stock: 310,
    }),
  ]

  const ds_product_images: Row[] = [
    { id: '40000000-0000-4000-8000-000000000001', product_id: P.halo, url: '/store-media/halo.svg', alt: 'Halo Bedside Light on a nightstand, lit warmly', position: 0, created_at: iso(60) },
    { id: '40000000-0000-4000-8000-000000000002', product_id: P.halo, url: '/store-media/halo-alt.svg', alt: 'Halo Bedside Light dimmed to its lowest setting', position: 1, created_at: iso(60) },
    { id: '40000000-0000-4000-8000-000000000003', product_id: P.drift, url: '/store-media/drift.svg', alt: 'Drift Sound Machine on a bedside table', position: 0, created_at: iso(60) },
    { id: '40000000-0000-4000-8000-000000000004', product_id: P.umbra, url: '/store-media/umbra.svg', alt: 'Umbra Weighted Eye Mask folded flat', position: 0, created_at: iso(60) },
    { id: '40000000-0000-4000-8000-000000000005', product_id: P.ridge, url: '/store-media/ridge.svg', alt: 'Ridge Recovery Roller standing upright', position: 0, created_at: iso(60) },
    { id: '40000000-0000-4000-8000-000000000006', product_id: P.ember, url: '/store-media/ember.svg', alt: 'Two Ember warm bulbs in their packaging', position: 0, created_at: iso(60) },
    { id: '40000000-0000-4000-8000-000000000007', product_id: P.quill, url: '/store-media/quill.svg', alt: 'Quill Evening Journal, closed', position: 0, created_at: iso(60) },
  ]

  const ds_supplier_products: Row[] = ds_product_variants.map((v, i) => ({
    id: `50000000-0000-4000-8000-00000000000${i + 1}`,
    supplier_id: v.product_id === P.umbra ? SUP_ALT : SUP_MOCK,
    variant_id: v.id,
    supplier_sku: `MOCK-${String(v.sku)}`,
    supplier_cost_cents: v.cost_cents,
    supplier_ship_cents: 300,
    lead_days: 2,
    is_primary: true,
    last_synced_at: iso(1),
    created_at: iso(60),
  }))

  // A small but realistic order history so the profit engine has real inputs.
  const ds_customers: Row[] = []
  const ds_orders: Row[] = []
  const ds_order_items: Row[] = []
  const ds_fulfillments: Row[] = []

  const catalogue = [
    { pid: P.halo, vid: V.haloWarm, sku: 'VSP-HALO-CHR', title: 'Halo Bedside Light — Charcoal', price: 4900, cost: 1180, sup: SUP_MOCK },
    { pid: P.drift, vid: V.drift, sku: 'VSP-DRIFT-01', title: 'Drift Sound Machine', price: 5400, cost: 1420, sup: SUP_MOCK },
    { pid: P.umbra, vid: V.umbra, sku: 'VSP-UMBRA-01', title: 'Umbra Weighted Eye Mask', price: 2900, cost: 640, sup: SUP_ALT },
    { pid: P.ember, vid: V.ember, sku: 'VSP-EMBER-2PK', title: 'Ember Warm Bulb (2-pack)', price: 1900, cost: 420, sup: SUP_MOCK },
  ]
  const sources = ['tiktok', 'meta', 'meta', 'google', 'direct']

  for (let i = 0; i < 48; i++) {
    const daysAgo = Math.floor(i / 2)
    const pick = catalogue[i % catalogue.length]
    const qty = i % 7 === 0 ? 2 : 1
    const subtotal = pick.price * qty
    const shipping = subtotal >= 7500 ? 0 : 595
    const total = subtotal + shipping
    const fee = Math.round((total * 2.9) / 100) + 30
    const cogs = pick.cost * qty
    const orderId = `60000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
    const custId = `70000000-0000-4000-8000-${String((i % 34) + 1).padStart(12, '0')}`
    const email = `customer${(i % 34) + 1}@example.com`
    const status = i < 3 ? 'received' : i === 4 ? 'needs_attention' : i < 12 ? 'submitted' : i < 26 ? 'fulfilled' : 'delivered'

    if (!ds_customers.some((c) => c.id === custId)) {
      ds_customers.push({
        id: custId,
        email,
        name: null,
        phone: null,
        marketing_opt_in: i % 3 === 0,
        orders_count: 1,
        spend_cents: total,
        first_order_at: iso(daysAgo),
        last_order_at: iso(daysAgo),
        created_at: iso(daysAgo),
        updated_at: iso(daysAgo),
      })
    }

    ds_orders.push({
      id: orderId,
      order_number: `VSP-${10_000 + i}`,
      customer_id: custId,
      email,
      currency: 'USD',
      subtotal_cents: subtotal,
      shipping_cents: shipping,
      tax_cents: 0,
      discount_cents: 0,
      total_cents: total,
      payment_fee_cents: fee,
      cogs_cents: cogs,
      refund_cents: i % 17 === 0 ? total : 0,
      status: i % 17 === 0 ? 'refunded' : status,
      attention_reason: i === 4 ? 'Supplier rejected the order: address line 1 exceeded 35 characters.' : null,
      shipping_address: { name: 'Demo Customer', line1: '1 Example Street', city: 'Portland', state: 'OR', postal_code: '97205', country: 'US' },
      attribution: { source: sources[i % sources.length], medium: i % 5 === 4 ? 'none' : 'paid_social', campaign: `q3-${pick.sku.toLowerCase()}` },
      stripe_session_id: `cs_demo_${i}`,
      stripe_payment_intent_id: `pi_demo_${i}`,
      placed_at: iso(daysAgo),
      fulfilled_at: i >= 12 ? iso(Math.max(0, daysAgo - 2)) : null,
      delivered_at: i >= 26 ? iso(Math.max(0, daysAgo - 8)) : null,
      created_at: iso(daysAgo),
      updated_at: iso(Math.max(0, daysAgo - 1)),
    })

    ds_order_items.push({
      id: `61000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      order_id: orderId,
      product_id: pick.pid,
      variant_id: pick.vid,
      supplier_id: pick.sup,
      sku: pick.sku,
      title: pick.title,
      quantity: qty,
      unit_price_cents: pick.price,
      unit_cost_cents: pick.cost,
      created_at: iso(daysAgo),
    })

    if (i >= 12 && i % 17 !== 0) {
      ds_fulfillments.push({
        id: `62000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        order_id: orderId,
        supplier_id: pick.sup,
        supplier_ref: `MOCK-ORD-${i}`,
        status: i >= 26 ? 'delivered' : 'shipped',
        tracking_number: `MK${String(900000 + i)}US`,
        tracking_url: `https://example.com/track/MK${String(900000 + i)}US`,
        carrier: 'Demo Post',
        cost_cents: cogs + 300,
        error_message: null,
        submitted_at: iso(daysAgo),
        shipped_at: iso(Math.max(0, daysAgo - 2)),
        delivered_at: i >= 26 ? iso(Math.max(0, daysAgo - 8)) : null,
        created_at: iso(daysAgo),
        updated_at: iso(Math.max(0, daysAgo - 1)),
      })
    }
  }

  const ds_ad_metrics: Row[] = []
  const adPlan = [
    { pid: P.halo, channel: 'meta', spend: 5200, imp: 41_000, clicks: 640, purchases: 7 },
    { pid: P.halo, channel: 'tiktok', spend: 3800, imp: 58_000, clicks: 720, purchases: 5 },
    { pid: P.drift, channel: 'meta', spend: 4100, imp: 33_000, clicks: 480, purchases: 4 },
    { pid: P.umbra, channel: 'tiktok', spend: 2600, imp: 39_000, clicks: 410, purchases: 2 },
    { pid: P.ridge, channel: 'meta', spend: 3400, imp: 21_000, clicks: 190, purchases: 1 },
  ]
  let adId = 1
  for (let d = 0; d < 28; d++) {
    for (const a of adPlan) {
      const wobble = 0.75 + ((d * 7 + a.spend) % 50) / 100
      const spend = Math.round(a.spend * wobble)
      const purchases = Math.max(0, Math.round(a.purchases * wobble))
      const price = a.pid === P.halo ? 4900 : a.pid === P.drift ? 5400 : a.pid === P.umbra ? 2900 : 3900
      ds_ad_metrics.push({
        id: `80000000-0000-4000-8000-${String(adId++).padStart(12, '0')}`,
        product_id: a.pid,
        channel: a.channel,
        campaign_ref: `${a.channel}-evergreen`,
        day: day(d),
        impressions: Math.round(a.imp * wobble),
        clicks: Math.round(a.clicks * wobble),
        spend_cents: spend,
        purchases,
        revenue_cents: purchases * price,
        source: 'manual',
        created_at: iso(d),
      })
    }
  }

  const ds_expenses: Row[] = [
    { id: '90000000-0000-4000-8000-000000000001', label: 'Shopify-equivalent hosting', category: 'software', amount_cents: 2900, day: day(20), recurring: true, created_at: iso(20) },
    { id: '90000000-0000-4000-8000-000000000002', label: 'Product samples', category: 'sampling', amount_cents: 18_400, day: day(40), recurring: false, created_at: iso(40) },
    { id: '90000000-0000-4000-8000-000000000003', label: 'UGC creator fee', category: 'creative', amount_cents: 25_000, day: day(14), recurring: false, created_at: iso(14) },
  ]

  return {
    ds_suppliers,
    ds_products,
    ds_product_variants,
    ds_product_images,
    ds_product_content: [],
    ds_supplier_products,
    ds_customers,
    ds_orders,
    ds_order_items,
    ds_fulfillments,
    ds_ad_metrics,
    ds_expenses,
    ds_recommendations: [],
    ds_events: [],
    ds_email_log: [],
    ds_abandoned_carts: [],
    ds_settings: [
      { key: 'default_currency', value: 'USD', updated_at: iso(90) },
      { key: 'payment_fee_percent', value: 2.9, updated_at: iso(90) },
      { key: 'payment_fee_fixed_cents', value: 30, updated_at: iso(90) },
      { key: 'target_roas', value: 2.0, updated_at: iso(90) },
      { key: 'low_stock_threshold', value: 10, updated_at: iso(90) },
    ],
  }
}
