import json
import os
import httpx
from datetime import datetime

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("DropshipDiscovery")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
META_ACCESS_TOKEN = os.environ.get("META_ACCESS_TOKEN", "")
META_AD_ACCOUNT_ID = os.environ.get("META_AD_ACCOUNT_ID", "")

@mcp.tool()
async def run_full_pipeline(niche_category: str = "") -> str:
    """Run the complete dropship automation pipeline."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1000,
                "messages": [{"role": "user", "content": f"What is the #1 trending dropship product niche in the US right now? {niche_category}. Give me: top niche, 3 products, estimated retail price, estimated cost, and margin."}]
            }
        )
        return r.json()["content"][0]["text"]

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    mcp.run(transport="sse")