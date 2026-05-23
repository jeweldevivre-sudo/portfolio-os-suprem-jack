// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

const SCRIPT_URL =
  (process as any).env?.REACT_APP_PREMIUM_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbzNH2hd0LnOUYhpjWYpcbIJYj_ZivvHRlsVErUOqUevyO36CMId8u2dTioElLLoJHLERw/exec";

const EMPTY_DATA = {
  summary: {},
  holdings: [],
  portfolio: [],
  stockList: [],
  buyOrders: [],
  sellOrders: [],
  progress: {},
  targets: {},
  decisionAnalytics: { trend: [], status: [] },
  allocationEngine: [],
  performanceEngine: {},
};

const PHASES = ["Build", "Balance", "Income"];
const SOURCES = ["All", "Dividend", "Growth"];
const ORDER_TABS = ["All", "BUY", "SELL"];
const STOCK_STATUS_OPTIONS = ["EXCLUDE", "FADE IN", "FADE OUT", "OK", "WATCH"];
const EMPTY_PORTFOLIO_ROW = {
  assetCode: "",
  symbol: "",
  units: "",
  avgCost: "",
  price: "",
  currentValue: "",
};

const n = (value: any) => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/[,%฿]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (value: any) => {
  const number = n(value);
  if (!number) return 0;
  return Math.abs(number) <= 1 ? number * 100 : number;
};

const fmt = (value: any, digits = 2) =>
  n(value).toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const baht = (value: any, compact = false) => {
  const number = n(value);
  if (!compact) return `฿${fmt(number)}`;
  if (Math.abs(number) >= 1_000_000) return `฿${fmt(number / 1_000_000, 2)}M`;
  if (Math.abs(number) >= 1_000) return `฿${fmt(number / 1_000, 1)}K`;
  return `฿${fmt(number)}`;
};

const percent = (value: any, digits = 2) => `${fmt(pct(value), digits)}%`;

const normalizeType = (...values: any[]) => {
  for (const value of values) {
    const text = String(value || "").toLowerCase();
    if (text.includes("dividend")) return "Dividend";
    if (text.includes("growth")) return "Growth";
  }
  return "Other";
};

const clsFor = (value: any) => {
  const text = String(value || "").toUpperCase();
  if (text.includes("BUY") || text.includes("FADE IN") || text.includes("OK")) return "good";
  if (text.includes("SELL") || text.includes("FADE OUT") || text.includes("REBALANCE")) return "bad";
  if (text.includes("LEADER")) return "gold";
  return "muted";
};

const makePortfolioDraft = (rows: any[]) => {
  const draft = (rows || []).map((row: any) => ({
    assetCode: String(row.assetCode || row.symbol || "").toUpperCase(),
    symbol: String(row.symbol || row.assetCode || "").toUpperCase(),
    units: row.units ?? "",
    avgCost: row.avgCost ?? "",
    price: row.price ?? row.marketPrice ?? "",
    currentValue: row.currentValue ?? row.value ?? "",
  }));

  while (draft.length < 12) draft.push({ ...EMPTY_PORTFOLIO_ROW });
  return draft;
};

