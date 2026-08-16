/**
 * Search links, built from what you type.
 *
 * This app has no server, which means it cannot call Google, Meta or any
 * supplier API directly. Two hard reasons, not preferences:
 *
 *   1. Those APIs need a key. A key in a browser page is readable by anyone who
 *      opens the developer tools, so it is not a secret — it is a published
 *      password on your account.
 *   2. Browsers block a page from calling most other sites' APIs (CORS). Even
 *      with a key it would not work from here.
 *
 * What a page *can* do is build the right search and open it. That is most of
 * the value anyway: the slow part of sourcing is knowing which six places to
 * look and what to search for, not the clicking.
 */

export interface SearchLink {
  label: string
  url: string
  /** What you are actually looking for when you open this one. */
  looking: string
}

const q = (s: string) => encodeURIComponent(s.trim())

/** Where to find a supplier for a product, and what each source is good for. */
export function supplierSearches(product: string): SearchLink[] {
  if (!product.trim()) return []
  return [
    {
      label: 'AliExpress',
      url: `https://www.aliexpress.com/wholesale?SearchText=${q(product)}`,
      looking: 'Single-unit pricing and what the product actually looks like. Sort by orders, not by price — volume means someone has already proved it ships.',
    },
    {
      label: 'Alibaba',
      url: `https://www.alibaba.com/trade/search?SearchText=${q(product)}`,
      looking: 'Bulk pricing and manufacturers. Much cheaper per unit but with minimum orders. Worth it once a product is proven, not before.',
    },
    {
      label: 'CJdropshipping',
      url: `https://cjdropshipping.com/list/search?search=${q(product)}`,
      looking: 'Dropship-friendly fulfilment with faster shipping than AliExpress, usually at a slightly higher unit cost.',
    },
    {
      label: 'Amazon',
      url: `https://www.amazon.co.uk/s?k=${q(product)}`,
      looking: 'What customers already pay retail. This is your price ceiling — if Amazon is cheaper with next-day delivery, you have a problem.',
    },
    {
      label: 'Google Shopping',
      url: `https://www.google.com/search?tbm=shop&q=${q(product)}`,
      looking: 'How many people already sell it and at what spread. No results usually means no market rather than an untapped one.',
    },
    {
      label: 'Google Trends',
      url: `https://trends.google.com/trends/explore?q=${q(product)}`,
      looking: 'Whether interest is rising, flat or falling over 12 months. Check for a seasonal shape before reading a rise as growth.',
    },
  ]
}

/** Where to see what is already being advertised, and how. */
export function adSearches(product: string): SearchLink[] {
  if (!product.trim()) return []
  return [
    {
      label: 'Meta Ad Library',
      url: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=GB&q=${q(product)}&search_type=keyword_unordered`,
      looking: 'Every ad currently running for this. Long-running ads are the signal — nobody keeps paying for a losing ad. Note the hook in the first three seconds.',
    },
    {
      label: 'TikTok Creative Center',
      url: `https://ads.tiktok.com/business/creativecenter/topads/pc/en?search=${q(product)}`,
      looking: 'Top-performing TikTok ads by engagement. Useful for format and pacing even if you sell elsewhere.',
    },
    {
      label: 'TikTok',
      url: `https://www.tiktok.com/search?q=${q(product)}`,
      looking: 'Organic videos. If real people already film this product unprompted, your creative problem is mostly solved.',
    },
    {
      label: 'Reddit',
      url: `https://www.google.com/search?q=${q(product + ' site:reddit.com')}`,
      looking: 'What buyers complain about in their own words. The complaints are your ad angles and your returns risk.',
    },
  ]
}

/** Opened when you have no product in mind yet. */
export const DISCOVERY_LINKS: SearchLink[] = [
  {
    label: 'Meta Ad Library — top spenders',
    url: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=GB',
    looking: 'Browse by keyword or advertiser. Filter to ads running a long time; those are the profitable ones.',
  },
  {
    label: 'TikTok Creative Center',
    url: 'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
    looking: 'What is working right now by category and country.',
  },
  {
    label: 'Amazon Movers & Shakers',
    url: 'https://www.amazon.co.uk/gp/movers-and-shakers',
    looking: 'Biggest risers in the last 24 hours. Demand that is moving, not just demand that exists.',
  },
  {
    label: 'Google Trends — rising',
    url: 'https://trends.google.com/trending?geo=GB',
    looking: 'What is being searched more than usual today.',
  },
]
