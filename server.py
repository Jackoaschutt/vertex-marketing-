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

ANTHROPIC_API_KEY    = os.environ.get("ANTHROPIC_API_KEY", "")
SHOPIFY_STORE        = os.environ.get("SHOPIFY_STORE", "")
SHOPIFY_TOKEN        = os.environ.get("SHOPIFY_ADMIN_TOKEN", "")
META_ACCESS_TOKEN    = os.environ.get("META_ACCESS_TOKEN", "")
META_AD_ACCOUNT_ID   = os.environ.get("META_AD_ACCOUNT_ID", "")
SERPAPI_KEY          = os.environ.get("SERPAPI_KEY", "")

@app.list_tools()
async def list_tools():
    return [
        Tool(name="run_full_pipeline", description="Runs the COMPLETE automation: discovers trending niche → scores products → builds Shopify listing → launches Meta campaign.", inputSchema={"type":"object","properties":{"niche_category":{"type":"string","default":""},"daily_ad_budget_usd":{"type":"number","default":20},"target_margin_pct":{"type":"number","default":45}}}),
        Tool(name="discover_trending_niche", description="Finds the #1 rising US product niche right now.", inputSchema={"type":"object","properties":{"category":{"type":"string","default":""}}}),
        Tool(name="score_products", description="Scores products for dropshipping viability.", inputSchema={"type":"object","properties":{"products":{"type":"array","items":{"type":"string"}},"target_margin_pct":{"type":"number","default":40}},"required":["products"]}),
        Tool(name="launch_meta_campaign", description="Creates a Meta Ads campaign targeting US audiences.", inputSchema={"type":"object","properties":{"product_name":{"type":"string"},"shopify_product_url":{"type":"string"},"daily_budget_usd":{"type":"number","default":20},"target_interests":{"type":"array","items":{"type":"string"}},"ad_headline":{"type":"string"},"ad_body":{"type":"string"}},"required":["product_name","shopify_product_url"]}),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "run_full_pipeline":
        result = await _run_full_pipeline(arguments)
    elif name == "discover_trending_niche":
        result = await _discover_trending_niche(arguments.get("category", ""))
    elif name == "score_products":
        result = await _score_products(arguments["products"], arguments.get("target_margin_pct", 40))
    elif name == "launch_meta_campaign":
        result = await _launch_meta_campaign(arguments)
    else:
        result = {"error": f"Unknown tool: {name}"}
    return [TextContent(type="text", text=json.dumps(result, indent=2))]

async def _claude(prompt: str, max_tokens: int = 800) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post("https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            json={"model": "claude-sonnet-4-20250514", "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]})
        return r.json()["content"][0]["text"]

async def _discover_trending_niche(category: str = "") -> dict:
    prompt = f"""Identify the single most trending product niche in America RIGHT NOW for dropshipping.
{f'Focus on category: {category}' if category else 'Any category.'}
Return JSON only: {{"top_niche": "...", "reasoning": "...", "candidate_products": [{{"name": "...", "estimated_retail_usd": 0, "estimated_cogs_usd": 0}}]}}"""
    text = await _claude(prompt, 600)
    result = json.loads(text[text.find("{"):text.rfind("}")+1])
    result["timestamp"] = datetime.utcnow().isoformat()
    return result

async def _score_products(products: list, target_margin: float = 40) -> dict:
    prompt = f"""Score these products for US dropshipping viability: {json.dumps(products)}
Target margin: {target_margin}%
Return JSON array only, sorted by overall_score desc:
[{{"name":"...","overall_score":0,"margin_score":0,"competition_score":0,"ad_friendliness":0,"estimated_retail_usd":0,"estimated_cogs_usd":0,"estimated_margin_pct":0,"verdict":"strong|viable|skip","skip_reason":"..."}}]"""
    text = await _claude(prompt, 1500)
    scored = json.loads(text[text.find("["):text.rfind("]")+1])
    strong = [p for p in scored if p.get("verdict") == "strong"]
    viable = [p for p in scored if p.get("verdict") == "viable"]
    return {"scored_products": scored, "recommendation": strong[0] if strong else (viable[0] if viable else scored[0])}