function App() {
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState("");
  const [stockQuery, setStockQuery] = useState("");
  const [stockSource, setStockSource] = useState("All");
  const [stockStatus, setStockStatus] = useState("All");
  const [orderFilter, setOrderFilter] = useState("All");
  const [portfolioDraft, setPortfolioDraft] = useState<any[]>([]);
  const [tradeForm, setTradeForm] = useState({
    assetCode: "",
    units: "",
    avgCost: "",
  });
  const [orderDrafts, setOrderDrafts] = useState<any>({});
  const [dismissedOrders, setDismissedOrders] = useState<Set<string>>(new Set());
  const [manualTrade, setManualTrade] = useState({
    assetCode: "",
    actionType: "BUY",
    units: "",
    price: "",
    marketPrice: "",
    note: "OFF_SYSTEM",
  });
  const [settings, setSettings] = useState({
    portfolioName: "",
    phase: "Build",
    lineAvailable: "",
    totalWealth: "",
  });
  const [allocFilter, setAllocFilter] = useState("All");
  const [allocSource, setAllocSource] = useState("All");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`, { method: "GET" });
      const raw = await res.json();
      if (!raw.success && raw.status !== "success") {
        throw new Error(raw.message || raw.error || "API load failed");
      }

      const next = { ...EMPTY_DATA, ...(raw.data || raw) };
      next.holdings = next.holdings || next.portfolio || [];
      setData(next);
      setPortfolioDraft(makePortfolioDraft(next.holdings || next.portfolio || []));
      setLastSync(new Date().toLocaleString("th-TH"));
      setSettings({
        portfolioName: next.summary?.portfolioName || "",
        phase: next.summary?.phase || next.summary?.portfolioPhase || "Build",
        lineAvailable: String(next.summary?.lineAvailable ?? ""),
        totalWealth: String(next.targets?.totalWealth ?? ""),
      });
    } catch (err: any) {
      setError(err.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const holdings = useMemo(
    () =>
      (data.holdings || []).map((h: any) => {
        const units = n(h.units);
        const price = n(h.price ?? h.marketPrice);
        const avgCost = n(h.avgCost);
        const value = n(h.currentValue ?? h.value) || units * price;
        const costValue = n(h.costValue) || units * avgCost;
        const gl = n(h.unrealizedPL ?? h.gl) || value - costValue;
        return {
          ...h,
          symbol: h.symbol || h.assetCode,
          type: normalizeType(h.type, h.source),
          units,
          price,
          avgCost,
          value,
          costValue,
          gl,
          glPct: costValue > 0
            ? (gl / costValue) * 100
            : (() => {
                const raw = n(h.glPct ?? h.unrealizedPLPercent);
                return (Math.abs(raw) <= 1 && (units * price) > 100) ? raw * 100 : raw;
              })(),
        };
      }),
    [data.holdings]
  );

  const summary = data.summary || {};
  const stockList = data.stockList || [];
  const buyOrders = data.buyOrders || [];
  const sellOrders = data.sellOrders || [];
  const orders = [...buyOrders.map((o: any) => ({ ...o, actionType: "BUY" })), ...sellOrders.map((o: any) => ({ ...o, actionType: "SELL" }))];

  const totalValue = n(summary.portfolioValue ?? summary.totalPortfolioValue) || holdings.reduce((s, h) => s + h.value, 0);
  const cash = n(summary.lineAvailable ?? summary.cashBalance);
  const totalWealth = n(summary.totalWealth) || totalValue + cash;
  const totalCost = n(summary.totalCostValue) || holdings.reduce((s, h) => s + h.costValue, 0);
  const totalPL = n(summary.totalUnrealizedPL) || holdings.reduce((s, h) => s + h.gl, 0);
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : pct(summary.totalPLPercent);
  const dividendValue = n(summary.dividendValue) || holdings.filter((h) => h.type === "Dividend").reduce((s, h) => s + h.value, 0);
  const growthValue = n(summary.growthValue) || holdings.filter((h) => h.type === "Growth").reduce((s, h) => s + h.value, 0);
  const dividendWeight = totalValue > 0 ? (dividendValue / totalValue) * 100 : pct(summary.dividendWeight);
  const growthWeight = totalValue > 0 ? (growthValue / totalValue) * 100 : pct(summary.growthWeight);
  const targetDividend = pct(summary.targetDividendWeight) || 40;
  const targetGrowth = pct(summary.targetGrowthWeight) || 60;
  const rebalanceNeeded = Math.abs(dividendWeight - targetDividend) >= 5 || String(summary.rebalanceStatus || "").includes("REBALANCE");
  const progress = data.progress || {};
  const decisionStatus = data.decisionAnalytics?.status || [];
  const da = data.decisionAnalytics || {};
  const trendRowsAll: any[] = da.trend || [];

  // อ่านจาก progress (มี formula ใน sheet แล้ว) → da → trend fallback
  const decisionCount =
    n(progress.TotalDecisions || progress.totalDecisions) ||
    n(da.totalCount) || trendRowsAll.length;

  const followSystemCount =
    n(progress.FollowSystemCount || progress.followSystemCount) ||
    n(da.followCount) ||
    trendRowsAll.filter((r: any) => String(r.note || "").toUpperCase().indexOf("OFF_SYSTEM") === -1).length;

  const goodCount =
    n(progress.GoodCount || progress.goodCount) ||
    n(da.goodCount) ||
    n(decisionStatus.find((s: any) => String(s.status).toLowerCase().includes("good"))?.count);

  const neutralCount =
    n(progress.NeutralCount || progress.neutralCount) ||
    n(da.neutralCount) ||
    n(decisionStatus.find((s: any) => String(s.status).toLowerCase().includes("neutral"))?.count);

  const badCount =
    n(progress.BadCount || progress.badCount) ||
    n(da.badCount) ||
    n(decisionStatus.find((s: any) => String(s.status).toLowerCase().includes("bad"))?.count);

  // AverageOutcome จาก sheet เป็น "23.83%" string → n() = 23.83 → ใช้ได้เลย
  const averageOutcome =
    n(progress.AverageOutcome || progress.averageOutcome) ||
    n(da.avgOutcome);

  const averageDecisionScore =
    decisionCount > 0 ? (goodCount * 3 + neutralCount * 1 + badCount * 0) / decisionCount : 0;
  const followSystemRate = decisionCount > 0 ? (followSystemCount / decisionCount) * 100 : 0;

  const decisionReasonScores = (() => {
    const categories = [
      "Follow System",
      "Rebalance",
      "Reduce Risk",
      "Take Profit",
      "Add on Dip",
      "Conviction Buy",
    ];

    const normalizeNote = (note: any) => {
      const text = String(note || "").trim().toUpperCase();
      if (text.includes("FOLLOW")) return "Follow System";
      if (text.includes("REBALANCE")) return "Rebalance";
      if (text.includes("REDUCE")) return "Reduce Risk";
      if (text.includes("TAKE")) return "Take Profit";
      if (text.includes("ADD")) return "Add on Dip";
      if (text.includes("CONVICTION")) return "Conviction Buy";
      return "";
    };

    const scoreFromRow = (row: any) => {
      // ห้ามใช้ row.score || 0 เพราะ score=0 (Bad) เป็น falsy ใน JS
      const raw = row.score;
      const score = (raw !== null && raw !== undefined && raw !== "") ? Number(raw) : null;
      if (score === 3 || score === 1 || score === 0) return score;
      // fallback จาก outcomePercent (decimal เช่น 0.0233 = 2.33%)
      const outcome = Number(row.outcomePercent || row.outcome || 0);
      const outcomePct = Math.abs(outcome) <= 1 ? outcome * 100 : outcome;
      if (outcomePct > 0) return 3;
      if (outcomePct < 0) return 0;
      return 1;
    };

    // ── Primary: คำนวณจาก trend rows (ถ้ามี) ──────────────────────────────
    if (trendRowsAll.length > 0) {
      return categories.map((label) => {
        const matched = trendRowsAll.filter(
          (row: any) => normalizeNote(row.note) === label
        );
        const avg = matched.length > 0
          ? matched.reduce((sum: number, row: any) => sum + scoreFromRow(row), 0) / matched.length
          : 0;
        return { label, value: avg, count: matched.length };
      });
    }

    // ── Fallback: ถ้า trend ว่าง (GAS เวอร์ชันเก่า) ประมาณจาก progress counts ──
    // BehaviorScore จาก sheet = average score รวม → ใช้เป็น proxy ให้ Follow System
    // categories อื่นที่ไม่มีข้อมูลแสดง 0
    const behaviorScoreRaw = n(progress.BehaviorScore || progress.behaviorScore);
    // sheet เก็บ BehaviorScore = 50 หมายถึง 50% ของ max (3) = 1.50
    const proxyScore = behaviorScoreRaw > 3
      ? behaviorScoreRaw / 100 * 3   // เช่น 50 → 1.5
      : behaviorScoreRaw;             // เช่น 1.5 → 1.5 directly

    return categories.map((label) => {
      // Follow System เป็น category หลัก ใช้ proxy score + followSystemCount เป็น count
      if (label === "Follow System") {
        return { label, value: proxyScore || averageDecisionScore, count: n(followSystemCount) };
      }
      return { label, value: 0, count: 0 };
    });
  })();

  // ── Performance Engine (reuses dividendValue / growthValue already declared above) ──
  const perfEngine = data.performanceEngine || {};
  const divHoldings = holdings.filter((h) => h.type === "Dividend");
  const growthHoldings = holdings.filter((h) => h.type === "Growth");

  const divValue = dividendValue; // reuse from summary section above
  const divCost = n(perfEngine.dividendCostValue) || divHoldings.reduce((s, h) => s + h.costValue, 0);
  const divPL = n(perfEngine.dividendPL) || divHoldings.reduce((s, h) => s + h.gl, 0);
  const divPLPct = n(perfEngine.dividendPLPct) || (divCost > 0 ? (divPL / divCost) * 100 : 0);
  const divCount = n(perfEngine.dividendCount) || divHoldings.length;

  const perfGrowthValue = growthValue; // reuse from summary section above
  const growthCost = n(perfEngine.growthCostValue) || growthHoldings.reduce((s, h) => s + h.costValue, 0);
  const growthPL = n(perfEngine.growthPL) || growthHoldings.reduce((s, h) => s + h.gl, 0);
  const growthPLPct = n(perfEngine.growthPLPct) || (growthCost > 0 ? (growthPL / growthCost) * 100 : 0);
  const growthCount = n(perfEngine.growthCount) || growthHoldings.length;

  const bestContributor = perfEngine.bestContributor ||
    (holdings.length > 0 ? holdings.reduce((a, b) => (b.gl > a.gl ? b : a), holdings[0])?.symbol : "-");
  const worstContributor = perfEngine.worstContributor ||
    (holdings.length > 0 ? holdings.reduce((a, b) => (b.gl < a.gl ? b : a), holdings[0])?.symbol : "-");

  const bestDividend = perfEngine.bestDividend ||
    (divHoldings.length > 0 ? divHoldings.reduce((a, b) => (b.gl > a.gl ? b : a), divHoldings[0])?.symbol : "-");
  const worstDividend = perfEngine.worstDividend ||
    (divHoldings.length > 0 ? divHoldings.reduce((a, b) => (b.gl < a.gl ? b : a), divHoldings[0])?.symbol : "-");
  const bestGrowth = perfEngine.bestGrowth ||
    (growthHoldings.length > 0 ? growthHoldings.reduce((a, b) => (b.gl > a.gl ? b : a), growthHoldings[0])?.symbol : "-");
  const worstGrowth = perfEngine.worstGrowth ||
    (growthHoldings.length > 0 ? growthHoldings.reduce((a, b) => (b.gl < a.gl ? b : a), growthHoldings[0])?.symbol : "-");

  // ── Allocation Intelligent Engine ──
  const allocationEngine: any[] = data.allocationEngine || [];

  // ── Compute allocation rows: cross-reference holdings vs targets ──
  // Priority: use allocationEngine from API if available (already computed by sheet)
  // Fallback: compute from stockList + holdings with gap analysis
  const allocationRows = useMemo(() => {
    if (allocationEngine.length > 0) return allocationEngine;

    // Build a holdings lookup: assetCode → holding
    const holdingMap: Record<string, any> = {};
    holdings.forEach((h) => {
      const code = String(h.symbol || h.assetCode || "").toUpperCase();
      holdingMap[code] = h;
    });

    const WEIGHT_GAP_THRESHOLD = 2; // % gap before recommending action
    const rows: any[] = [];

    // 1. Process each stock in the universe
    stockList.forEach((s: any) => {
      const code = String(s.assetCode || s.symbol || "").toUpperCase();
      const manualStatus = String(s.manualStatus || "OK").toUpperCase();

      // Skip excluded stocks unless currently held
      if (manualStatus === "EXCLUDE" && !holdingMap[code]) return;

      const holding = holdingMap[code];
      const targetWeight = pct(s.targetWeight || s.finalTargetWeight || 0);
      const currentValue = holding ? n(holding.value) : 0;
      const currentWeight = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
      const weightGap = targetWeight - currentWeight; // positive = underweight, negative = overweight

      // Derive signal from gap + manual status
      let allocationSignal = "MAINTAIN";
      let reason = "";

      if (manualStatus === "EXCLUDE") {
        allocationSignal = "EXCLUDE";
        reason = "Manually excluded from universe";
      } else if (manualStatus === "FADE OUT") {
        allocationSignal = "REDUCE";
        reason = "Fade out — reduce position gradually";
      } else if (manualStatus === "FADE IN") {
        allocationSignal = "INCREASE";
        reason = "Fade in — build position gradually";
      } else if (manualStatus === "WATCH") {
        allocationSignal = "WATCH";
        reason = "Under watch — no action until confirmed";
      } else if (!holding && targetWeight > 0) {
        allocationSignal = "INCREASE";
        reason = `Not yet held · Target ${targetWeight.toFixed(2)}%`;
      } else if (holding && targetWeight === 0) {
        allocationSignal = "REDUCE";
        reason = "Held position — no target weight assigned";
      } else if (weightGap > WEIGHT_GAP_THRESHOLD) {
        allocationSignal = "INCREASE";
        reason = `Underweight by ${weightGap.toFixed(1)}% vs target`;
      } else if (weightGap < -WEIGHT_GAP_THRESHOLD) {
        allocationSignal = "REDUCE";
        reason = `Overweight by ${Math.abs(weightGap).toFixed(1)}% vs target`;
      } else if (holding) {
        allocationSignal = "MAINTAIN";
        reason = s.leaderFlag === "LEADER"
          ? "Strategic core allocation — sector leader"
          : "Within target range — hold position";
      } else {
        // Not held, no target weight → universe stock but not yet in scope
        return; // skip — not actionable
      }

      rows.push({
        assetCode: code,
        source: s.source,
        sector: s.sector,
        stockListStatus: manualStatus,
        qualityTier: s.leaderFlag || "-",
        finalTargetWeight: targetWeight || null,
        currentWeight: currentWeight || null,
        weightGap: (holding || targetWeight > 0) ? weightGap : null,
        minTargetPct: pct(s.minTargetPct),
        maxTargetPct: pct(s.maxTargetPct),
        allocationSignal,
        engineEligible: manualStatus === "OK" || manualStatus === "FADE IN",
        reason,
        holdingStatus: holding ? (manualStatus === "FADE OUT" ? "FADE OUT" : "ACTIVE") : "-",
        currentValue,
      });
    });

    // 2. Check for holdings NOT in stockList (orphan positions → should reduce)
    holdings.forEach((h) => {
      const code = String(h.symbol || h.assetCode || "").toUpperCase();
      const inUniverse = stockList.some(
        (s: any) => String(s.assetCode || s.symbol || "").toUpperCase() === code
      );
      if (!inUniverse) {
        const currentWeight = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
        rows.push({
          assetCode: code,
          source: h.type || "-",
          sector: "-",
          stockListStatus: "WATCH",
          qualityTier: "-",
          finalTargetWeight: null,
          currentWeight,
          weightGap: -currentWeight,
          minTargetPct: 0,
          maxTargetPct: 0,
          allocationSignal: "REDUCE",
          engineEligible: false,
          reason: "Held but not in stock universe — review",
          holdingStatus: "ACTIVE",
          currentValue: h.value,
        });
      }
    });

    // Sort: INCREASE first, REDUCE next, WATCH, MAINTAIN, EXCLUDE last
    const signalOrder: Record<string, number> = { INCREASE: 0, REDUCE: 1, WATCH: 2, MAINTAIN: 3, EXCLUDE: 4 };
    rows.sort((a, b) => (signalOrder[a.allocationSignal] ?? 5) - (signalOrder[b.allocationSignal] ?? 5));
    return rows;
  }, [allocationEngine, stockList, holdings, totalValue]);

  const filteredAllocation = allocationRows.filter((row: any) => {
    const matchSource = allocSource === "All" || normalizeType(row.source) === allocSource;
    const signal = String(row.allocationSignal || "").toUpperCase();
    const status = String(row.stockListStatus || "").toUpperCase();
    const matchSignal =
      allocFilter === "All" ||
      (allocFilter === "MAINTAIN" && signal === "MAINTAIN") ||
      (allocFilter === "INCREASE" && (signal === "INCREASE" || status === "FADE IN")) ||
      (allocFilter === "REDUCE" && (signal === "REDUCE" || status === "FADE OUT")) ||
      (allocFilter === "EXCLUDE" && (signal === "EXCLUDE" || status === "EXCLUDE")) ||
      (allocFilter === "WATCH" && status === "WATCH");
    return matchSource && matchSignal;
  });

  const filteredStocks = stockList.filter((stock: any) => {
    const text = `${stock.assetCode || stock.symbol} ${stock.source} ${stock.sector} ${stock.leaderFlag} ${stock.universeNote} ${stock.manualStatus}`.toLowerCase();
    const matchesQuery = !stockQuery || text.includes(stockQuery.toLowerCase());
    const matchesSource = stockSource === "All" || normalizeType(stock.source) === stockSource;
    const statusText = String(stock.manualStatus || stock.universeNote || "").toUpperCase();
    const matchesStatus = stockStatus === "All" || statusText.includes(stockStatus.toUpperCase());
    return matchesQuery && matchesSource && matchesStatus;
  });

  const filteredOrders = orders.filter((order: any) => orderFilter === "All" || order.actionType === orderFilter);

  const targetWeightTotals = useMemo(() => {
    const totals = { Dividend: 0, Growth: 0 };
    stockList.forEach((stock: any) => {
      const type = normalizeType(stock.source, stock.type);
      if (type === "Dividend" || type === "Growth") {
        totals[type] += pct(stock.targetWeight);
      }
    });
    return totals;
  }, [stockList]);

  const updatePortfolioDraft = (index: number, field: string, value: any) => {
    setPortfolioDraft((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: field === "assetCode" || field === "symbol" ? String(value).toUpperCase() : value,
              symbol: field === "assetCode" ? String(value).toUpperCase() : row.symbol,
            }
          : row
      )
    );
  };

  const addPortfolioRow = () => {
    setPortfolioDraft((rows) => [...rows, { ...EMPTY_PORTFOLIO_ROW }]);
  };

  const removePortfolioRow = (index: number) => {
    setPortfolioDraft((rows) => rows.filter((_, i) => i !== index));
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError("");
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "saveSettings",
          portfolioName: settings.portfolioName,
          portfolioPhase: settings.phase,
          lineAvailable: n(settings.lineAvailable),
          targets: { totalWealth: n(settings.totalWealth) },
        }),
      });
      const result = await res.json();
      if (!result.success && result.status !== "success") throw new Error(result.message || "Save failed");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const savePortfolio = async () => {
    try {
      setSaving(true);
      setError("");

      const portfolio = portfolioDraft
        .map((row) => ({
          assetCode: String(row.assetCode || row.symbol || "").trim().toUpperCase(),
          units: row.units === "" ? "" : n(row.units),
          avgCost: row.avgCost === "" ? "" : n(row.avgCost),
        }))
        .filter((row) => row.assetCode);

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "savePortfolio",
          portfolio,
        }),
      });
      const result = await res.json();
      if (!result.success && result.status !== "success") throw new Error(result.message || "Save portfolio failed");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Save portfolio failed");
    } finally {
      setSaving(false);
    }
  };

  const saveTradeUpdate = async () => {
    try {
      const assetCode = String(tradeForm.assetCode || "").trim().toUpperCase();
      if (!assetCode) throw new Error("Asset Code is required");

      setSaving(true);
      setError("");
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "upsertPortfolioHolding",
          assetCode,
          units: tradeForm.units === "" ? "" : n(tradeForm.units),
          avgCost: tradeForm.avgCost === "" ? "" : n(tradeForm.avgCost),
        }),
      });
      const result = await res.json();
      if (!result.success && result.status !== "success") throw new Error(result.message || "Trade update failed");
      setTradeForm({ assetCode: "", units: "", avgCost: "" });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Trade update failed");
    } finally {
      setSaving(false);
    }
  };

  const saveStockManualStatus = async (stock: any, manualStatus: string) => {
    const assetCode = String(stock.assetCode || stock.symbol || "").trim().toUpperCase();
    if (!assetCode) return;

    const previousData = data;
    const nextStockList = (data.stockList || []).map((item: any) => {
      const itemCode = String(item.assetCode || item.symbol || "").trim().toUpperCase();
      return itemCode === assetCode ? { ...item, manualStatus } : item;
    });

    setData({ ...data, stockList: nextStockList });

    try {
      setSaving(true);
      setError("");
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "updateStockManualStatus",
          assetCode,
          manualStatus,
        }),
      });
      const result = await res.json();
      if (!result.success && result.status !== "success") throw new Error(result.message || "Save stock status failed");
      await loadData();
    } catch (err: any) {
      setData(previousData);
      setError(err.message || "Save stock status failed");
    } finally {
      setSaving(false);
    }
  };

  const orderKey = (order: any) => `${order.actionType}-${order.assetCode || order.symbol}-${order.priority || ""}`;

  const getOrderDraft = (order: any) => {
    const key = orderKey(order);
    return orderDrafts[key] || {
      actualUnits: order.units || order.suggestedUnits || "",
      actualPrice: order.price || order.marketPrice || "",
      note: "Follow System",
    };
  };

  const updateOrderDraft = (order: any, field: string, value: any) => {
    const key = orderKey(order);
    setOrderDrafts((drafts: any) => ({
      ...drafts,
      [key]: { ...getOrderDraft(order), [field]: value },
    }));
  };

  const postDecisionLog = async (payload: any) => {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "logDecision", ...payload }),
    });
    const result = await res.json();
    if (!result.success && result.status !== "success") throw new Error(result.message || "Log failed");
  };

  const logOrder = async (order: any) => {
    try {
      const draft = getOrderDraft(order);
      const assetCode = String(order.assetCode || order.symbol || "").trim().toUpperCase();
      if (!assetCode) throw new Error("Asset Code is required");

      setSaving(true);
      setError("");
      await postDecisionLog({
        source: "SYSTEM",
        actionType: order.actionType,
        assetCode,
        suggestedUnits: order.suggestedUnits || order.units,
        actualUnits: draft.actualUnits,
        actualPrice: draft.actualPrice,
        marketPrice: order.marketPrice || order.price || draft.actualPrice,
        note: draft.note || "Follow System",
      });
      const key = orderKey(order);
      setOrderDrafts((drafts: any) => ({ ...drafts, [key]: { ...draft, done: true } }));
      setDismissedOrders((prev) => new Set(prev).add(key));
      await loadData();
    } catch (err: any) {
      setError(err.message || "Log failed");
    } finally {
      setSaving(false);
    }
  };

  const logManualOverride = async () => {
    try {
      const assetCode = String(manualTrade.assetCode || "").trim().toUpperCase();
      if (!assetCode) throw new Error("Asset Code is required");
      if (!n(manualTrade.units)) throw new Error("Units is required");
      if (!n(manualTrade.price)) throw new Error("Price is required");

      setSaving(true);
      setError("");
      await postDecisionLog({
        source: "MANUAL OVERRIDE",
        actionType: manualTrade.actionType,
        assetCode,
        suggestedUnits: 0,
        actualUnits: manualTrade.units,
        actualPrice: manualTrade.price,
        marketPrice: manualTrade.marketPrice || manualTrade.price,
        note: manualTrade.note || "OFF_SYSTEM",
      });
      setManualTrade({ assetCode: "", actionType: "BUY", units: "", price: "", marketPrice: "", note: "OFF_SYSTEM" });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Manual log failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="terminal-app">
      <style>{styles}</style>

      <header className="topbar">
        <div className="brand-mark">P</div>
        <div className="brand">
          <div className="brand-title">Portfolio OS</div>
          <div className="brand-sub">Premium Desk v4.0</div>
        </div>
        <nav className="tabs">
          {[
            ["dashboard", "Dashboard"],
            ["progress", "Progress"],
            ["orders", "Orders"],
            ["settings", "Settings"],
            ["allocation", "Allocation"],
            ["stockList", "Stock List"],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="sync" onClick={loadData} disabled={loading}>
          {loading ? "REFRESHING" : "REFRESH"}
        </button>
      </header>

      <main className="shell">
        {error && <div className="alert bad">Error: {error}</div>}

        <section className="market-strip">
          <div>
            <span className={rebalanceNeeded ? "dot red" : "dot green"} />
            <b>{rebalanceNeeded ? "REBALANCE NEEDED" : "SYSTEM NORMAL"}</b>
          </div>
          <span>D {percent(dividendWeight)} / Target {percent(targetDividend, 0)}</span>
          <span>G {percent(growthWeight)} / Target {percent(targetGrowth, 0)}</span>
          <span>Updated {summary.lastUpdate || lastSync || "-"}</span>
        </section>

        {tab === "dashboard" && (
          <>
            <div className="cards six">
              <Metric title="TOTAL WEALTH" value={baht(totalWealth)} sub={`Equity ${baht(totalValue, true)} + Cash ${baht(cash, true)}`} color="blue" />
              <Metric title="UNREALIZED P/L" value={`${totalPL >= 0 ? "+" : ""}${baht(totalPL)}`} sub={`${totalPLPct >= 0 ? "+" : ""}${percent(totalPLPct)} vs cost`} color={totalPL >= 0 ? "green" : "red"} />
              <Metric title="DIVIDEND VALUE" value={baht(dividendValue)} sub={`${percent(dividendWeight)} / Target ${percent(targetDividend, 0)}`} color="green" />
              <Metric title="GROWTH VALUE" value={baht(growthValue)} sub={`${percent(growthWeight)} / Target ${percent(targetGrowth, 0)}`} color="blue" />
              <Metric title="PORTFOLIO NAME" value={summary.portfolioName || "-"} sub={`Phase ${summary.phase || "Build"}`} color="violet" />
              <Metric title="LINE AVAILABLE" value={baht(cash)} sub={`Cash ready ${baht(cash)}`} color="amber" />
            </div>

            <div className="grid two">
              <Panel title="Allocation Monitor">
                <AllocationDonut
                  dividendWeight={dividendWeight}
                  growthWeight={growthWeight}
                  targetDividend={targetDividend}
                  targetGrowth={targetGrowth}
                  dividendValue={dividendValue}
                  growthValue={growthValue}
                />
              </Panel>
              <Panel title="P/L By Position">
                <div className="bars">
                  {holdings.slice(0, 10).map((h) => (
                    <div className="barrow" key={h.symbol}>
                      <span>{h.symbol}</span>
                      <div className="track"><i style={{ width: `${Math.min(Math.abs(h.glPct), 40) * 2.5}%`, background: h.gl >= 0 ? "#20d6a2" : "#ff4d6d" }} /></div>
                      <b className={h.gl >= 0 ? "good" : "bad"}>{h.glPct >= 0 ? "+" : ""}{fmt(h.glPct)}%</b>
                    </div>
                  ))}
                  {holdings.length === 0 && <Empty text="No portfolio rows from API OUT" />}
                </div>
              </Panel>
            </div>

            <Panel title={`Holdings - ${holdings.length} Positions`}>
              <Table
                columns={["SYMBOL", "TYPE", "UNITS", "AVG COST", "PRICE", "MARKET VALUE", "P/L", "P/L %"]}
                rows={holdings.map((h) => [
                  h.symbol,
                  <Badge value={h.type} />,
                  fmt(h.units, 0),
                  baht(h.avgCost),
                  baht(h.price),
                  baht(h.value),
                  <span className={h.gl >= 0 ? "good" : "bad"}>{h.gl >= 0 ? "+" : ""}{baht(h.gl)}</span>,
                  <span className={h.glPct >= 0 ? "good" : "bad"}>{h.glPct >= 0 ? "+" : ""}{fmt(h.glPct)}%</span>,
                ])}
              />
            </Panel>
          </>
        )}

        {tab === "orders" && (
          <>
            <Panel title="Buy Orders">
              <div className="order-card-grid">
                {buyOrders.filter((order: any) => !dismissedOrders.has(orderKey({ ...order, actionType: "BUY" }))).length === 0
                  ? <Empty text="No buy orders from API OUTPUT" />
                  : buyOrders.filter((order: any) => !dismissedOrders.has(orderKey({ ...order, actionType: "BUY" }))).map((order: any) => (
                  <OrderCard
                    key={orderKey({ ...order, actionType: "BUY" })}
                    order={{ ...order, actionType: "BUY" }}
                    draft={getOrderDraft({ ...order, actionType: "BUY" })}
                    saving={saving}
                    onChange={(field: string, value: any) => updateOrderDraft({ ...order, actionType: "BUY" }, field, value)}
                    onDone={() => logOrder({ ...order, actionType: "BUY" })}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Sell Alerts">
              <div className="order-card-grid">
                {sellOrders.filter((order: any) => !dismissedOrders.has(orderKey({ ...order, actionType: "SELL" }))).length === 0
                  ? <Empty text="No sell alerts from API OUTPUT" />
                  : sellOrders.filter((order: any) => !dismissedOrders.has(orderKey({ ...order, actionType: "SELL" }))).map((order: any) => (
                  <OrderCard
                    key={orderKey({ ...order, actionType: "SELL" })}
                    order={{ ...order, actionType: "SELL" }}
                    draft={getOrderDraft({ ...order, actionType: "SELL" })}
                    saving={saving}
                    onChange={(field: string, value: any) => updateOrderDraft({ ...order, actionType: "SELL" }, field, value)}
                    onDone={() => logOrder({ ...order, actionType: "SELL" })}
                  />
                ))}
              </div>
            </Panel>

            <Panel title="Manual Override" badge="OFF_SYSTEM">
              <div className="manual-grid">
                <Field label="Asset Code" value={manualTrade.assetCode} onChange={(v) => setManualTrade({ ...manualTrade, assetCode: String(v).toUpperCase() })} />
                <label className="field">
                  <span>Action</span>
                  <select value={manualTrade.actionType} onChange={(e) => setManualTrade({ ...manualTrade, actionType: e.target.value })}>
                    <option>BUY</option>
                    <option>SELL</option>
                  </select>
                </label>
                <Field label="Units" value={manualTrade.units} onChange={(v) => setManualTrade({ ...manualTrade, units: v })} />
                <Field label="Price" value={manualTrade.price} onChange={(v) => setManualTrade({ ...manualTrade, price: v })} />
                <Field label="Market Price" value={manualTrade.marketPrice} onChange={(v) => setManualTrade({ ...manualTrade, marketPrice: v })} />
                <label className="field manual-note">
                  <span>Note</span>
                  <select value={manualTrade.note} onChange={(e) => setManualTrade({ ...manualTrade, note: e.target.value })}>
                    <option>OFF_SYSTEM</option>
                    <option>Add on Dip</option>
                    <option>Conviction Buy</option>
                  </select>
                </label>
                <button className="primary manual-save" disabled={saving} onClick={logManualOverride}>
                  {saving ? "Saving..." : "Save to Decision Log"}
                </button>
              </div>
            </Panel>
          </>
        )}

        {tab === "stockList" && (
          <Panel title={`Stock List - ${filteredStocks.length}/${stockList.length}`}>
            <div className="toolbar">
              <input value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} placeholder="Search symbol, sector, note" />
              <select value={stockSource} onChange={(e) => setStockSource(e.target.value)}>
                {SOURCES.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>
                {["All", ...STOCK_STATUS_OPTIONS].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SYMBOL</th>
                    <th>SOURCE</th>
                    <th>SECTOR</th>
                    <th>LEADER</th>
                    <th>UNIVERSE NOTE</th>
                    <th>STATUS</th>
                    <th>TARGET WT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.length === 0 ? (
                    <tr><td colSpan={7}><Empty text="No stock list rows" /></td></tr>
                  ) : filteredStocks.map((s: any) => (
                    <tr key={s.symbol || s.assetCode}>
                      <td><b>{s.symbol || s.assetCode}</b></td>
                      <td><Badge value={s.source || s.type} /></td>
                      <td>{s.sector || "-"}</td>
                      <td><span className={clsFor(s.leaderFlag)}>{s.leaderFlag || "-"}</span></td>
                      <td>{s.universeNote || "-"}</td>
                      <td>
                        <select
                          className={`status-select ${clsFor(s.manualStatus)}`}
                          value={String(s.manualStatus || "OK").toUpperCase()}
                          disabled={saving}
                          onChange={(e) => saveStockManualStatus(s, e.target.value)}
                        >
                          {STOCK_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td>{percent(s.targetWeight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === "settings" && (
          <>
            <Panel title="Control Panel">
              <div className="form-grid">
                <Field label="Portfolio Name" value={settings.portfolioName} onChange={(v) => setSettings({ ...settings, portfolioName: v })} />
                <label className="field">
                  <span>Phase</span>
                  <select value={settings.phase} onChange={(e) => setSettings({ ...settings, phase: e.target.value })}>
                    {PHASES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <Field label="Line Available" value={settings.lineAvailable} onChange={(v) => setSettings({ ...settings, lineAvailable: v })} />
                <Field label="Total Wealth Target" value={settings.totalWealth} onChange={(v) => setSettings({ ...settings, totalWealth: v })} />
              </div>
              <div className="actions">
                <button className="primary" disabled={saving} onClick={saveSettings}>{saving ? "Saving..." : "Save Settings"}</button>
              </div>
            </Panel>

            <div className="settings-grid">
              <Panel title="Portfolio Holdings">
                <div className="portfolio-head">
                  <div className="help-text">Editable inputs sync to MASTER PORTFOLIO columns A:C. Price, value, and status stay sheet-controlled.</div>
                  <div className="portfolio-actions">
                    <button className="chip" onClick={addPortfolioRow}>+ Add Position</button>
                    <button className="primary" disabled={saving} onClick={savePortfolio}>{saving ? "Saving..." : "Save Portfolio"}</button>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="edit-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>ASSET CODE</th>
                        <th>UNITS</th>
                        <th>AVG COST</th>
                        <th>PRICE</th>
                        <th>MARKET VALUE</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioDraft.map((row, index) => (
                        <tr key={index}>
                          <td className="muted">{index + 1}</td>
                          <td>
                            <input
                              className="cell-input symbol-input"
                              value={row.assetCode || row.symbol || ""}
                              placeholder="SYMBOL"
                              onChange={(e) => updatePortfolioDraft(index, "assetCode", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="cell-input number-input"
                              value={row.units}
                              placeholder="0"
                              onChange={(e) => updatePortfolioDraft(index, "units", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="cell-input number-input"
                              value={row.avgCost}
                              placeholder="0.00"
                              onChange={(e) => updatePortfolioDraft(index, "avgCost", e.target.value)}
                            />
                          </td>
                          <td className="muted">{n(row.price) ? baht(row.price) : "-"}</td>
                          <td>{n(row.currentValue) ? baht(row.currentValue) : "-"}</td>
                          <td>
                            <button className="ghost" onClick={() => removePortfolioRow(index)}>x</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <div className="side-stack">
                <Panel title="Target Weight Coverage">
                  <div className="coverage-grid">
                    <div className="coverage-card green">
                      <div>Dividend Target Weight</div>
                      <b>{percent(targetWeightTotals.Dividend, 0)}</b>
                      <div className="mini-track"><i style={{ width: `${Math.min(targetWeightTotals.Dividend, 100)}%` }} /></div>
                      <span>From STOCK LIST</span>
                    </div>
                    <div className="coverage-card blue">
                      <div>Growth Target Weight</div>
                      <b>{percent(targetWeightTotals.Growth, 0)}</b>
                      <div className="mini-track"><i style={{ width: `${Math.min(targetWeightTotals.Growth, 100)}%` }} /></div>
                      <span>From STOCK LIST</span>
                    </div>
                  </div>
                </Panel>

                <Panel title="Phase Controls">
                  <div className="phase-stack">
                    {(data.phaseControl?.phases || [
                      { phase: "Build",   dividend: 0.4, growth: 0.6 },
                      { phase: "Balance", dividend: 0.5, growth: 0.5 },
                      { phase: "Income",  dividend: 0.7, growth: 0.3 },
                    ]).map((p: any) => {
                      const name = p.phase;
                      const div = Math.round(pct(p.dividend));
                      const growth = Math.round(pct(p.growth));
                      return (
                      <button
                        key={name}
                        className={settings.phase === name ? "phase-card active" : "phase-card"}
                        onClick={() => setSettings({ ...settings, phase: name as string })}
                      >
                        <b>{name}</b>
                        <span>DIV {div}%</span>
                        <span>GROWTH {growth}%</span>
                      </button>
                    );})}
                  </div>
                </Panel>
              </div>
            </div>
          </>
        )}

        {tab === "progress" && (
          <>
            <div className="perf-section-label">Portfolio Performance</div>
            <div className="cards four">
              <Metric title="DIVIDEND VALUE" value={baht(divValue)} sub={`${divCount} positions · Cost ${baht(divCost, true)}`} color="green" />
              <Metric title="DIVIDEND P/L" value={`${divPL >= 0 ? "+" : ""}${baht(divPL)}`} sub={`${divPLPct >= 0 ? "+" : ""}${percent(divPLPct)} vs cost`} color={divPL >= 0 ? "green" : "red"} />
              <Metric title="GROWTH VALUE" value={baht(growthValue)} sub={`${growthCount} positions · Cost ${baht(growthCost, true)}`} color="blue" />
              <Metric title="GROWTH P/L" value={`${growthPL >= 0 ? "+" : ""}${baht(growthPL)}`} sub={`${growthPLPct >= 0 ? "+" : ""}${percent(growthPLPct)} vs cost`} color={growthPL >= 0 ? "blue" : "red"} />
            </div>

            <Panel title="Performance Breakdown">
              <div className="perf-breakdown">
                <div className="perf-row-head">
                  <span>Type</span><span>Value</span><span>Cost</span><span>P/L</span><span>P/L %</span><span>Weight</span>
                </div>
                <div className="perf-row perf-dividend">
                  <span><i className="perf-dot" style={{background:"#20d6a2"}} />Dividend</span>
                  <span>{baht(divValue)}</span>
                  <span>{baht(divCost)}</span>
                  <span className={divPL >= 0 ? "good" : "bad"}>{divPL >= 0 ? "+" : ""}{baht(divPL)}</span>
                  <span className={divPL >= 0 ? "good" : "bad"}>{divPL >= 0 ? "+" : ""}{percent(divPLPct)}</span>
                  <span>{percent(dividendWeight)}</span>
                </div>
                <div className="perf-row perf-growth">
                  <span><i className="perf-dot" style={{background:"#5aa2ff"}} />Growth</span>
                  <span>{baht(perfGrowthValue)}</span>
                  <span>{baht(growthCost)}</span>
                  <span className={growthPL >= 0 ? "good" : "bad"}>{growthPL >= 0 ? "+" : ""}{baht(growthPL)}</span>
                  <span className={growthPL >= 0 ? "good" : "bad"}>{growthPL >= 0 ? "+" : ""}{percent(growthPLPct)}</span>
                  <span>{percent(growthWeight)}</span>
                </div>
              </div>
              <div className="perf-contributors">
                <div className="perf-contrib-item good">
                  <span className="perf-contrib-label">BEST DIVIDEND</span>
                  <b style={{color:"#20d6a2"}}>{bestDividend}</b>
                </div>
                <div className="perf-contrib-item bad" style={{borderLeftColor:"#ff4d6d"}}>
                  <span className="perf-contrib-label">WORST DIVIDEND</span>
                  <b style={{color:"#ff4d6d"}}>{worstDividend}</b>
                </div>
                <div className="perf-contrib-item good" style={{borderLeftColor:"#5aa2ff"}}>
                  <span className="perf-contrib-label">BEST GROWTH</span>
                  <b style={{color:"#5aa2ff"}}>{bestGrowth}</b>
                </div>
                <div className="perf-contrib-item bad" style={{borderLeftColor:"#ffb020"}}>
                  <span className="perf-contrib-label">WORST GROWTH</span>
                  <b style={{color:"#ffb020"}}>{worstGrowth}</b>
                </div>
              </div>
            </Panel>

            <div className="perf-section-label" style={{marginTop:8}}>Decision Quality</div>
            <Panel title="Decision Analytics">
              <div className="panel-copy">Averaged decision quality from Decision Log.</div>
              <div className="decision-metrics">
                <Metric title="AVG SCORE" value={fmt(averageDecisionScore, 2)} sub="Good = 3 / Neutral = 1 / Bad = 0" color="violet" />
                <Metric title="AVG OUTCOME" value={`${averageOutcome >= 0 ? "+" : ""}${percent(averageOutcome)}`} sub="Average outcome after decision" color={averageOutcome >= 0 ? "green" : "red"} />
                <Metric title="FOLLOW SYSTEM RATE" value={percent(followSystemRate)} sub={`${fmt(followSystemCount, 0)} of ${fmt(decisionCount, 0)} decisions`} color="blue" />
                <Metric title="DECISION COUNT" value={fmt(decisionCount, 0)} sub="Total logged decisions" color="amber" />
              </div>
              <div className="decision-grid">
                <div className="decision-card">
                  <div className="decision-title">Behavior Radar - Avg Score</div>
                  <BehaviorRadar data={decisionReasonScores} />
                </div>
                <div className="decision-card">
                  <div className="decision-title">Decision Status</div>
                  <DecisionDonut good={goodCount} neutral={neutralCount} bad={badCount} />
                </div>
              </div>
            </Panel>
          </>
        )}

        {tab === "allocation" && (
          <>
            <div className="cards four">
              <Metric
                title="IN UNIVERSE"
                value={String(allocationRows.length)}
                sub={`${allocationRows.filter((r:any) => r.engineEligible === true || String(r.engineEligible).toUpperCase() === "TRUE" || r.holdingStatus === "ACTIVE").length} engine eligible`}
                color="blue"
              />
              <Metric
                title="FADE IN / INCREASE"
                value={String(allocationRows.filter((r:any) => String(r.allocationSignal||"").toUpperCase() === "INCREASE" || String(r.stockListStatus||"").toUpperCase() === "FADE IN").length)}
                sub="Positions to build up"
                color="green"
              />
              <Metric
                title="MAINTAIN"
                value={String(allocationRows.filter((r:any) => String(r.allocationSignal||"").toUpperCase() === "MAINTAIN").length)}
                sub="Core positions to hold"
                color="violet"
              />
              <Metric
                title="REDUCE / EXCLUDE"
                value={String(allocationRows.filter((r:any) => ["REDUCE","EXCLUDE"].includes(String(r.allocationSignal||"").toUpperCase()) || ["FADE OUT","EXCLUDE"].includes(String(r.stockListStatus||"").toUpperCase())).length)}
                sub="Reduce or remove positions"
                color="amber"
              />
            </div>

            <Panel title={`Allocation Intelligent Engine — ${filteredAllocation.length}/${allocationRows.length} stocks`}>
              <div className="toolbar">
                <select value={allocSource} onChange={(e) => setAllocSource(e.target.value)}>
                  {["All","Dividend","Growth"].map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={allocFilter} onChange={(e) => setAllocFilter(e.target.value)}>
                  {["All","MAINTAIN","INCREASE","REDUCE","EXCLUDE","WATCH"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ASSET CODE</th>
                      <th>SOURCE</th>
                      <th>SECTOR</th>
                      <th>QUALITY TIER</th>
                      <th>HOLDING</th>
                      <th>CURRENT WT</th>
                      <th>TARGET WT</th>
                      <th>GAP</th>
                      <th>SIGNAL</th>
                      <th>NOTE / REASON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllocation.length === 0 ? (
                      <tr><td colSpan={10}><Empty text="No allocation data" /></td></tr>
                    ) : filteredAllocation.map((row: any, i: number) => {
                      const signal = String(row.allocationSignal || "-").toUpperCase();
                      const signalCls = signal === "INCREASE" ? "good" : signal === "REDUCE" ? "bad" : signal === "EXCLUDE" ? "bad" : signal === "MAINTAIN" ? "blue" : "muted";
                      const holdingStatus = String(row.holdingStatus || "-");
                      const holdingCls = holdingStatus === "ACTIVE" ? "good" : holdingStatus === "FADE OUT" ? "amber" : "muted";
                      const gap = row.weightGap;
                      const gapStr = gap !== null && gap !== undefined
                        ? `${gap >= 0 ? "+" : ""}${gap.toFixed(1)}%`
                        : "-";
                      const gapCls = gap === null || gap === undefined ? "muted" : Math.abs(gap) < 2 ? "muted" : gap > 0 ? "good" : "bad";
                      return (
                        <tr key={i}>
                          <td><b>{row.assetCode}</b></td>
                          <td><Badge value={row.source} /></td>
                          <td>{row.sector || "-"}</td>
                          <td><span className={clsFor(row.qualityTier)}>{row.qualityTier || "-"}</span></td>
                          <td><span className={holdingCls}>{holdingStatus}</span></td>
                          <td>{row.currentWeight ? `${row.currentWeight.toFixed(2)}%` : "-"}</td>
                          <td>{row.finalTargetWeight ? `${row.finalTargetWeight.toFixed(2)}%` : "-"}</td>
                          <td><span className={gapCls}>{gapStr}</span></td>
                          <td>
                            <span className={`badge ${signalCls === "good" ? "dividend" : signalCls === "blue" ? "growth" : "other"}`} style={signal === "REDUCE" || signal === "EXCLUDE" ? {background:"#2a0d12",color:"#ff8aa0"} : undefined}>
                              {signal}
                            </span>
                          </td>
                          <td style={{maxWidth:260,whiteSpace:"normal",lineHeight:1.4,fontSize:12,color:"#7894ba"}}>{row.reason || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}

      </main>
    </div>
  );
}

function Metric({ title, value, sub, color }: any) {
  return (
    <div className={`metric ${color}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

function Panel({ title, badge, children }: any) {
  return (
    <section className="panel">
      <div className="panel-title">
        <span>{title}</span>
        {badge && <em>{badge}</em>}
      </div>
      {children}
    </section>
  );
}

function Allocation({ label, value, target, color }: any) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="allocation">
      <div className="row">
        <span><i style={{ background: color }} />{label}</span>
        <b>{percent(value)}</b>
      </div>
      <div className="allocation-track">
        <div style={{ width: `${width}%`, background: color }} />
        <em style={{ left: `${Math.max(0, Math.min(100, target))}%` }} />
      </div>
      <div className="row small">
        <span>Target {percent(target, 0)}</span>
        <b className={value - target >= 0 ? "bad" : "amber"}>{value - target >= 0 ? "+" : ""}{percent(value - target)}</b>
      </div>
    </div>
  );
}

