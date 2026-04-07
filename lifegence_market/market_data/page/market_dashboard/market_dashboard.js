frappe.pages["market-dashboard"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Market Dashboard"),
		single_column: true,
	});

	page.set_title_sub(
		'<span class="indicator-pill green">' + __("株式市場") + "</span>"
	);

	// Fetch price button
	page.set_primary_action(__("価格取得"), function () {
		if (wrapper.dashboard && wrapper.dashboard.currentSymbol) {
			wrapper.dashboard.fetchPricesFromOpenBB();
		} else {
			frappe.msgprint(__("銘柄を選択してください"));
		}
	}, "refresh");

	$(frappe.render_template("market_dashboard")).appendTo(page.body);

	frappe.require(
		"/assets/lifegence_market/js/vendor/lightweight-charts.standalone.production.js",
		() => {
			wrapper.dashboard = new MarketDashboard(page);
		}
	);
};

frappe.pages["market-dashboard"].on_page_show = function (wrapper) {
	if (wrapper.dashboard) {
		wrapper.dashboard.checkOpenBBStatus();
	}
};

class MarketDashboard {
	constructor(page) {
		this.page = page;
		this.$wrapper = $(page.body);
		this.currentSymbol = null;
		this.currentPeriod = "6M";
		this.priceChart = null;
		this.volumeChart = null;
		this.candleSeries = null;
		this.volumeSeries = null;
		this.init();
	}

	init() {
		this.bindEvents();
		this.loadStocks();
		this.checkOpenBBStatus();
	}

	bindEvents() {
		this.$wrapper.on("change", ".stock-select", (e) => {
			const symbol = $(e.target).val();
			if (symbol) {
				this.selectStock(symbol);
			}
		});

		this.$wrapper.on("click", ".period-btn", (e) => {
			this.$wrapper.find(".period-btn").removeClass("active");
			$(e.target).addClass("active");
			this.currentPeriod = $(e.target).data("period");
			if (this.currentSymbol) {
				this.loadChartData();
			}
		});

		this.$wrapper.on("click", ".stock-row", (e) => {
			const symbol = $(e.currentTarget).data("symbol");
			this.$wrapper.find(".stock-select").val(symbol);
			this.selectStock(symbol);
		});
	}

	async loadStocks() {
		try {
			const r = await frappe.call({
				method: "lifegence_market.api.market.get_active_stocks",
			});
			const stocks = r.message || [];
			this.renderStockSelector(stocks);
			this.renderStockList(stocks);

			if (stocks.length > 0) {
				this.$wrapper.find(".stock-select").val(stocks[0].name);
				this.selectStock(stocks[0].name);
			}
		} catch (err) {
			console.error("Failed to load stocks:", err);
		}
	}

	renderStockSelector(stocks) {
		const $select = this.$wrapper.find(".stock-select");
		$select.find("option:not(:first)").remove();
		stocks.forEach((s) => {
			$select.append(
				`<option value="${s.name}">${s.symbol} - ${s.stock_name}</option>`
			);
		});
	}

	renderStockList(stocks) {
		const $container = this.$wrapper.find(".stock-list-table");
		if (stocks.length === 0) {
			$container.html(
				'<p class="text-muted">' + __("登録銘柄がありません") + "</p>"
			);
			return;
		}

		let html = `<table class="table table-condensed stock-table">
			<thead>
				<tr>
					<th>${__("シンボル")}</th>
					<th>${__("銘柄名")}</th>
					<th>${__("取引所")}</th>
					<th class="text-right">${__("最終価格")}</th>
					<th class="text-right">${__("更新日")}</th>
				</tr>
			</thead>
			<tbody>`;

		stocks.forEach((s) => {
			const price = s.last_price
				? this.formatNumber(s.last_price)
				: "--";
			const date = s.last_price_date || "--";
			html += `<tr class="stock-row" data-symbol="${s.name}" style="cursor:pointer;">
				<td><strong>${s.symbol}</strong></td>
				<td>${s.stock_name}</td>
				<td><span class="badge">${s.exchange || ""}</span></td>
				<td class="text-right">${price}</td>
				<td class="text-right text-muted">${date}</td>
			</tr>`;
		});

		html += "</tbody></table>";
		$container.html(html);
	}