async def _launch_meta_campaign(args: dict) -> dict:
    product_name = args["product_name"]
    product_url = args["shopify_product_url"]
    budget = args.get("daily_budget_usd", 20)
    interests = args.get("target_interests", [])
    headline = args.get("ad_headline", f"You need this {product_name}")
    body = args.get("ad_body", f"Discover the {product_name} everyone's talking about. Free US shipping.")

    if not META_ACCESS_TOKEN or not META_AD_ACCOUNT_ID:
        return {"status": "preview_mode", "message": "Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to launch live", "preview": {"name": f"DS - {product_name}", "budget": budget, "url": product_url}}

    base = f"https://graph.facebook.com/v19.0/{META_AD_ACCOUNT_ID}"
    async with httpx.AsyncClient(timeout=30) as client:
        camp = await client.post(f"{base}/campaigns", params={"name": f"DS - {product_name} - {datetime.now().strftime('%b %Y')}", "objective": "OUTCOME_SALES", "status": "PAUSED", "special_ad_categories": "[]", "access_token": META_ACCESS_TOKEN})
        campaign_id = camp.json().get("id")
        targeting = {"geo_locations": {"countries": ["US"]}, "age_min": 18, "age_max": 55}
        adset = await client.post(f"{base}/adsets", params={"name": f"{product_name} - US Broad", "campaign_id": campaign_id, "daily_budget": int(budget*100), "billing_event": "IMPRESSIONS", "optimization_goal": "OFFSITE_CONVERSIONS", "targeting": json.dumps(targeting), "status": "PAUSED", "access_token": META_ACCESS_TOKEN})
        adset_id = adset.json().get("id")
        return {"status": "created_paused", "campaign_id": campaign_id, "adset_id": adset_id, "note": "Review in Ads Manager then activate", "ads_manager_url": f"https://www.facebook.com/adsmanager/manage/campaigns"}

async def _run_full_pipeline(args: dict) -> dict:
    log = []
    log.append("Stage 1/3: Discovering trending niche...")
    trend = await _discover_trending_niche(args.get("niche_category", ""))
    niche = trend.get("top_niche", "")
    products_raw = trend.get("candidate_products", [])
    product_names = [p["name"] if isinstance(p, dict) else p for p in products_raw]
    log.append(f"Top niche: {niche}")

    log.append("Stage 2/3: Scoring products...")
    scores = await _score_products(product_names, args.get("target_margin_pct", 45))
    winner = scores.get("recommendation", {})
    winner_name = winner.get("name", product_names[0] if product_names else "product")
    log.append(f"Winner: {winner_name} (score: {winner.get('overall_score', 'N/A')})")

    log.append("Stage 3/3: Launching Meta campaign...")
    meta = await _launch_meta_campaign({"product_name": winner_name, "shopify_product_url": f"https://yourstore.com/products/{winner_name.lower().replace(' ','-')}", "daily_budget_usd": args.get("daily_ad_budget_usd", 20), "target_interests": [niche]})
    log.append(f"Ads: {meta.get('status', 'done')}")

    return {"pipeline_complete": True, "log": log, "niche": niche, "winning_product": winner_name, "trend_data": trend, "scoring_data": scores, "meta_ads_data": meta, "timestamp": datetime.utcnow().isoformat()}

async def handle_sse(request: Request):
    transport = SseServerTransport("/messages/")
    async with transport.connect_sse(request.scope, request.receive, request._send) as streams:
        await app.run(streams[0], streams[1], app.create_initialization_options())

async def handle_messages(request: Request):
    transport = SseServerTransport("/messages/")
    await transport.handle_post_message(request.scope, request.receive, request._send)

starlette_app = Starlette(routes=[Route("/sse", handle_sse), Route("/messages/", handle_messages, methods=["POST"]), Route("/mcp/", handle_sse)])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(starlette_app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
