import frappe


def after_install():
	"""Run after app installation."""
	try:
		create_default_settings()
		create_initial_stocks()
		frappe.db.commit()
		frappe.msgprint("Lifegence Market: Setup completed successfully.")
	except Exception:
		frappe.log_error("Lifegence Market: Error during post-install setup")
		raise


def create_default_settings():
	"""Create Market Settings singleton if not exists."""
	if not frappe.db.exists("Market Settings", "Market Settings"):
		doc = frappe.new_doc("Market Settings")
		doc.openbb_api_url = "http://localhost:6900"
		doc.default_provider = "yfinance"
		doc.api_timeout = 30
		doc.auto_fetch_prices = 1
		doc.insert(ignore_permissions=True)


def create_initial_stocks():
	"""Create initial stock master records."""
	stocks = [
		{
			"symbol": "7012.T",
			"stock_name": "川崎重工業",
			"stock_name_en": "Kawasaki Heavy Industries",
			"exchange": "TSE/Tokyo",
			"currency": "JPY",
		},
		{
			"symbol": "285A.T",
			"stock_name": "キオクシア",
			"stock_name_en": "Kioxia",
			"exchange": "TSE/Tokyo",
			"currency": "JPY",
		},
		{
			"symbol": "7203.T",
			"stock_name": "トヨタ自動車",
			"stock_name_en": "Toyota Motor",
			"exchange": "TSE/Tokyo",
			"currency": "JPY",
		},
	]
	for s in stocks:
		if not frappe.db.exists("Stock Master", {"symbol": s["symbol"]}):
			doc = frappe.new_doc("Stock Master")
			doc.update(s)
			doc.insert(ignore_permissions=True)
