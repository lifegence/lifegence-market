"""Whitelisted API endpoints for market data operations."""

import frappe
from frappe.utils import add_days, getdate, nowdate


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


@frappe.whitelist()
def get_chart_data(symbol, period="6M"):
	"""Get OHLCV chart data for a stock symbol.

	Args:
		symbol: Stock Master name (e.g. "7203.T")
		period: Time period - 1W, 1M, 3M, 6M, 1Y, ALL
	"""
	today = getdate(nowdate())
	period_map = {
		"1W": 7,
		"1M": 30,
		"3M": 90,
		"6M": 180,
		"1Y": 365,
	}

	filters = {"stock": symbol}
	if period != "ALL":
		days = period_map.get(period, 180)
		start_date = add_days(today, -days)
		filters["date"] = [">=", start_date]

	data = frappe.get_all(
		"Stock Price",
		filters=filters,
		fields=["date", "open_price", "high", "low", "close_price", "volume"],
		order_by="date asc",
		limit_page_length=0,
	)

	return {
		"symbol": symbol,
		"period": period,
		"data": [
			{
				"time": str(row.date),
				"open": row.open_price,
				"high": row.high,
				"low": row.low,
				"close": row.close_price,
				"volume": row.volume or 0,
			}
			for row in data
		],
	}


@frappe.whitelist()
def get_stock_summary(symbol):
	"""Get summary data for a stock (latest price, change, high/low)."""
	stock = frappe.get_doc("Stock Master", symbol)

	latest = frappe.get_all(
		"Stock Price",
		filters={"stock": symbol},
		fields=["date", "open_price", "high", "low", "close_price", "volume"],
		order_by="date desc",
		limit_page_length=2,
	)

	if not latest:
		return {
			"symbol": stock.symbol,
			"stock_name": stock.stock_name,
			"has_data": False,
		}

	current = latest[0]
	prev = latest[1] if len(latest) > 1 else None

	change = 0
	change_pct = 0
	if prev and prev.close_price:
		change = current.close_price - prev.close_price
		change_pct = (change / prev.close_price) * 100

	# 52-week high/low
	year_ago = add_days(getdate(nowdate()), -365)
	extremes = frappe.db.sql(
		"""
		SELECT MAX(high) as high_52w, MIN(low) as low_52w
		FROM `tabStock Price`
		WHERE stock = %s AND date >= %s
		""",
		(symbol, year_ago),
		as_dict=True,
	)

	return {
		"symbol": stock.symbol,
		"stock_name": stock.stock_name,
		"stock_name_en": stock.stock_name_en or "",
		"exchange": stock.exchange or "",
		"has_data": True,
		"last_price": current.close_price,
		"last_date": str(current.date),
		"open": current.open_price,
		"high": current.high,
		"low": current.low,
		"volume": current.volume or 0,
		"change": round(change, 2),
		"change_pct": round(change_pct, 2),
		"high_52w": extremes[0].high_52w if extremes else None,
		"low_52w": extremes[0].low_52w if extremes else None,
	}


@frappe.whitelist()
def get_active_stocks():
	"""Get all active stocks for the stock selector."""
	return frappe.get_all(
		"Stock Master",
		filters={"is_active": 1},
		fields=["name", "symbol", "stock_name", "stock_name_en", "exchange", "last_price", "last_price_date"],
		order_by="symbol asc",
	)
