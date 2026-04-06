"""Scheduled job for fetching stock prices from OpenBB API."""

import frappe
from frappe.utils import nowdate, add_days


def fetch_daily_prices():
	"""Scheduled job: fetch prices for all active stocks."""
	settings = frappe.get_single("Market Settings")
	if not settings.auto_fetch_prices:
		return

	from lifegence_market.services.openbb_client import OpenBBClient

	client = OpenBBClient()

	if not client.health_check():
		frappe.log_error("OpenBB API unavailable during scheduled fetch", "Market Data")
		return

	stocks = frappe.get_all("Stock Master", filters={"is_active": 1}, fields=["name", "symbol"])

	for stock in stocks:
		try:
			_fetch_and_store_prices(client, stock)
		except Exception as e:
			frappe.log_error(f"Price fetch failed for {stock.symbol}: {e}", "Market Data")

	frappe.db.commit()


def _fetch_and_store_prices(client, stock):
	"""Fetch prices for a single stock and store in Stock Price doctype."""
	last_date = frappe.db.get_value(
		"Stock Price",
		{"stock": stock.name},
		"date",
		order_by="date desc",
	)
	start_date = add_days(last_date, 1) if last_date else add_days(nowdate(), -30)

	result = client.get_historical_prices(stock.symbol, start_date=str(start_date))
	if not result or "results" not in result:
		return

	for row in result["results"]:
		date_val = row.get("date", "")[:10]
		if frappe.db.exists("Stock Price", {"stock": stock.name, "date": date_val}):
			continue

		doc = frappe.new_doc("Stock Price")
		doc.stock = stock.name
		doc.date = date_val
		doc.open_price = row.get("open")
		doc.high = row.get("high")
		doc.low = row.get("low")
		doc.close_price = row.get("close")
		doc.volume = row.get("volume")
		doc.insert(ignore_permissions=True)

	# Update last_price on Stock Master
	if result["results"]:
		latest = result["results"][-1]
		frappe.db.set_value("Stock Master", stock.name, {
			"last_price": latest.get("close"),
			"last_price_date": latest.get("date", "")[:10],
		})