function AllocationDonut({ dividendWeight, growthWeight, targetDividend, targetGrowth, dividendValue, growthValue }: any) {
  const div = Math.max(0, pct(dividendWeight));
  const growth = Math.max(0, pct(growthWeight));
  const total = div + growth || 100;
  const divPct = (div / total) * 100;
  const growthPct = (growth / total) * 100;
  const divGap = div - pct(targetDividend);
  const growthGap = growth - pct(targetGrowth);

  return (
    <div className="allocation-donut-wrap">
      <div className="allocation-donut-card">
        <svg className="allocation-donut-svg" viewBox="0 0 220 220" role="img" aria-label="Dividend and Growth allocation">
          <circle cx="110" cy="110" r="72" className="donut-bg" pathLength="100" />
          <circle
            cx="110"
            cy="110"
            r="72"
            className="donut-segment"
            stroke="#20d6a2"
            pathLength="100"
            strokeDasharray={`${divPct} ${100 - divPct}`}
            strokeDashoffset="25"
          />
          <circle
            cx="110"
            cy="110"
            r="72"
            className="donut-segment"
            stroke="#5aa2ff"
            pathLength="100"
            strokeDasharray={`${growthPct} ${100 - growthPct}`}
            strokeDashoffset={25 - divPct}
          />
          <circle cx="110" cy="110" r="46" className="donut-hole" />
        </svg>
      </div>

      <div className="allocation-donut-info">
        <div className="allocation-line green">
          <span><i />Dividend</span>
          <b>{percent(div)}</b>
          <small>{baht(dividendValue)} · Target {percent(targetDividend, 0)} · <em className={divGap >= 0 ? "bad" : "amber"}>{divGap >= 0 ? "+" : ""}{percent(divGap)}</em></small>
        </div>
        <div className="allocation-line blue">
          <span><i />Growth</span>
          <b>{percent(growth)}</b>
          <small>{baht(growthValue)} · Target {percent(targetGrowth, 0)} · <em className={growthGap >= 0 ? "bad" : "amber"}>{growthGap >= 0 ? "+" : ""}{percent(growthGap)}</em></small>
        </div>
      </div>
    </div>
  );
}

