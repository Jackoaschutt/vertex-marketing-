import json
import os
import httpx
from datetime import datetime
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("DropshipDiscovery")

ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
META_ACCESS_TOKEN  = os.environ.get("META_ACCESS_TOKEN", "")
META_AD_ACCOUNT_ID = os.environ.get("META_AD_ACCOUNT_ID", "")

async def _claude(prompt: str, max_tokens: int = 800) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            json={"model": "claude-sonnet-4-20250514", "max_tokens": max_tokens,
                  "messages": [{"role": "user", "content": prompt}]}
        )
        return r.json()["content"][0]["text"]

def _parse_json(text: str, array: bool = False) -> any:
    char = "[" if array else "{"
    end  = "]" if array else "}"
    return json.loads(text[text.find(char):text.rfind(end)+1])

@mcp.tool()
async def discover_trending_niche(category: str = "") -> str:
    """Find the #1 trending US product niche right now for dropshipping."""
    prompt = f"""Identify the single most trending product niche in America RIGHT NOW for dropshipping.
{f'Focus on category: {category}' if category else 'Any category.'}
Return JSON only: {{"top_niche": "...", "reasoning": "...", "candidate_products": [{{"name": "...", "estimated_retail_usd": 0, "estimated_cogs_usd": 0}}]}}"""
    text = await _claude(prompt, 600)
    result = _parse_json(text)
    result["timestamp"] = datetime.utcnow().isoformat()
    return json.dumps(result, indent=2)

@mcp.tool()
async def score_products(products: list, target_margin_pct: float = 40) -> str:
    """Score a list of products for US dropshipping viability."""
    prompt = f"""Score these products for US dropshipping: {json.dumps(products)}
Target margin: {target_margin_pct}%
Return JSON array sorted by overall_score desc:
[{{"name":"...","overall_score":0,"margin_score":0,"competition_score":0,"ad_friendliness":0,"estimated_retail_usd":0,"estimated_cogs_usd":0,"estimated_margin_pct":0,"verdict":"strong|viable|skip","skip_reason":"..."}}]"""
    text = await _claude(prompt, 1500)
    scored = _parse_json(text, array=True)
    strong = [p for p in scored if p.get("verdict") == "strong"]
    viable = [p for p in scored if p.get("verdict") == "viable"]
    return json.dumps({"scored_products": scored, "recommendation": strong[0] if strong else (viable[0] if viable else scored[0])}, indent=2)

@mcp.tool()
async def launch_meta_campaign(product_name: str, shopify_product_url: str,
                                daily_budget_usd: float = 20,
                                target_interests: list = None,
                                ad_headline: str = "", ad_body: str = "") -> str:
    """Create a Meta Ads campaign targeting US audiences."""
    if not ad_headline:
        ad_headline = f"You need this {product_name}"
    if not ad_body:
        ad_body = f"Discover the {product_name} everyone's talking about. Free US shipping."
    if not target_interests:
        target_interests = []
    if not META_ACCESS_TOKEN or not META_AD_ACCOUNT_ID:
        return json.dumps({"status": "preview_mode", "message": "Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to launch live", "preview": {"name": f"DS - {product_name}", "budget": daily_budget_usd, "url": shopify_product_url}}, indent=2)
    base = f"https://graph.facebook.com/v19.0/{META_AD_ACCOUNT_ID}"
    async with httpx.AsyncClient(timeout=30) as client:
        camp = await client.post(f"{base}/campaigns", params={"name": f"DS - {product_name} - {datetime.now().strftime('%b %Y')}", "objective": "OUTCOME_SALES", "status": "PAUSED", "special_ad_categories": "[]", "access_token": META_ACCESS_TOKEN})
        campaign_id = camp.json().get("id")
        targeting = {"geo_locations": {"countries": ["US"]}, "age_min": 18, "age_max": 55}
        adset = await client.post(f"{base}/adsets", params={"name": f"{product_name} - US Broad", "campaign_id": campaign_id, "daily_budget": int(daily_budget_usd * 100), "billing_event": "IMPRESSIONS", "optimization_goal": "OFFSITE_CONVERSIONS", "targeting": json.dumps(targeting), "status": "PAUSED", "access_token": META_ACCESS_TOKEN})
        return json.dumps({"status": "created_paused", "campaign_id": camp.json().get("id"), "adset_id": adset.json().get("id"), "note": "Review in Ads Manager then activate", "ads_manager_url": "https://www.facebook.com/adsmanager/manage/campaigns"}, indent=2)

@mcp.tool()
async def run_full_pipeline(niche_category: str = "", daily_ad_budget_usd: float = 20, target_margin_pct: float = 45) -> str:
    """Run the COMPLETE dropship automation: trending niche → score products → launch Meta campaign."""
    log = []
    log.append("Stage 1/3: Discovering trending niche...")
    trend = json.loads(await discover_trending_niche(niche_category))
    niche = trend.get("top_niche", "")
    product_names = [p["name"] if isinstance(p, dict) else p for p in trend.get("candidate_products", [])]
    log.append(f"Top niche: {niche}")
    log.append("Stage 2/3: Scoring products...")
    scores = json.loads(await score_products(product_names, target_margin_pct))
    winner = scores.get("recommendation", {})
    winner_name = winner.get("name", product_names[0] if product_names else "product")
    log.append(f"Winner: {winner_name}")
    log.append("Stage 3/3: Launching Meta campaign...")
    meta = json.loads(await launch_meta_campaign(winner_name, f"https://yourstore.com/products/{winner_name.lower().replace(' ','-')}", daily_ad_budget_usd, [niche]))
    log.append(f"Ads: {meta.get('status', 'done')}")
    return json.dumps({"pipeline_complete": True, "log": log, "niche": niche, "winning_product": winner_name, "trend_data": trend, "scoring_data": scores, "meta_ads_data": meta, "timestamp": datetime.utcnow().isoformat()}, indent=2)

if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))