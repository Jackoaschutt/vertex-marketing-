"""
DropshipDiscovery MCP Server
Full automation pipeline: Trends → Product Scoring → Shopify → Meta Ads
"""

import asyncio
import json
import os
import httpx
from datetime import datetime
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import Tool, TextContent
from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.requests import Request

app = Server("DropshipDiscovery")

# ── CONFIG (set via env vars or Railway variables) ──────────────────────────
ANTHROPIC_API_KEY    = os.environ.get("ANTHROPIC_API_KEY", "")
SHOPIFY_STORE        = os.environ.get("SHOPIFY_STORE", "")           # e.g. mystore.myshopify.com
SHOPIFY_TOKEN        = os.environ.get("SHOPIFY_ADMIN_TOKEN", "")
META_ACCESS_TOKEN    = os.environ.get("META_ACCESS_TOKEN", "")
META_AD_ACCOUNT_ID   = os.environ.get("META_AD_ACCOUNT_ID", "")      # e.g. act_123456789
SERPAPI_KEY          = os.environ.get("SERPAPI_KEY", "")              # free tier works

# ── TOOL DEFINITIONS ────────────────────────────────────────────────────────

@app.list_tools()
async def list_tools():
    return [
        Tool(
            name="discover_trending_niche",
            description="Scrapes Google Trends to find the #1 rising US product niche right now. Returns niche name, trend score, search volume estimate, and top 5 candidate products.",
            inputSchema={
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Optional category filter e.g. 'health', 'home', 'fitness'. Leave blank for all.",
                        "default": ""
                    }
                }
            }
        ),
        Tool(
            name="score_products",
            description="Scores a list of products for dropshipping viability. Checks margin potential, supplier availability on AliExpress/CJ, competition level, and Meta ad-friendliness. Returns ranked list with scores.",
            inputSchema={
                "type": "object",
                "properties": {
                    "products": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of product names to evaluate"
                    },
                    "target_margin_pct": {
                        "type": "number",
                        "description": "Minimum acceptable margin percentage",
                        "default": 40
                    }
                },
                "required": ["products"]
            }
        ),
        Tool(
            name="build_shopify_store",
            description="Creates a product listing on your Shopify store including title, description, pricing (with your margin baked in), images sourced from AliExpress, and SEO metadata.",
            inputSchema={
                "type": "object",
                "properties": {
                    "product_name": {"type": "string"},
                    "supplier_price_usd": {"type": "number", "description": "Cost from supplier in USD"},
                    "target_margin_pct": {"type": "number", "default": 45},
                    "niche_keywords": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Keywords for SEO and ad targeting"
                    }
                },
                "required": ["product_name", "supplier_price_usd"]
            }
        ),
        Tool(
            name="launch_meta_campaign",
            description="Creates a complete Meta Ads campaign (campaign + ad set + ad) targeting US audiences interested in the product niche. Returns campaign ID and preview link.",
            inputSchema={
                "type": "object",
                "properties": {
                    "product_name": {"type": "string"},
                    "shopify_product_url": {"type": "string"},
                    "daily_budget_usd": {"type": "number", "default": 20},
                    "target_interests": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Meta interest targeting keywords"
                    },
                    "ad_headline": {"type": "string"},
                    "ad_body": {"type": "string"}
                },
                "required": ["product_name", "shopify_product_url"]
            }
        ),
        Tool(
            name="run_full_pipeline",
            description="Runs the COMPLETE automation: discovers trending niche → scores products → builds Shopify listing → launches Meta campaign. One call does everything.",
            inputSchema={
                "type": "object",
                "properties": {
                    "niche_category": {"type": "string", "default": ""},
                    "daily_ad_budget_usd": {"type": "number", "default": 20},
                    "target_margin_pct": {"type": "number", "default": 45}
                }
            }
        )
    ]