function BehaviorRadar({ data }: any) {
  const cx = 240;
  const cy = 190;
  const maxRadius = 125;
  const items = data && data.length ? data : [];
  const count = Math.max(items.length, 1);

  const pointFor = (index: number, value: number) => {
    const angle = ((-90 + (360 / count) * index) * Math.PI) / 180;
    const radius = maxRadius * Math.max(0, Math.min(3, n(value))) / 3;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  };

  const fullPoint = (index: number) => pointFor(index, 3);
  const valuePoints = items.map((item: any, index: number) => pointFor(index, item.value));
  const polygon = valuePoints.map((p: any) => `${p.x},${p.y}`).join(" ");
  const grid = [1, 2, 3].map((level) =>
    items
      .map((_: any, index: number) => {
        const p = pointFor(index, level);
        return `${p.x},${p.y}`;
      })
      .join(" ")
  );

  return (
    <svg className="radar-svg" viewBox="0 0 480 390" role="img">
      {grid.map((points) => <polygon key={points} points={points} className="radar-grid" />)}
      {items.map((_: any, index: number) => {
        const p = fullPoint(index);
        return <line key={index} x1={cx} y1={cy} x2={p.x} y2={p.y} className="radar-axis" />;
      })}
      {polygon && <polygon points={polygon} className="radar-area" />}
      {valuePoints.map((p: any, index: number) => (
        <circle key={index} cx={p.x} cy={p.y} r={items[index]?.value > 0 ? "5" : "3"} className="radar-dot" />
      ))}

      {items.map((item: any, index: number) => {
        const p = fullPoint(index);
        const angle = -90 + (360 / count) * index;
        const anchor = angle > -90 && angle < 90 ? "start" : angle === -90 || angle === 270 ? "middle" : "end";
        const dx = angle > -90 && angle < 90 ? 10 : angle === -90 || angle === 270 ? 0 : -10;
        const dy = angle === -90 ? -12 : angle === 90 ? 22 : 5;

        return (
          <g key={item.label}>
            <text x={p.x + dx} y={p.y + dy} textAnchor={anchor} className="radar-label">
              {item.label}
            </text>
            <text x={p.x + dx} y={p.y + dy + 15} textAnchor={anchor} className="radar-count">
              {item.count ? `${fmt(item.value, 2)} / ${item.count}` : "-"}
            </text>
          </g>
        );
      })}

      <g transform="translate(158 362)">
        <rect width="16" height="12" fill="#a78bfa" />
        <text x="24" y="11" className="legend-text">Avg Score</text>
        <rect x="118" width="16" height="12" fill="#26384f" />
        <text x="142" y="11" className="legend-text muted-fill">Full Score = 3</text>
      </g>
    </svg>
  );
}
function DecisionDonut({ good, neutral, bad }: any) {
  const total = Math.max(0, n(good) + n(neutral) + n(bad));
  const segments = [
    { label: "Bad", value: n(bad), color: "#ff6b6b" },
    { label: "Good", value: n(good), color: "#38d39f" },
    { label: "Neutral", value: n(neutral), color: "#f59e0b" },
  ];
  let offset = 25;
  const circumference = 2 * Math.PI * 72;

  return (
    <div className="donut-wrap">
      <svg className="donut-svg" viewBox="0 0 220 220" role="img">
        <circle cx="110" cy="110" r="72" className="donut-bg" />
        {segments.map((segment) => {
          const fraction = total > 0 ? segment.value / total : 0;
          const dash = fraction * circumference;
          const currentOffset = offset;
          offset -= fraction * 100;
          return (
            <circle
              key={segment.label}
              cx="110"
              cy="110"
              r="72"
              className="donut-segment"
              stroke={segment.color}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={currentOffset}
            />
          );
        })}
        <circle cx="110" cy="110" r="43" className="donut-hole" />
      </svg>
      <div className="donut-legend">
        {segments.map((segment) => (
          <span key={segment.label}><i style={{ background: segment.color }} />{segment.label}</span>
        ))}
      </div>
    </div>
  );
}

