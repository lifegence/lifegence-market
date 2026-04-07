# Lifegence Market

> Stock market data management powered by [OpenBB](https://openbb.co/) for [Frappe](https://frappeframework.com/) / [ERPNext](https://erpnext.com/) v16+

**Lifegence Market** は OpenBB Platform をバックエンドとした株式市場データ管理アプリです。株価の自動取得・蓄積、キャンドルスティックチャートによる可視化、ウォッチリスト管理を Frappe 上で提供します。

---

## Features

### Market Dashboard (`/app/market-dashboard`)
- Interactive candlestick chart ([TradingView Lightweight Charts](https://github.com/nicholastavares/lightweight-charts))
- Volume bar chart with synced time scale
- Period selector (1W / 1M / 3M / 6M / 1Y / ALL)
- Metric cards (price, change %, volume, day range, 52-week range)
- Stock selector with clickable table
- Dark mode support
- Responsive layout

### Data Management
- Automatic daily price fetching via Frappe scheduler
- Incremental fetch (only new data since last stored date)
- On-demand price fetch per stock
- OpenBB API health check
- Initial seed data (3 Japanese stocks)

---

## Architecture

```
┌────────────────────────────────────────────────┐
│  Frappe / ERPNext (lifegence_market)            │
│  ├── Market Dashboard (Frappe Page)             │
│  ├── Stock Master / Stock Price (DocTypes)       │
│  └── API endpoints (frappe.whitelist)            │
│       │                                          │
│       │  HTTP REST API only                      │
│       │  (no Python package import)              │
│       ▼                                          │
│  ┌──────────────────────────────────────────┐   │
│  │  OpenBB Platform (Docker container :6900) │   │
│  │  ├── /api/v1/equity/price/historical      │   │
│  │  ├── /api/v1/equity/fundamental/management│   │
│  │  └── Provider: yfinance (default)         │   │
│  └──────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

### AGPL License Isolation

OpenBB Platform は AGPL ライセンスです。lifegence_market は **HTTP REST API のみ** で通信し、OpenBB の Python パッケージを一切インポートしません。これにより MIT ライセンスとの互換性を維持しています。

```python
# openbb_client.py — HTTP only, never imports openbb packages
import requests

class OpenBBClient:
    def _get(self, endpoint, params=None):
        response = requests.get(f"{self.base_url}{endpoint}", params=params)
        return response.json()
```

---

## DocTypes (3)

| DocType | Type | Description |
|---------|------|-------------|
| Stock Master | Master | Stock symbols, names (JP/EN), exchange, sector, active flag |
| Stock Price | Document | Daily OHLCV data (auto-named `{stock}-{date}`) |
| Market Settings | Settings | OpenBB URL, provider, timeout, auto-fetch toggle |

---

## API Endpoints

All endpoints require login (`frappe.whitelist`).

| Endpoint | Description |
|----------|-------------|
| `lifegence_market.api.market.get_chart_data` | OHLCV data for charting (symbol, period) |
| `lifegence_market.api.market.get_stock_summary` | Price summary with change %, 52-week range |
| `lifegence_market.api.market.get_active_stocks` | List all active stocks for selector |
| `lifegence_market.api.market.fetch_stock_prices` | Trigger on-demand price fetch from OpenBB |
| `lifegence_market.api.market.check_openbb_status` | Check OpenBB Docker connectivity |

---

## Prerequisites

- Python 3.10+
- Frappe Framework v16+
- ERPNext v16+
- **Docker** (for OpenBB Platform container)

---

## Installation

### 1. Install the Frappe app

```bash
bench get-app https://github.com/lifegence/lifegence-market.git
bench --site your-site install-app lifegence_market
bench --site your-site migrate
```

### 2. Start OpenBB Platform container

```bash
docker run -d \
  --name openbb \
  -p 6900:6900 \
  ghcr.io/openbb-finance/openbb-platform-api:latest
```

Or add to your `docker-compose.yaml`:

```yaml
services:
  openbb:
    image: ghcr.io/openbb-finance/openbb-platform-api:latest
    container_name: openbb
    restart: unless-stopped
    ports:
      - "6900:6900"
    environment:
      - OPENBB_API_AUTH=false
```

### 3. Verify connectivity

```bash
# From the Frappe server
curl http://localhost:6900/docs

# Or from Frappe console
bench --site your-site console
>>> from lifegence_market.services.openbb_client import OpenBBClient
>>> OpenBBClient().health_check()
True
```

### 4. Build frontend assets

```bash
bench build --app lifegence_market
```

---

## Configuration

After installation, configure via **Market Settings** (`/app/market-settings`):

| Setting | Default | Description |
|---------|---------|-------------|
| OpenBB API URL | `http://localhost:6900` | OpenBB container endpoint |
| Default Provider | `yfinance` | Data provider for price fetching |
| API Timeout | 30 (seconds) | HTTP request timeout |
| Auto Fetch Prices | Enabled | Daily scheduler job toggle |

### Scheduler

| Schedule | Job | Description |
|----------|-----|-------------|
| Daily | `price_fetcher.fetch_daily_prices` | Fetch latest prices for all active stocks |

---

## Initial Data

Installation seeds 3 Japanese stocks:

| Symbol | Name |
|--------|------|
| 7203.T | Toyota Motor Corporation |
| 7012.T | Kawasaki Heavy Industries |
| 285A.T | Kioxia Holdings |

Add more stocks via **Stock Master** (`/app/stock-master`).

---

## Development

```bash
# Run tests
bench --site your-site run-tests --app lifegence_market

# Build assets
bench build --app lifegence_market
```

### Project Structure

```
lifegence_market/
├── api/
│   └── market.py                 # 5 whitelisted API endpoints
├── services/
│   ├── openbb_client.py          # OpenBB HTTP REST client (AGPL-isolated)
│   └── price_fetcher.py          # Daily price fetch scheduler job
├── market_data/
│   ├── doctype/
│   │   ├── stock_master/         # Stock symbol master data
│   │   ├── stock_price/          # Daily OHLCV records
│   │   └── market_settings/      # Configuration singleton
│   └── page/
│       └── market_dashboard/     # Interactive chart dashboard
├── public/
│   ├── js/vendor/
│   │   └── lightweight-charts.standalone.production.js  # TradingView Charts v4
│   └── images/logo.svg
├── desktop_icon/
│   └── lifegence_market.json
├── workspace_sidebar/
│   └── market_data.json
├── hooks.py
└── install.py                    # Seed data + default settings
```

### OpenBB API Endpoints Used

| OpenBB Endpoint | Usage |
|-----------------|-------|
| `GET /api/v1/equity/price/historical` | Fetch daily OHLCV data |
| `GET /api/v1/equity/fundamental/management` | Company management info |
| `GET /docs` | Health check (connectivity test) |

### Adding a New Data Provider

OpenBB supports 100+ data providers. To switch from yfinance:

1. Update **Market Settings** → Default Provider
2. Ensure the provider extension is installed in the OpenBB container
3. Some providers require API keys (set via OpenBB environment variables)

---

## Troubleshooting

### OpenBB container not reachable

```
OpenBB APIサーバーに接続できません。
```

1. Check container is running: `docker ps | grep openbb`
2. Check port: `curl http://localhost:6900/docs`
3. If using Docker Compose, ensure the Frappe container can reach `openbb:6900` on the shared network

### No price data displayed

1. Verify stock symbols are correct (e.g., `7203.T` for TSE stocks)
2. Check OpenBB supports the symbol: `curl "http://localhost:6900/api/v1/equity/price/historical?symbol=7203.T&provider=yfinance"`
3. Run manual fetch: click the "Price Fetch" button on the dashboard
4. Check Error Log in Frappe for API errors

### Chart not rendering

1. Run `bench build --app lifegence_market`
2. Clear browser cache (Ctrl+Shift+R)
3. Check browser console for JavaScript errors

---

## Third-Party Licenses

| Component | License | Usage |
|-----------|---------|-------|
| [TradingView Lightweight Charts](https://github.com/nicholastavares/lightweight-charts) v4.2.2 | Apache 2.0 | Candlestick & volume chart rendering (vendored) |
| [OpenBB Platform](https://github.com/OpenBB-finance/OpenBB) | AGPL-3.0 | Market data backend (Docker container, HTTP API only) |

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Lifegence

## Contributing

Contributions are welcome. Please open an issue or pull request on [GitHub](https://github.com/lifegence/lifegence-market).