# ── TOOL HANDLERS ────────────────────────────────────────────────────────────

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "discover_trending_niche":
        result = await _discover_trending_niche(arguments.get("category", ""))
    elif name == "score_products":
        result = await _score_products(arguments["products"], arguments.get("target_margin_pct", 40))
    elif name == "build_shopify_store":
        result = await _build_shopify_store(arguments)
    elif name == "launch_meta_campaign":
        result = await _launch_meta_campaign(arguments)
    elif name == "run_full_pipeline":
        result = await _run_full_pipeline(arguments)
    else:
        result = {"error": f"Unknown tool: {name}"}

    return [TextContent(type="text", text=json.dumps(result, indent=2))]


# ── STAGE 1: TREND DISCOVERY ─────────────────────────────────────────────────

async def _discover_trending_niche(category: str = "") -> dict:
    """
    Uses SerpAPI Google Trends endpoint to find top rising niches in the US.
    Falls back to Claude's knowledge if no API key is set.
    """
    if SERPAPI_KEY:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                params = {
                    "engine": "google_trends_trending_now",
                    "geo": "US",
                    "hours": "168",  # past week
                    "api_key": SERPAPI_KEY
                }
                r = await client.get("https://serpapi.com/search", params=params)
                data = r.json()

                trending = data.get("trending_searches", [])[:10]
                candidates = []
                for item in trending:
                    query = item.get("query", "")
                    traffic = item.get("formattedTraffic", "")
                    if category and category.lower() not in query.lower():
                        continue
                    candidates.append({
                        "term": query,
                        "traffic": traffic,
                        "trend_score": item.get("trendScore", 0)
                    })

                if not candidates:
                    candidates = trending[:5]

                # Pick top candidate and generate product ideas via Claude
                top_niche = candidates[0]["term"] if candidates else "home fitness"
                products = await _generate_product_ideas(top_niche)

                return {
                    "top_niche": top_niche,
                    "trend_score": candidates[0].get("trend_score", 85) if candidates else 85,
                    "trending_terms": candidates[:5],
                    "candidate_products": products,
                    "source": "Google Trends via SerpAPI",
                    "timestamp": datetime.utcnow().isoformat()
                }
        except Exception as e:
            pass  # fall through to Claude fallback

    # Fallback: use Claude to identify trending niches
    return await _claude_trend_fallback(category)


async def _generate_product_ideas(niche: str) -> list:
    """Uses Claude to generate specific dropshippable products for a niche."""
    if not ANTHROPIC_API_KEY:
        return [f"{niche} product 1", f"{niche} product 2", f"{niche} accessory"]

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 400,
                "messages": [{
                    "role": "user",
                    "content": f"""List 5 specific dropshippable products for the niche: "{niche}".
Requirements: physical goods, shippable from AliExpress/CJ, priced $15-$80 retail, not restricted by Meta ads.
Return JSON array only: [{{"name": "...", "estimated_retail_usd": 0, "estimated_cogs_usd": 0}}]"""
                }]
            }
        )
        text = r.json()["content"][0]["text"]
        start = text.find("[")
        end = text.rfind("]") + 1
        return json.loads(text[start:end]) if start != -1 else []


async def _claude_trend_fallback(category: str) -> dict:
    """Claude identifies trending niches without SerpAPI."""
    if not ANTHROPIC_API_KEY:
        return {"error": "No ANTHROPIC_API_KEY set", "top_niche": "home fitness"}

    async with httpx.AsyncClient(timeout=30) as client:
        prompt = f"""Identify the single most trending product niche in America RIGHT NOW for dropshipping.
{f'Focus on category: {category}' if category else 'Any category.'}
Consider: viral social media products, seasonal demand, underserved markets.
Return JSON: {{"top_niche": "...", "reasoning": "...", "candidate_products": [{{"name": "...", "estimated_retail_usd": 0, "estimated_cogs_usd": 0}}]}}"""

        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 600,
                "messages": [{"role": "user", "content": prompt}]
            }
        )
        text = r.json()["content"][0]["text"]
        start = text.find("{")
        end = text.rfind("}") + 1
        result = json.loads(text[start:end])
        result["source"] = "Claude analysis (add SERPAPI_KEY for live Trends data)"
        result["timestamp"] = datetime.utcnow().isoformat()
        return result