function Badge({ value }: any) {
  const type = normalizeType(value);
  return <span className={`badge ${type.toLowerCase()}`}>{type}</span>;
}

function OrderCard({ order, draft, saving, onChange, onDone }: any) {
  const side = String(order.actionType || "BUY").toUpperCase();
  const isBuy = side === "BUY";
  const symbol = order.symbol || order.assetCode;
  const suggestedUnits = order.suggestedUnits || order.units;
  const suggestedValue = order.suggestedValue || order.cash || order.sellValue || order.suggestedBuy || order.suggestedSell;
  const suggestedPrice = order.price || order.marketPrice;
  const done = !!draft.done;

  return (
    <div className={`order-card ${isBuy ? "buy" : "sell"} ${done ? "done" : ""}`}>
      <div className="order-card-head">
        <div>
          <b>{symbol}</b>
          <Badge value={order.source || order.type} />
        </div>
        <span className={`side-pill ${isBuy ? "good" : "bad"}`}>{side}</span>
      </div>
      <div className="order-stats">
        <div><span>Suggested Price</span><b>{baht(suggestedPrice)}</b></div>
        <div><span>Suggested Units</span><b>{fmt(suggestedUnits, 0)} shares</b></div>
        <div><span>Suggested Cash</span><b>{baht(suggestedValue)}</b></div>
      </div>
      <div className="order-inputs">
        <label>
          <span>Actual Units</span>
          <input value={draft.actualUnits ?? ""} onChange={(e) => onChange("actualUnits", e.target.value)} />
        </label>
        <label>
          <span>{isBuy ? "Actual Buy Price" : "Actual Sell Price"}</span>
          <input value={draft.actualPrice ?? ""} onChange={(e) => onChange("actualPrice", e.target.value)} />
        </label>
      </div>
      <select className="reason-select" value={draft.note || "Follow System"} onChange={(e) => onChange("note", e.target.value)}>
        <option>Follow System</option>
        <option>Rebalance</option>
        <option>Reduce Risk</option>
        <option>Take Profit</option>
      </select>
      <label className="done-row">
        <input type="checkbox" checked={done} disabled={saving || done} onChange={(e) => e.target.checked && onDone()} />
        <span>{done ? "Saved to Decision Log" : "Done — save to Decision Log"}</span>
      </label>
    </div>
  );
}