	async selectStock(symbol) {
		this.currentSymbol = symbol;
		this.$wrapper.find(".stock-row").removeClass("active-stock");
		this.$wrapper
			.find(`.stock-row[data-symbol="${symbol}"]`)
			.addClass("active-stock");

		await Promise.all([this.loadSummary(), this.loadChartData()]);
	}

	async loadSummary() {
		try {
			const r = await frappe.call({
				method: "lifegence_market.api.market.get_stock_summary",
				args: { symbol: this.currentSymbol },
			});
			const d = r.message;
			if (!d || !d.has_data) {
				this.clearMetrics();
				this.$wrapper.find(".stock-name-label").text(d ? d.stock_name : "");
				return;
			}

			this.$wrapper.find(".stock-name-label").text(d.stock_name);
			this.$wrapper
				.find(".stock-exchange-badge")
				.text(d.exchange)
				.toggle(!!d.exchange);

			this.setMetric("last_price", this.formatNumber(d.last_price));
			this.setMetric("last_date", d.last_date);

			const changeClass = d.change >= 0 ? "positive" : "negative";
			const changeSign = d.change >= 0 ? "+" : "";
			this.$wrapper
				.find('[data-metric="change"]')
				.text(changeSign + this.formatNumber(d.change))
				.removeClass("positive negative")
				.addClass(changeClass);
			this.$wrapper
				.find('[data-metric="change_pct"]')
				.text("(" + changeSign + d.change_pct.toFixed(2) + "%)")
				.removeClass("positive negative")
				.addClass(changeClass);

			this.setMetric("volume", this.formatVolume(d.volume));
			this.setMetric("low", this.formatNumber(d.low));
			this.setMetric("high", this.formatNumber(d.high));
			this.setMetric("low_52w", d.low_52w ? this.formatNumber(d.low_52w) : "--");
			this.setMetric(
				"high_52w",
				d.high_52w ? this.formatNumber(d.high_52w) : "--"
			);
		} catch (err) {
			console.error("Failed to load summary:", err);
		}
	}

	async loadChartData() {
		this.$wrapper.find(".chart-placeholder").hide();
		this.$wrapper.find("#price-chart, #volume-chart").show();

		try {
			const r = await frappe.call({
				method: "lifegence_market.api.market.get_chart_data",
				args: {
					symbol: this.currentSymbol,
					period: this.currentPeriod,
				},
			});

			const chartData = r.message;
			if (!chartData || !chartData.data || chartData.data.length === 0) {
				this.$wrapper.find(".chart-placeholder").show().find("span")
					.text(__("この期間のデータがありません"));
				this.$wrapper.find("#price-chart, #volume-chart").hide();
				return;
			}

			this.renderChart(chartData.data);
		} catch (err) {
			console.error("Failed to load chart data:", err);
		}
	}

