app_name = "lifegence_market"
app_title = "Lifegence Market"
app_publisher = "Lifegence"
app_description = "Stock Market Data Management powered by OpenBB"
app_email = "masakazu@lifegence.co.jp"
app_license = "mit"

required_apps = ["frappe"]

after_install = "lifegence_market.install.after_install"

add_to_apps_screen = [
	{
		"name": app_name,
		"logo": "/assets/lifegence_market/images/logo.svg",
		"title": "株式市場",
		"route": "/app/stock-master",
	}
]

fixtures = [
	"Market Settings",
]

scheduler_events = {
	"daily": [
		"lifegence_market.services.price_fetcher.fetch_daily_prices",
	],
}