function Table({ columns, rows }: any) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c: string) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length}><Empty text="No rows" /></td></tr>
          ) : rows.map((row: any[], index: number) => (
            <tr key={index}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ text }: any) {
  return <div className="empty">{text}</div>;
}

function Field({ label, value, onChange }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const styles = `
*{box-sizing:border-box}body{margin:0;background:#03070d;color:#e8f1ff;font-family:Inter,Segoe UI,Arial,sans-serif}.terminal-app{min-height:100vh;background:radial-gradient(circle at top left,#10284a 0,#06101d 32%,#02060b 100%)}.topbar{height:88px;display:flex;align-items:center;gap:16px;padding:0 34px;border-bottom:1px solid #15253b;background:#07111f}.brand-mark{width:50px;height:50px;border-radius:8px;background:linear-gradient(135deg,#2b83ff,#20d6a2);display:grid;place-items:center;font-weight:900;color:#fff;box-shadow:0 0 28px rgba(43,131,255,.25)}.brand{min-width:210px}.brand-title{font-size:22px;font-weight:900;letter-spacing:-.02em}.brand-sub{font-family:Consolas,monospace;color:#6d8db8;font-size:12px;margin-top:4px}.tabs{flex:1;display:flex;justify-content:center;gap:8px}.tab,.sync,.chip,.mini,.primary{border:1px solid #1b3353;background:#09182a;color:#96b1d4;border-radius:6px;padding:10px 14px;font-weight:800;cursor:pointer}.tab.active,.chip.active,.primary{background:#163c6e;color:#fff;border-color:#2b83ff}.sync{margin-left:auto}.shell{padding:30px 34px 70px;display:flex;flex-direction:column;gap:20px}.alert{padding:14px 18px;border:1px solid #7f1d1d;background:#2a0d12;color:#ffb4b4;border-radius:6px;font-weight:800}.market-strip{display:flex;align-items:center;gap:22px;border:1px solid #2f4058;background:#081423;border-radius:6px;padding:14px 18px;color:#94afd3;font-family:Consolas,monospace}.market-strip b{color:#fff}.dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:10px;box-shadow:0 0 15px currentColor}.red{color:#ff4d6d}.green,.good{color:#20d6a2}.bad{color:#ff4d6d}.amber{color:#ffb020}.gold{color:#ffd166}.muted{color:#8095b5}.blue{color:#5aa2ff}.violet{color:#a78bfa}.cards{display:grid;gap:16px}.cards.six{grid-template-columns:repeat(6,minmax(0,1fr))}.cards.four{grid-template-columns:repeat(4,minmax(0,1fr))}.metric{min-height:110px;border:1px solid #173151;background:linear-gradient(180deg,#091827,#06101c);border-radius:8px;padding:20px 24px;border-top:2px solid currentColor}.metric-title{font-size:13px;letter-spacing:.16em;font-weight:900;color:#d9e8ff}.metric-value{font-family:Consolas,monospace;font-size:25px;line-height:1.2;margin:12px 0 8px;font-weight:900}.metric-sub{font-size:14px;color:#88a6cc;line-height:1.45}.panel-copy{padding:0 26px 18px;color:#7894ba}.decision-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;padding:0 26px 20px}.decision-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:16px;padding:0 26px 26px}.decision-card{border:1px solid #173151;background:#050c16;border-radius:8px;min-height:360px;padding:20px}.decision-title{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#bed4f5;font-weight:900;margin-bottom:12px}.radar-svg{width:100%;height:360px}.radar-grid{fill:none;stroke:#203651;stroke-width:1}.radar-axis{stroke:#203651;stroke-width:1}.radar-area{fill:#a78bfa55;stroke:#a78bfa;stroke-width:3}.radar-dot{fill:#d8c4ff}.radar-label,.legend-text{fill:#8db5e8;font-size:13px}.radar-count{fill:#5f789b;font-size:11px}.muted-fill{fill:#48627f}.donut-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px}.donut-svg{width:260px;height:260px;transform:rotate(-90deg)}.donut-bg{fill:none;stroke:#13263d;stroke-width:28}.donut-segment{fill:none;stroke-width:28;stroke-linecap:butt}.donut-hole{fill:#050c16}.donut-legend{display:flex;gap:14px;font-size:13px;font-weight:900}.donut-legend i{display:inline-block;width:16px;height:12px;margin-right:6px}.allocation-donut-wrap{display:grid;grid-template-columns:280px 1fr;gap:22px;align-items:center;padding:24px 26px}.allocation-donut-card{display:grid;place-items:center}.allocation-donut-svg{width:250px;height:250px;transform:rotate(-90deg)}.allocation-donut-info{display:flex;flex-direction:column;gap:16px}.allocation-line{border:1px solid #173151;background:#071321;border-radius:8px;padding:16px}.allocation-line span{display:flex;align-items:center;gap:10px;font-weight:900;font-size:18px;color:#fff}.allocation-line i{width:11px;height:11px;border-radius:50%;display:inline-block;background:currentColor}.allocation-line b{display:block;font-family:Consolas,monospace;font-size:28px;margin:10px 0}.allocation-line small{color:#88a6cc;font-size:13px}.allocation-line em{font-style:normal;font-weight:900}.allocation-line.green{color:#20d6a2}.allocation-line.blue{color:#5aa2ff}.grid{display:grid;gap:20px}.grid.two{grid-template-columns:1fr 1fr}.panel{border:1px solid #173151;background:#06101c;border-radius:8px;overflow:hidden}.panel-title{padding:18px 26px;border-bottom:1px solid #142840;font-size:13px;letter-spacing:.18em;text-transform:uppercase;font-weight:900;color:#bed4f5}.allocation{padding:18px 26px}.row{display:flex;justify-content:space-between;align-items:center;gap:14px;font-weight:800}.row i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:10px}.row.small{font-size:12px;color:#7894ba;margin-top:7px}.allocation-track{height:8px;background:#152740;border-radius:999px;margin:10px 0;position:relative}.allocation-track div{height:100%;border-radius:999px}.allocation-track em{position:absolute;top:-4px;width:2px;height:16px;background:#fff;opacity:.8}.bars{padding:18px 26px;display:flex;flex-direction:column;gap:13px}.barrow{display:grid;grid-template-columns:70px 1fr 80px;gap:12px;align-items:center;font-family:Consolas,monospace}.track{height:8px;background:#14243a;border-radius:999px;overflow:hidden}.track i{display:block;height:100%;border-radius:999px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:840px}th,td{padding:13px 18px;border-bottom:1px solid #12243a;text-align:left;white-space:nowrap}th{font-size:12px;letter-spacing:.14em;color:#d9e8ff;background:#050c16;position:sticky;top:0}td{font-family:Consolas,monospace;color:#d8e6fa;font-size:13px}tr:hover td{background:#091827}.badge{display:inline-flex;align-items:center;justify-content:center;min-width:74px;border-radius:999px;padding:4px 9px;font-family:Inter,Arial,sans-serif;font-size:11px;font-weight:900}.badge.dividend{background:#063b2c;color:#20d6a2}.badge.growth{background:#0b2a55;color:#5aa2ff}.badge.other{background:#263247;color:#aebdd4}.toolbar{display:flex;gap:10px;padding:16px 18px;border-bottom:1px solid #13263d;align-items:center;flex-wrap:wrap}.toolbar input,.toolbar select,.field input,.field select{height:40px;border:1px solid #1c385a;background:#071321;color:#e8f1ff;border-radius:6px;padding:0 12px;outline:none}.toolbar input{min-width:280px}.mini{padding:7px 10px;font-size:12px}.status-select{height:34px;min-width:128px;border:1px solid #1c385a;background:#071321;border-radius:999px;padding:0 12px;font-family:Consolas,monospace;font-weight:900;outline:none}.status-select.good{border-color:#0d6d52;background:#06291f;color:#20d6a2}.status-select.bad{border-color:#7f1d1d;background:#2a0d12;color:#ff8aa0}.status-select.muted{color:#9db2cf}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:22px}.field{display:flex;flex-direction:column;gap:8px}.field span{font-size:12px;letter-spacing:.14em;color:#8ea8cc;text-transform:uppercase;font-weight:900}.actions{padding:0 22px 22px}.primary{min-width:150px}.empty{padding:28px;color:#637d9e;text-align:center;font-family:Inter,Arial,sans-serif}.trade-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) 170px;gap:16px;padding:22px;align-items:end}.trade-save{height:40px}.settings-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px}.portfolio-head{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px 22px;border-bottom:1px solid #13263d}.help-text{color:#7894ba;font-size:13px;line-height:1.45}.portfolio-actions{display:flex;gap:10px;align-items:center}.edit-table{min-width:900px}.cell-input{width:100%;height:34px;border:1px solid transparent;background:transparent;color:#e8f1ff;border-radius:6px;padding:0 10px;font-family:Consolas,monospace;font-weight:800;outline:none}.cell-input:focus{border-color:#2b83ff;background:#071a2f}.symbol-input{text-transform:uppercase}.number-input{text-align:right}.ghost{width:30px;height:30px;border:1px solid #1b3353;background:#071321;color:#6d8db8;border-radius:6px;cursor:pointer;font-size:20px;line-height:1}.ghost:hover{color:#ff4d6d;border-color:#7f1d1d}.side-stack{display:flex;flex-direction:column;gap:20px}.coverage-grid{display:grid;grid-template-columns:1fr;gap:12px;padding:18px}.coverage-card{border:1px solid currentColor;border-radius:8px;padding:14px;background:#071321}.coverage-card div{font-weight:900;color:#d9e8ff}.coverage-card b{display:block;font-family:Consolas,monospace;font-size:26px;margin:12px 0}.coverage-card span{display:block;color:#7894ba;font-size:12px;margin-top:8px}.mini-track{height:8px;background:#152740;border-radius:999px;overflow:hidden}.mini-track i{display:block;height:100%;background:currentColor;border-radius:999px}.phase-stack{display:flex;flex-direction:column;gap:12px;padding:18px}.phase-card{text-align:left;border:1px solid #1b3353;background:#071321;color:#d9e8ff;border-radius:8px;padding:14px;cursor:pointer;display:grid;grid-template-columns:1fr 1fr;gap:8px}.phase-card b{grid-column:1/-1}.phase-card span{font-family:Consolas,monospace;color:#8ea8cc}.phase-card.active{border-color:#2b83ff;background:#0b2240}
.panel-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.panel-title em{font-style:normal;border:1px solid #3b4f6b;background:#071321;color:#6f87a8;border-radius:999px;padding:6px 12px;font-size:11px;letter-spacing:0;text-transform:none}.order-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:22px}.order-card{border:1px solid #173151;background:#071321;border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:14px}.order-card.buy{border-color:#0d6d52}.order-card.sell{border-color:#7f1d1d}.order-card.done{opacity:.62}.order-card-head{display:flex;justify-content:space-between;gap:14px;align-items:center}.order-card-head>div{display:flex;align-items:center;gap:12px}.order-card-head b{font-size:22px}.side-pill{border:1px solid currentColor;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:900}.order-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.order-stats div,.order-inputs label{background:#0b1628;border-radius:8px;padding:12px}.order-stats span,.order-inputs span{display:block;color:#7894ba;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:900;margin-bottom:6px}.order-stats b{font-family:Consolas,monospace}.order-inputs{display:grid;grid-template-columns:1fr 1fr;gap:10px}.order-inputs input,.reason-select{width:100%;height:42px;border:1px solid #1c385a;background:#071321;color:#e8f1ff;border-radius:6px;padding:0 12px;outline:none;font-family:Consolas,monospace;font-weight:800}.reason-select{height:44px}.done-row{display:flex;align-items:center;gap:10px;color:#c8dcfa;font-weight:900}.done-row input{width:16px;height:16px}.manual-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 1fr;gap:16px;padding:22px;align-items:end}.manual-note{grid-column:1 / 4}.manual-save{height:40px;grid-column:4 / 6}.manual-grid .field select{height:40px;border:1px solid #1c385a;background:#071321;color:#e8f1ff;border-radius:6px;padding:0 12px;outline:none}.allocation-donut-center{display:none}
.perf-section-label{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#4a6a8a;font-weight:900;padding:0 2px 4px}
.perf-breakdown{padding:20px 26px 0}
.perf-row-head{display:grid;grid-template-columns:140px 1fr 1fr 1fr 1fr 1fr;gap:12px;font-size:11px;letter-spacing:.14em;color:#4a6a8a;text-transform:uppercase;font-weight:900;padding-bottom:10px;border-bottom:1px solid #12243a}
.perf-row{display:grid;grid-template-columns:140px 1fr 1fr 1fr 1fr 1fr;gap:12px;padding:14px 0;border-bottom:1px solid #0d1e30;font-family:Consolas,monospace;font-size:14px;align-items:center}
.perf-row span:first-child{display:flex;align-items:center;gap:8px;font-family:Inter,sans-serif;font-weight:900;color:#d9e8ff}
.perf-dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0}
.perf-contributors{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:18px 26px}
.perf-contrib-item{background:#071321;border:1px solid #173151;border-radius:8px;padding:14px 18px}
.perf-contrib-item.good{border-left:3px solid #20d6a2}
.perf-contrib-item.bad{border-left:3px solid #ff4d6d}
.perf-contrib-label{display:block;font-size:10px;letter-spacing:.18em;color:#4a6a8a;text-transform:uppercase;font-weight:900;margin-bottom:6px}
.perf-contrib-item b{font-family:Consolas,monospace;font-size:22px;color:#e8f1ff}
@media(max-width:1200px){.order-card-grid,.manual-grid{grid-template-columns:1fr}.manual-note,.manual-save{grid-column:auto}.allocation-donut-wrap{grid-template-columns:1fr}.cards.six{grid-template-columns:repeat(3,1fr)}.grid.two,.settings-grid,.trade-grid,.decision-grid{grid-template-columns:1fr}.decision-metrics{grid-template-columns:repeat(2,1fr)}.tabs{justify-content:flex-start;overflow:auto}.topbar{padding:0 18px}.brand{min-width:auto}.perf-row-head,.perf-row{grid-template-columns:100px 1fr 1fr 1fr 1fr 1fr;font-size:12px}.cards.four{grid-template-columns:repeat(2,1fr)}.perf-contributors{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.topbar{height:auto;align-items:flex-start;flex-direction:column;padding:18px}.tabs{width:100%;justify-content:flex-start;flex-wrap:wrap}.shell{padding:14px 12px 60px}.cards.six,.cards.four,.form-grid,.decision-metrics{grid-template-columns:1fr}.market-strip,.portfolio-head{align-items:flex-start;flex-direction:column}.toolbar input{min-width:100%;width:100%}.portfolio-actions{width:100%;flex-direction:column}.portfolio-actions button,.trade-save{width:100%}.perf-breakdown{padding:12px 14px 0}.perf-row-head{display:none}.perf-row{grid-template-columns:1fr 1fr;gap:8px;padding:12px 0;font-size:12px}.perf-row span:first-child{grid-column:1/-1;margin-bottom:4px}.perf-contributors{grid-template-columns:1fr 1fr;padding:12px 14px}.perf-section-label{padding:0 2px 6px;font-size:10px}.bars{padding:12px 14px}.barrow{grid-template-columns:60px 1fr 70px}.table-wrap{-webkit-overflow-scrolling:touch}table{min-width:600px}th,td{padding:10px 12px;font-size:12px}.metric{min-height:90px;padding:14px 16px}.metric-value{font-size:20px}.toolbar{padding:10px 12px;gap:8px}.toolbar select{width:100%}}
`;

export default App;