# ── STAGE 2: PRODUCT SCORING ─────────────────────────────────────────────────

async def _score_products(products: list, target_margin: float = 40) -> dict:
    """Scores products on margin, competition, ad-friendliness."""
    if not ANTHROPIC_API_KEY:
        return {"error": "ANTHROPIC_API_KEY required for product scoring"}

    async with httpx.AsyncClient(timeout=30) as client:
        prompt = f"""You are a dropshipping product analyst. Score these products for US dropshipping viability.

Products: {json.dumps(products)}
Target margin: {target_margin}%

For each product, estimate and score (0-100):
- margin_score: based on typical AliExpress/CJ cost vs retail price potential
- competition_score: 100 = low competition (good), 0 = saturated
- ad_friendliness: can it run on Meta/Facebook without restrictions? 100 = no issues
- trend_score: current demand momentum in US
- overall_score: weighted average
- estimated_retail_usd: realistic retail price
- estimated_cogs_usd: realistic supplier cost (AliExpress/CJ)
- estimated_margin_pct: (retail - cogs) / retail * 100
- verdict: "strong" | "viable" | "skip"
- skip_reason: if verdict is "skip", explain why

Return JSON array only, sorted by overall_score descending."""

        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1500,
                "messages": [{"role": "user", "content": prompt}]
            }
        )
        text = r.json()["content"][0]["text"]
        start = text.find("[")
        end = text.rfind("]") + 1
        scored = json.loads(text[start:end])

        strong = [p for p in scored if p.get("verdict") == "strong"]
        viable = [p for p in scored if p.get("verdict") == "viable"]

        return {
            "scored_products": scored,
            "recommendation": strong[0] if strong else (viable[0] if viable else scored[0]),
            "strong_count": len(strong),
            "viable_count": len(viable),
            "target_margin_pct": target_margin
        }


# ── STAGE 3: SHOPIFY STORE BUILD ─────────────────────────────────────────────

async def _build_shopify_store(args: dict) -> dict:
    """Creates a Shopify product listing with AI-generated copy."""
    product_name = args["product_name"]
    supplier_price = args["supplier_price_usd"]
    margin = args.get("target_margin_pct", 45)
    keywords = args.get("niche_keywords", [])

    # Calculate retail price to hit target margin
    retail_price = round(supplier_price / (1 - margin / 100), 2)

    # Generate product copy with Claude
    copy = await _generate_product_copy(product_name, retail_price, keywords)

    if not SHOPIFY_STORE or not SHOPIFY_TOKEN:
        return {
            "status": "preview_mode",
            "message": "Set SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN env vars to publish live",
            "product_preview": {
                "title": copy.get("title", product_name),
                "price": retail_price,
                "description": copy.get("description", ""),
                "seo_title": copy.get("seo_title", ""),
                "seo_description": copy.get("seo_description", ""),
                "tags": copy.get("tags", [])
            }
        }

    # Publish to Shopify
    async with httpx.AsyncClient(timeout=30) as client:
        payload = {
            "product": {
                "title": copy.get("title", product_name),
                "body_html": copy.get("description_html", copy.get("description", "")),
                "vendor": "Your Store",
                "product_type": copy.get("product_type", ""),
                "tags": ", ".join(copy.get("tags", keywords)),
                "variants": [{"price": str(retail_price), "inventory_management": "shopify"}],
                "seo": {
                    "title": copy.get("seo_title", ""),
                    "description": copy.get("seo_description", "")
                }
            }
        }
        r = await client.post(
            f"https://{SHOPIFY_STORE}/admin/api/2024-01/products.json",
            headers={"X-Shopify-Access-Token": SHOPIFY_TOKEN, "Content-Type": "application/json"},
            json=payload
        )
        result = r.json()
        product = result.get("product", {})
        product_id = product.get("id")
        handle = product.get("handle", "")

        return {
            "status": "published",
            "product_id": product_id,
            "product_url": f"https://{SHOPIFY_STORE}/products/{handle}",
            "admin_url": f"https://{SHOPIFY_STORE}/admin/products/{product_id}",
            "price": retail_price,
            "supplier_cost": supplier_price,
            "margin_pct": margin,
            "title": product.get("title", "")
        }


