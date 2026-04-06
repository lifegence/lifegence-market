"""Whitelisted API endpoints for market data operations."""

import frappe


@frappe.whitelist()
def fetch_stock_prices(stock_name):
	"""Fetch and cache stock prices on demand."""
	from lifegence_market.services.openbb_client import OpenBBClient
	from lifegence_market.services.price_fetcher import _fetch_and_store_prices

	stock = frappe.get_doc("Stock Master", stock_name)
	client = OpenBBClient()
	_fetch_and_store_prices(client, frappe._dict({"name": stock.name, "symbol": stock.symbol}))
	frappe.db.commit()
	return {"status": "ok", "symbol": stock.symbol}


@frappe.whitelist()
def check_openbb_status():
	"""Check if OpenBB API is reachable."""
	from lifegence_market.services.openbb_client import OpenBBClient

	client = OpenBBClient()
	return {"connected": client.health_check()}
