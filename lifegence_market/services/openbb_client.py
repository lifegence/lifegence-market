"""
OpenBB API HTTP Client.

This module communicates with the OpenBB API server via HTTP only.
It must NEVER import any openbb package to maintain AGPL license isolation.
"""

import frappe
import requests


class OpenBBClient:
	"""HTTP client for OpenBB REST API running in Docker container."""

	def __init__(self):
		settings = frappe.get_single("Market Settings")
		self.base_url = settings.openbb_api_url or "http://localhost:6900"
		self.timeout = settings.api_timeout or 30
		self.provider = settings.default_provider or "yfinance"

	def _get(self, endpoint, params=None):
		"""Make GET request to OpenBB API."""
		url = f"{self.base_url}{endpoint}"
		if params is None:
			params = {}
		if "provider" not in params:
			params["provider"] = self.provider

		try:
			response = requests.get(url, params=params, timeout=self.timeout)
			response.raise_for_status()
			return response.json()
		except requests.ConnectionError:
			frappe.log_error(
				f"OpenBB API unreachable: {url}",
				"Market Data Error",
			)
			frappe.throw("OpenBB APIサーバーに接続できません。Dockerコンテナが起動しているか確認してください。")
		except requests.Timeout:
			frappe.log_error(
				f"OpenBB API timeout: {url}",
				"Market Data Error",
			)
			frappe.throw("OpenBB APIリクエストがタイムアウトしました。")
		except requests.HTTPError as e:
			frappe.log_error(
				f"OpenBB API HTTP error: {e}",
				"Market Data Error",
			)
			frappe.throw(f"OpenBB APIエラー: {e}")

	def health_check(self):
		"""Check if OpenBB API is reachable."""
		try:
			r = requests.get(f"{self.base_url}/docs", timeout=5)
			return r.status_code == 200
		except Exception:
			return False

	def get_historical_prices(self, symbol, start_date=None, end_date=None):
		"""Fetch historical stock prices."""
		params = {"symbol": symbol}
		if start_date:
			params["start_date"] = str(start_date)
		if end_date:
			params["end_date"] = str(end_date)
		return self._get("/api/v1/equity/price/historical", params)

	def get_management(self, symbol):
		"""Fetch company management information."""
		return self._get("/api/v1/equity/fundamental/management", {"symbol": symbol})