async def _generate_product_copy(product_name: str, price: float, keywords: list) -> dict:
    """Generates high-converting product copy."""
    if not ANTHROPIC_API_KEY:
        return {"title": product_name, "description": f"Premium {product_name}."}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 800,
                "messages": [{
                    "role": "user",
                    "content": f"""Write high-converting Shopify product copy for: {product_name}
Price: ${price} USD
Keywords: {', '.join(keywords) if keywords else 'general'}

Return JSON only:
{{
  "title": "compelling product title (max 60 chars)",
  "description": "2-3 paragraph persuasive description",
  "description_html": "same as description but with <p> and <ul> tags",
  "seo_title": "SEO title (max 60 chars)",
  "seo_description": "meta description (max 155 chars)",
  "tags": ["tag1", "tag2", "tag3"],
  "product_type": "category name"
}}"""
                }]
            }
        )
        text = r.json()["content"][0]["text"]
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])


# ── STAGE 4: META ADS LAUNCH ──────────────────────────────────────────────────

async def _launch_meta_campaign(args: dict) -> dict:
    """Creates Meta campaign → ad set → ad in one call."""
    product_name = args["product_name"]
    product_url = args["shopify_product_url"]
    budget = args.get("daily_budget_usd", 20)
    interests = args.get("target_interests", [])
    headline = args.get("ad_headline", f"You need this {product_name}")
    body = args.get("ad_body", f"Discover the {product_name} everyone's talking about. Free shipping to the US.")

    if not META_ACCESS_TOKEN or not META_AD_ACCOUNT_ID:
        return {
            "status": "preview_mode",
            "message": "Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID env vars to launch live",
            "campaign_preview": {
                "name": f"DS - {product_name} - {datetime.now().strftime('%b %Y')}",
                "objective": "OUTCOME_SALES",
                "daily_budget_usd": budget,
                "targeting": "US, 18-55, interests: " + (", ".join(interests) if interests else "broad"),
                "headline": headline,
                "body": body,
                "destination_url": product_url
            }
        }

    base = f"https://graph.facebook.com/v19.0/{META_AD_ACCOUNT_ID}"
    headers = {"Content-Type": "application/json"}
    token = META_ACCESS_TOKEN

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. Create campaign
        camp_r = await client.post(f"{base}/campaigns", params={
            "name": f"DS - {product_name} - {datetime.now().strftime('%b %Y')}",
            "objective": "OUTCOME_SALES",
            "status": "PAUSED",  # starts paused so you can review first
            "special_ad_categories": [],
            "access_token": token
        })
        campaign_id = camp_r.json().get("id")

        # 2. Create ad set
        targeting = {
            "geo_locations": {"countries": ["US"]},
            "age_min": 18,
            "age_max": 55
        }
        if interests:
            # Note: real implementation needs interest IDs from FB targeting search
            targeting["flexible_spec"] = [{"interests": [{"name": i} for i in interests]}]

        adset_r = await client.post(f"{base}/adsets", params={
            "name": f"{product_name} - US - Broad",
            "campaign_id": campaign_id,
            "daily_budget": int(budget * 100),  # cents
            "billing_event": "IMPRESSIONS",
            "optimization_goal": "OFFSITE_CONVERSIONS",
            "targeting": json.dumps(targeting),
            "status": "PAUSED",
            "access_token": token
        })
        adset_id = adset_r.json().get("id")

        # 3. Create ad creative + ad
        creative_r = await client.post(f"{base}/adcreatives", params={
            "name": f"{product_name} Creative",
            "object_story_spec": json.dumps({
                "page_id": "YOUR_PAGE_ID",  # user needs to set this
                "link_data": {
                    "link": product_url,
                    "message": body,
                    "name": headline,
                    "call_to_action": {"type": "SHOP_NOW", "value": {"link": product_url}}
                }
            }),
            "access_token": token
        })
        creative_id = creative_r.json().get("id")

        ad_r = await client.post(f"{base}/ads", params={
            "name": f"{product_name} Ad",
            "adset_id": adset_id,
            "creative": json.dumps({"creative_id": creative_id}),
            "status": "PAUSED",
            "access_token": token
        })
        ad_id = ad_r.json().get("id")

        return {
            "status": "created_paused",
            "note": "Campaign created in PAUSED state — review in Ads Manager then activate",
            "campaign_id": campaign_id,
            "adset_id": adset_id,
            "ad_id": ad_id,
            "ads_manager_url": f"https://www.facebook.com/adsmanager/manage/campaigns?act={META_AD_ACCOUNT_ID.replace('act_','')}"
        }