	renderChart(data) {
		const $priceEl = this.$wrapper.find("#price-chart");
		const $volumeEl = this.$wrapper.find("#volume-chart");

		// Clear previous charts
		if (this.priceChart) {
			this.priceChart.remove();
			this.priceChart = null;
		}
		if (this.volumeChart) {
			this.volumeChart.remove();
			this.volumeChart = null;
		}

		$priceEl.empty();
		$volumeEl.empty();

		const width = $priceEl.width() || 800;
		const isDark = document.documentElement.getAttribute("data-theme") === "dark";

		const chartColors = {
			bg: isDark ? "#1a1a2e" : "#ffffff",
			text: isDark ? "#d1d4dc" : "#191919",
			grid: isDark ? "#2a2e39" : "#f0f0f0",
			border: isDark ? "#2a2e39" : "#e0e0e0",
			crosshair: isDark ? "#758696" : "#9B9B9B",
			upColor: "#26a69a",
			downColor: "#ef5350",
			volumeUp: "rgba(38, 166, 154, 0.4)",
			volumeDown: "rgba(239, 83, 80, 0.4)",
		};

		// Price chart (candlestick)
		this.priceChart = LightweightCharts.createChart($priceEl[0], {
			width: width,
			height: 400,
			layout: {
				background: { color: chartColors.bg },
				textColor: chartColors.text,
			},
			grid: {
				vertLines: { color: chartColors.grid },
				horzLines: { color: chartColors.grid },
			},
			crosshair: {
				mode: LightweightCharts.CrosshairMode.Normal,
			},
			rightPriceScale: {
				borderColor: chartColors.border,
			},
			timeScale: {
				borderColor: chartColors.border,
				timeVisible: false,
			},
		});

		this.candleSeries = this.priceChart.addCandlestickSeries({
			upColor: chartColors.upColor,
			downColor: chartColors.downColor,
			borderDownColor: chartColors.downColor,
			borderUpColor: chartColors.upColor,
			wickDownColor: chartColors.downColor,
			wickUpColor: chartColors.upColor,
		});

		this.candleSeries.setData(
			data.map((d) => ({
				time: d.time,
				open: d.open,
				high: d.high,
				low: d.low,
				close: d.close,
			}))
		);

		// Volume chart
		this.volumeChart = LightweightCharts.createChart($volumeEl[0], {
			width: width,
			height: 120,
			layout: {
				background: { color: chartColors.bg },
				textColor: chartColors.text,
			},
			grid: {
				vertLines: { color: chartColors.grid },
				horzLines: { color: chartColors.grid },
			},
			rightPriceScale: {
				borderColor: chartColors.border,
			},
			timeScale: {
				borderColor: chartColors.border,
				timeVisible: false,
			},
		});

		this.volumeSeries = this.volumeChart.addHistogramSeries({
			priceFormat: { type: "volume" },
			priceScaleId: "",
		});

		this.volumeSeries.setData(
			data.map((d) => ({
				time: d.time,
				value: d.volume,
				color: d.close >= d.open ? chartColors.volumeUp : chartColors.volumeDown,
			}))
		);

		// Sync time scales
		this.priceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
			if (range && this.volumeChart) {
				this.volumeChart.timeScale().setVisibleLogicalRange(range);
			}
		});
		this.volumeChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
			if (range && this.priceChart) {
				this.priceChart.timeScale().setVisibleLogicalRange(range);
			}
		});

		this.priceChart.timeScale().fitContent();
		this.volumeChart.timeScale().fitContent();

		// Resize observer
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}
		this.resizeObserver = new ResizeObserver(() => {
			const newWidth = $priceEl.width();
			if (newWidth && newWidth > 0) {
				this.priceChart.applyOptions({ width: newWidth });
				this.volumeChart.applyOptions({ width: newWidth });
			}
		});
		this.resizeObserver.observe($priceEl.parent()[0]);
	}

	async fetchPricesFromOpenBB() {
		frappe.show_alert({
			message: __("{0} の価格データを取得中...", [this.currentSymbol]),
			indicator: "blue",
		});

		try {
			await frappe.call({
				method: "lifegence_market.api.market.fetch_stock_prices",
				args: { stock_name: this.currentSymbol },
			});

			frappe.show_alert({
				message: __("価格データを更新しました"),
				indicator: "green",
			});

			await this.selectStock(this.currentSymbol);
			await this.loadStocks();
		} catch (err) {
			frappe.show_alert({
				message: __("価格取得に失敗しました"),
				indicator: "red",
			});
		}
	}

	async checkOpenBBStatus() {
		try {
			const r = await frappe.call({
				method: "lifegence_market.api.market.check_openbb_status",
			});
			const connected = r.message && r.message.connected;
			const $status = this.$wrapper.find(".openbb-status");
			$status
				.find(".status-indicator")
				.removeClass("green red")
				.addClass(connected ? "green" : "red");
			$status
				.find(".status-text")
				.text(connected ? "OpenBB Connected" : "OpenBB Disconnected");
		} catch (err) {
			this.$wrapper
				.find(".status-indicator")
				.removeClass("green")
				.addClass("red");
		}
	}

	setMetric(name, value) {
		this.$wrapper.find(`[data-metric="${name}"]`).text(value);
	}

	clearMetrics() {
		this.$wrapper.find("[data-metric]").text("--");
		this.$wrapper.find("[data-metric]").removeClass("positive negative");
	}

	formatNumber(num) {
		if (num === null || num === undefined) return "--";
		return Number(num).toLocaleString("ja-JP", {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1,
		});
	}

	formatVolume(vol) {
		if (!vol) return "--";
		if (vol >= 1e8) return (vol / 1e8).toFixed(1) + "億";
		if (vol >= 1e4) return (vol / 1e4).toFixed(1) + "万";
		return Number(vol).toLocaleString("ja-JP");
	}
}