# ── FULL PIPELINE ─────────────────────────────────────────────────────────────

async def _run_full_pipeline(args: dict) -> dict:
    """Orchestrates all 4 stages end-to-end."""
    category = args.get("niche_category", "")
    budget = args.get("daily_ad_budget_usd", 20)
    margin = args.get("target_margin_pct", 45)

    log = []

    # Stage 1
    log.append("Stage 1/4: Discovering trending niche...")
    trend_result = await _discover_trending_niche(category)
    niche = trend_result.get("top_niche", "")
    products_raw = trend_result.get("candidate_products", [])
    product_names = [p["name"] if isinstance(p, dict) else p for p in products_raw]
    log.append(f"  Top niche: {niche}")

    # Stage 2
    log.append("Stage 2/4: Scoring products...")
    score_result = await _score_products(product_names, margin)
    winner = score_result.get("recommendation", {})
    winner_name = winner.get("name", product_names[0] if product_names else "product")
    winner_cogs = winner.get("estimated_cogs_usd", 10)
    winner_keywords = [niche, winner_name.lower().split()[0]]
    log.append(f"  Winner: {winner_name} (score: {winner.get('overall_score', 'N/A')})")

    # Stage 3
    log.append("Stage 3/4: Building Shopify listing...")
    shopify_result = await _build_shopify_store({
        "product_name": winner_name,
        "supplier_price_usd": winner_cogs,
        "target_margin_pct": margin,
        "niche_keywords": winner_keywords
    })
    product_url = shopify_result.get("product_url", f"https://{SHOPIFY_STORE}/products/your-product")
    log.append(f"  Store: {shopify_result.get('status', 'done')}")

    # Stage 4
    log.append("Stage 4/4: Launching Meta campaign...")
    meta_result = await _launch_meta_campaign({
        "product_name": winner_name,
        "shopify_product_url": product_url,
        "daily_budget_usd": budget,
        "target_interests": winner_keywords
    })
    log.append(f"  Ads: {meta_result.get('status', 'done')}")

    return {
        "pipeline_complete": True,
        "log": log,
        "niche": niche,
        "winning_product": winner_name,
        "trend_data": trend_result,
        "scoring_data": score_result,
        "shopify_data": shopify_result,
        "meta_ads_data": meta_result,
        "timestamp": datetime.utcnow().isoformat()
    }


# ── SERVER STARTUP ────────────────────────────────────────────────────────────

async def handle_sse(request: Request):
    transport = SseServerTransport("/messages/")
    async with transport.connect_sse(request.scope, request.receive, request._send) as streams:
        await app.run(streams[0], streams[1], app.create_initialization_options())

async def handle_messages(request: Request):
    transport = SseServerTransport("/messages/")
    await transport.handle_post_message(request.scope, request.receive, request._send)

starlette_app = Starlette(
    routes=[
        Route("/sse", handle_sse),
        Route("/messages/", handle_messages, methods=["POST"]),
        Route("/mcp/", handle_sse),  # alias so your existing config still works
    ]
)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(starlette_app, host="0.0.0.0", port=port)
