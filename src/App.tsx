// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbz3Kr9YfOp50f0TIA-kjWVydSkSyhWMRpInYQjvI-_1S-knxdxCJxQ-Iw7x1xH6AyKg/exec";

const DEFAULT_TARGETS = {
  totalWealth: 5000000,
  dividendValue: 2600000,
  growthValue: 2400000,
  annualDividendCurrent: 0,
  annualDividend: 200000,
};

const DEFAULT_PHASES = {
  Build: { dividendPct: 40, growthPct: 60, monthlyGrowth: 15000 },
  Accumulate: { dividendPct: 50, growthPct: 50, monthlyGrowth: 15000 },
  Income: { dividendPct: 70, growthPct: 30, monthlyGrowth: 15000 },
};

const EMPTY_HOLDING = {
  symbol: "",
  type: "Growth",
  units: "",
  avgCost: "",
  targetWeight: "",
  price: "",
};

const HOLDING_TYPES = ["Dividend", "Growth", "Other"];

const SYSTEM_ORDER_NOTE_OPTIONS = [
  "Follow System",
  "Rebalance",
  "Reduce Risk",
  "Take Profit",
];

const MANUAL_OVERRIDE_NOTE_OPTIONS = [
  "OFF_SYSTEM",
  "Add on Dip",
  "Conviction Buy",
];

const DECISION_NOTE_OPTIONS = [
  ...SYSTEM_ORDER_NOTE_OPTIONS,
  ...MANUAL_OVERRIDE_NOTE_OPTIONS,
];

const normalizeHoldingType = (...values: any[]) => {
  for (const value of values) {
    const text = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!text) continue;
    if (text.includes("dividend")) return "Dividend";
    if (text.includes("growth")) return "Growth";
    if (
      text.includes("other") ||
      text.includes("non target") ||
      text.includes("out of plan")
    ) {
      return "Other";
    }
  }
  return "Other";
};

const typeBadgeStyle = (type: unknown) => {
  const t = normalizeHoldingType(type);

  if (t === "Dividend") {
    return { background: "#1f8b4c", color: "#fff" };
  }

  if (t === "Growth") {
    return { background: "#1f4c8b", color: "#fff" };
  }

  return { background: "#444", color: "#fff" };
};
const fmt = (n: any, d: number = 2) => {
  return isNaN(n) || n === null || n === ""
    ? "—"
    : Number(n).toLocaleString("th-TH", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
};
const fmtB = (n: any) =>
  n >= 1000000
    ? `${fmt(n / 1000000)}M`
    : n >= 1000
    ? `${fmt(n / 1000, 1)}K`
    : fmt(n);

const num = (v: any) => parseFloat(String(v).replace(/,/g, "")) || 0;

const targetPct = (v: any) => {
  const n = num(v);
  if (!n) return 0;
  return n <= 1 ? n * 100 : n;
};

const fmtPct = (v: any, d: number = 0) => {
  const pct = targetPct(v);
  return pct > 0 ? `${fmt(pct, d)}%` : "—";
};

function EInput({
  val,
  onChange,
  placeholder = "",
  align = "right",
  options = null,
  width = "100%",
  small = false,
  disabled = false,
}: any) {

  const [focus, setFocus] = useState(false);

  const base = {
    background: focus ? "#0f1c2f" : "transparent",
    border: `1px solid ${focus ? "#3b82f6" : "transparent"}`,
    borderRadius: 8,
    color: disabled ? "#d6e0ee" : "#e6edf7",
    fontSize: small ? 11 : 12,
    fontFamily: "'DM Mono', monospace",
    padding: small ? "4px 7px" : "5px 8px",
    width,
    outline: "none",
    textAlign: align,
    transition: "all 0.15s ease",
    opacity: 1,
  };

  if (options) {
    return (
      <select
        value={val}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          ...base,
          background: focus ? "#0f1c2f" : "#0b1523",
          border: `1px solid ${focus ? "#3b82f6" : "#1c2a3d"}`,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {options.map((o: any) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      value={val}
      type="text"
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={base}
    />
  );
}

function CTip(props: any) { 
  const { active, payload, label } = props || {};
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#0d1526",
        border: "1px solid #1d2a3d",
        borderRadius: 10,
        padding: "10px 12px",
        color: "#e2e8f0",
        fontSize: 11,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      {label && (
        <div style={{ marginBottom: 6, color: "#94a3b8", fontWeight: 700 }}>
          {label}
        </div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ marginBottom: 3 }}>
          <span style={{ color: p.color || "#94a3b8" }}>{p.name}:</span>{" "}
          <span style={{ fontFamily: "'DM Mono', monospace" }}>
            ฿{fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}


function App() {
  const [tab, setTab] = useState("dashboard");
  const [phase, setPhase] = useState("Build");
  const [holdings, setHoldings] = useState(
    Array(18)
      .fill(null)
      .map(() => ({ ...EMPTY_HOLDING }))
  );
  const [targets, setTargets] = useState({ ...DEFAULT_TARGETS });
  const [phases, setPhases] = useState({ ...DEFAULT_PHASES });
  const [cash, setCash] = useState(0);
  const [maxBudget, setMaxBudget] = useState(5000);
  const [portfolioName, setPortfolioName] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const [isTablet, setIsTablet] = useState(
    typeof window !== "undefined"
      ? window.innerWidth > 768 && window.innerWidth <= 1024
      : false
  );

  const [summary, setSummary] = useState({
    lastUpdate: "",
    lineAvailable: 0,
    maxBudget: 0,
    effectiveBudget: 0,
    phase: "BUILD",
    totalBuyNeed: 0,
    growthSell: 0,
    remainingNeed: 0,
  });

 const [buyOrders, setBuyOrders] = useState<any[]>([]);
const [sellOrders, setSellOrders] = useState<any[]>([]);
const [circuitAlerts, setCircuitAlerts] = useState<any[]>([]);
const [decisionAnalytics, setDecisionAnalytics] = useState({
  trend: [],
  status: [],
});
const [originalPortfolioSymbols, setOriginalPortfolioSymbols] = useState<string[]>([]);
const [deletedPortfolioSymbols, setDeletedPortfolioSymbols] = useState<string[]>([]);
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [decisionForm, setDecisionForm] = useState({
    assetCode: "",
    action: "BUY",
    units: "",
    price: "",
    marketPrice: "",
    note: "OFF_SYSTEM",
  });

  const [orderEdits, setOrderEdits] = useState({});
  const [loggedOrderIds, setLoggedOrderIds] = useState([]);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1024);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadPortfolioFromSheet = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
      const raw = await res.json();

      // New API_OUTPUT format: { success: true, data: { summary, holdings, buyOrders, sellOrders } }
      // Backward compatible format: { status: "success", summary, holdings, buyOrders, sellOrders }
      const ok = raw.success === true || raw.status === "success";
      if (!ok) {
        throw new Error(raw.message || raw.error || "Load failed");
      }

      const data = raw.data || raw;
      const apiSummary = data.summary || {};
      const apiPortfolio = data.portfolio || data.holdings || [];
      const apiSellOrders = data.sellAlerts || data.sellOrders || [];
      const apiBuyOrders = data.buyOrders || [];
      const apiCircuitAlerts = data.circuitAlerts || [];
      const apiDecisionAnalytics = data.decisionAnalytics || { trend: [], status: [] };
      const apiPhaseControl = data.phaseControl || {};

      setPortfolioName(
        apiSummary.portfolioName || data.portfolioName || "Portfolio OS"
      );

      const lineAvailable =
        apiSummary.lineAvailable ??
        apiSummary.line_available ??
        apiSummary.cashBalance ??
        apiSummary.cash ??
        0;

      const portfolioPhase =
        apiSummary.phase ||
        apiSummary.portfolioPhase ||
        apiSummary.portfolio_phase ||
        apiPhaseControl.portfolioPhase ||
        "Build";

      setSummary({
        ...apiSummary,
        portfolioValue:
          apiSummary.portfolioValue ?? apiSummary.portfolio_value ?? 0,
        lineAvailable,
        maxBudget: apiSummary.maxBudget ?? apiSummary.max_budget ?? 5000,
        effectiveBudget:
          apiSummary.effectiveBudget ?? apiSummary.effective_budget ?? 0,
        phase: portfolioPhase,
        dividendAllocation:
          apiSummary.dividendAllocation ?? apiSummary.dividend_allocation ?? 0,
        growthAllocation:
          apiSummary.growthAllocation ?? apiSummary.growth_allocation ?? 0,
        lastUpdate: apiSummary.lastUpdate || apiSummary.last_update || "",
      });

      setCash(num(lineAvailable));
      setMaxBudget(num(apiSummary.maxBudget ?? apiSummary.max_budget ?? 5000));

      const rawPhase = String(portfolioPhase).trim().toUpperCase();

      const phaseMap = {
        BUILD: "Build",
        ACCUMULATE: "Accumulate",
        INCOMEFOCUS: "Income",
        "INCOME FOCUS": "Income",
        INCOME: "Income",
      };
      setPhase((phaseMap as any)[rawPhase] || portfolioPhase || "Build");

      if (Array.isArray(apiPhaseControl.phases)) {
        const nextPhases = { ...DEFAULT_PHASES };
        apiPhaseControl.phases.forEach((p: any) => {
          const name = String(p.phase || "").trim();
          if (!name) return;
          const dividendPct =
            num(p.dividend) <= 1 ? num(p.dividend) * 100 : num(p.dividend);
          const growthPct =
            num(p.growth) <= 1 ? num(p.growth) * 100 : num(p.growth);
          const phaseKeyMap = {
            BUILD: "Build",
            ACCUMULATE: "Accumulate",
            INCOME: "Income",
            INCOMEFOCUS: "Income",
            "INCOME FOCUS": "Income",
          };
          const key =
  (phaseKeyMap as any)[name.toUpperCase().replace(/\s+/g, " ")] || name;

(nextPhases as any)[key] = {
  ...((nextPhases as any)[key] || {}),
  dividendPct,
  growthPct,
  monthlyGrowth: (nextPhases as any)[key]?.monthlyGrowth || 15000,
};
        });
        setPhases(nextPhases);
      }

      if (data.targets) {
        setTargets((prev) => ({
          ...prev,
          totalWealth: num(data.targets.totalWealth),
          dividendValue: num(data.targets.dividendValue),
          growthValue: num(data.targets.growthValue),
          annualDividendCurrent:
            data.targets.annualDividendCurrent !== undefined
              ? num(data.targets.annualDividendCurrent)
              : prev.annualDividendCurrent,
          annualDividend:
            data.targets.annualDividend !== undefined
              ? num(data.targets.annualDividend)
              : prev.annualDividend,
        }));
      }

      if (Array.isArray(apiPortfolio)) {
        const normalized = apiPortfolio.map((h) => {
          const type = normalizeHoldingType(
            h.type,
            h.osType,
            h.source,
            h.category,
            h.assetType
          );

          return {
            symbol: h.symbol || h.assetCode || "",
            type,
            source: type,
            units: h.units ?? h.currentUnits ?? "",
            avgCost: h.avgCost ?? "",
            targetWeight: h.targetWeight ?? "",
            price: h.price ?? h.marketPrice ?? "",
          };
        });

        const loadedSymbols = normalized
          .map((h) =>
            String(h.symbol || "")
              .trim()
              .toUpperCase()
          )
          .filter((symbol) => symbol && symbol !== "SYMBOL");

        setOriginalPortfolioSymbols(loadedSymbols);
        setDeletedPortfolioSymbols([]);

        while (normalized.length < 18) {
          normalized.push({ ...EMPTY_HOLDING, source: EMPTY_HOLDING.type });
        }

        setHoldings(normalized.slice(0, 18));
      }

      if (Array.isArray(apiBuyOrders)) {
        setBuyOrders(
          apiBuyOrders
            .filter((o) => o && (o.assetCode || o.symbol))
            .map((o, i) => ({
              id: `buy-${i}`,
              symbol: o.symbol || o.assetCode || "",
              type: normalizeHoldingType(o.type, o.source, o.osType),
              price: o.price ?? o.marketPrice ?? 0,
              units: o.units ?? o.buyUnits ?? 0,
              cash:
                o.cash ?? o.cashUsed ?? o.actualBuyValue ?? o.suggestedBuy ?? 0,
              status: o.status || o.statusNote || "BUY",
              note: o.note || "",
              execute: String(o.execute || o.note || "EXECUTE").trim().toUpperCase(),
            }))
        );
      } else {
        setBuyOrders([]);
      }

      if (Array.isArray(apiSellOrders)) {
        setSellOrders(
          apiSellOrders
            .filter((o) => o && (o.assetCode || o.symbol))
            .map((o, i) => ({
              id: `sell-${i}`,
              symbol: o.symbol || o.assetCode || "",
              type: normalizeHoldingType(o.type, o.source, o.osType),
              price: o.price ?? o.marketPrice ?? "",
              units: o.units ?? o.sellUnits ?? "",
              sellValue:
                o.sellValue ?? o.actualSellValue ?? o.suggestedSell ?? "",
              status: o.status || o.sellStatus || o.statusNote || "",
              note: o.note || "",
            }))
        );
      } else {
        setSellOrders([]);
      }

      if (Array.isArray(apiCircuitAlerts)) {
        setCircuitAlerts(
          apiCircuitAlerts
            .filter((a) => a && (a.asset || a.assetCode || a.symbol))
            .map((a, i) => ({
              id: `circuit-${i}`,
              asset: String(a.asset || a.assetCode || a.symbol || "")
                .trim()
                .toUpperCase(),
              status: String(a.status || "")
                .trim()
                .toUpperCase(),
              message: String(a.message || "").trim(),
            }))
            .filter((a) => a.asset && a.status && a.status !== "NORMAL")
        );
      } else {
        setCircuitAlerts([]);
      }

      setDecisionAnalytics({
        trend: Array.isArray(apiDecisionAnalytics.trend)
          ? apiDecisionAnalytics.trend.map((d) => ({
              ...d,
              score: num(d.score),
              outcomePercent: num(d.outcomePercent),
            }))
          : [],
        status: Array.isArray(apiDecisionAnalytics.status)
          ? apiDecisionAnalytics.status.map((d) => ({
              status: d.status,
              count: num(d.count),
            }))
          : [],
      });
    } catch (err: any) {
      console.error("Load error:", err);
      setLoadError(err.message || "Load error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolioFromSheet();
  }, []);

  const computed = useMemo(
    () =>
      holdings
        .filter((h) => h.symbol && num(h.units) > 0 && num(h.price) > 0)
        .map((h) => ({
          ...h,
          value: num(h.units) * num(h.price),
          cost: num(h.units) * num(h.avgCost),
          gl: num(h.units) * (num(h.price) - num(h.avgCost)),
          glPct:
            num(h.avgCost) > 0
              ? ((num(h.price) - num(h.avgCost)) / num(h.avgCost)) * 100
              : 0,
        })),
    [holdings]
  );

  const divValue = computed
    .filter((h) => normalizeHoldingType(h.type) === "Dividend")
    .reduce((s, h) => s + h.value, 0);
  const growValue = computed
    .filter((h) => normalizeHoldingType(h.type) === "Growth")
    .reduce((s, h) => s + h.value, 0);
  const equityValue = divValue + growValue;
  const totalWealth = equityValue + num(cash);
  const totalGL = computed.reduce((s, h) => s + h.gl, 0);
  const totalCost = computed.reduce((s, h) => s + h.cost, 0);
  const totalGLPct = totalCost > 0 ? (totalGL / totalCost) * 100 : 0;

  const phaseData = phases[phase] || phases.Build;
  const divPct = equityValue > 0 ? (divValue / equityValue) * 100 : 0;
  const growPct = equityValue > 0 ? (growValue / equityValue) * 100 : 0;
  const divGap = divPct - phaseData.dividendPct;
  const growGap = growPct - phaseData.growthPct;
  const needRebal = Math.abs(divGap) > 5;

  const totalBuyCash = num(
    summary.totalBuyNeed ?? summary.total_buy_need ?? summary.buyNeed
  );
  const growthSellCash = num(
    summary.growthSell ??
      summary.growth_sell ??
      summary.totalSellValue ??
      summary.total_sell_value
  );
  const remainingNeedCash = num(
    summary.remainingNeed ?? summary.remaining_need
  );

  const updateHolding = (i, f, v) => {
    const n = [...holdings];
    n[i] = { ...n[i], [f]: v };
    setHoldings(n);
  };

  const addHolding = () => setHoldings((h) => [...h, { ...EMPTY_HOLDING }]);

  const removeHolding = (i) => {
    const removedSymbol = String(holdings[i]?.symbol || "")
      .trim()
      .toUpperCase();

    if (removedSymbol && removedSymbol !== "SYMBOL") {
      setDeletedPortfolioSymbols((prev) =>
        prev.includes(removedSymbol) ? prev : [...prev, removedSymbol]
      );
    }

    setHoldings((h) => h.filter((_, idx) => idx !== i));
  };

  const savePortfolioPhase = async (nextPhase) => {
    try {
      setPhase(nextPhase);
      setLoading(true);
      setLoadError("");

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "saveSettings",
          portfolioPhase: nextPhase,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.message || "Save phase failed");
      }

      await loadPortfolioFromSheet();
    } catch (err: any) {
      console.error("Phase save error:", err);
      setLoadError(err.message || "Phase save error");
      alert(`Save phase failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const getHoldingAvgCost = (symbol) => {
    const code = String(symbol || "")
      .trim()
      .toUpperCase();
    const found = holdings.find(
      (h) =>
        String(h.symbol || "")
          .trim()
          .toUpperCase() === code
    );
    return num(found?.avgCost);
  };

  const getOrderEdit = (order, actionType) => {
    const id = `${actionType}-${order.id || order.symbol}`;
    const current = orderEdits[id] || {};
    return {
      actualUnits:
        current.actualUnits ??
        (order.units === "" || order.units === undefined ? "" : order.units),
      actualPrice:
        current.actualPrice ??
        (order.price === "" || order.price === undefined ? "" : order.price),
      note: current.note ?? "Follow System",
    };
  };

  const updateOrderEdit = (orderId, field, value) => {
    setOrderEdits((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [field]: value,
      },
    }));
  };

  const saveOrderDecision = async (order, actionType) => {
    try {
      const orderId = `${actionType}-${order.id || order.symbol}`;
      if (loggedOrderIds.includes(orderId)) return;

      const edit = getOrderEdit(order, actionType);
      const assetCode = String(order.symbol || order.assetCode || "")
        .trim()
        .toUpperCase();
      const actualUnits = num(edit.actualUnits);
      const actualPrice = num(edit.actualPrice);
      const suggestedUnits = num(order.units);
      const suggestedPrice = num(order.price);
      const avgCost = getHoldingAvgCost(assetCode);

      if (!assetCode || actualUnits <= 0 || actualPrice <= 0) {
        alert(
          "Please enter Actual Units and Actual Price before marking Done."
        );
        return;
      }

      setLoading(true);
      setLoadError("");

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "logDecision",
          source: "SYSTEM",
          actionType,
          assetCode,
          youDid: actionType,
          suggestedUnits,
          actualUnits,
          units: actualUnits,
          avgCost,
          suggestedPrice,
          actualPrice,
          buySellPrice: actualPrice,
          note: edit.note || "Follow System",
        }),
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.message || "Save order decision failed");
      }

      setLoggedOrderIds((prev) => [...prev, orderId]);
      setDecisionSaved(true);
      setTimeout(() => setDecisionSaved(false), 2000);
      await loadPortfolioFromSheet();
    } catch (err: any) {
      console.error("Order decision save error:", err);
      setLoadError(err.message || "Order decision save error");
      alert(`Save order decision failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const saveDecisionRecord = async () => {
    try {
      const assetCode = String(decisionForm.assetCode || "")
        .trim()
        .toUpperCase();
      const actionType = String(decisionForm.action || "")
        .trim()
        .toUpperCase();
      const units = num(decisionForm.units);
      const price = num(decisionForm.price);
      const marketPrice = num(decisionForm.marketPrice || decisionForm.price);

      if (
        !assetCode ||
        !actionType ||
        units <= 0 ||
        price <= 0
      ) {
        alert(
          "Please fill Asset Code, Action, Units, and Price."
        );
        return;
      }

      setLoading(true);
      setLoadError("");

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "logDecision",
          source: "MANUAL_OVERRIDE",
          actionType,
          assetCode,
          suggestedPrice: marketPrice,
          systemPrice: marketPrice,
          suggestedUnits: 0,
          actualUnits: units,
          actualPrice: price,
          marketPrice,
          units,
          youDid: actionType,
          buySellPrice: price,
          note: decisionForm.note || "OFF_SYSTEM",
        }),
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.message || "Save decision failed");
      }

      setDecisionSaved(true);
      setTimeout(() => setDecisionSaved(false), 2000);

      setDecisionForm({
        assetCode: "",
        action: "BUY",
        units: "",
        price: "",
        marketPrice: "",
        note: "OFF_SYSTEM",
      });

      await loadPortfolioFromSheet();
    } catch (err: any) {
      console.error("Decision log save error:", err);
      setLoadError(err.message || "Decision log save error");
      alert(`Save record failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const settingsPayload = {
        action: "saveSettings",
        portfolioName: portfolioName,
        portfolioPhase: phase,
        lineAvailable: Number(cash) || 0,
        targets: {
          totalWealth: num(targets.totalWealth),
          dividendValue: num(targets.dividendValue),
          growthValue: num(targets.growthValue),
        },
        phaseControl: Object.entries(phases).map(([phaseName, values]) => ({
          phase: phaseName,
          dividend: (Number(values.dividendPct) || 0) / 100,
          growth: (Number(values.growthPct) || 0) / 100,
        })),
      };

      const portfolioPayload = {
        action: "savePortfolio",
        portfolio: holdings
          .filter((h) => String(h.symbol || "").trim())
          .map((h) => ({
            assetCode: String(h.symbol || "")
              .trim()
              .toUpperCase(),
            type: normalizeHoldingType(h.type),
            source: normalizeHoldingType(h.type),
            osType: normalizeHoldingType(h.type),
            units: h.units === "" ? "" : Number(h.units),
            avgCost: h.avgCost === "" ? "" : Number(h.avgCost),
          })),
      };

      const currentSymbols = portfolioPayload.portfolio
        .map((h) =>
          String(h.assetCode || "")
            .trim()
            .toUpperCase()
        )
        .filter((symbol) => symbol && symbol !== "SYMBOL");

      const deletedSymbols = Array.from(
        new Set([
          ...deletedPortfolioSymbols,
          ...originalPortfolioSymbols.filter(
            (symbol) => !currentSymbols.includes(symbol)
          ),
        ])
      ).filter((symbol) => symbol && symbol !== "SYMBOL");

      for (const assetCode of deletedSymbols) {
        const deleteRes = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "deletePortfolio",
            assetCode,
            reason: "Deleted from Web App",
          }),
        });

        const deleteResult = await deleteRes.json();
        if (!deleteResult.success) {
          throw new Error(deleteResult.message || `Delete ${assetCode} failed`);
        }
      }

      const settingsRes = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(settingsPayload),
      });
      const settingsResult = await settingsRes.json();
      if (!settingsResult.success) {
        throw new Error(settingsResult.message || "Save settings failed");
      }

      const portfolioRes = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(portfolioPayload),
      });
      const portfolioResult = await portfolioRes.json();
      if (!portfolioResult.success) {
        throw new Error(portfolioResult.message || "Save portfolio failed");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setDeletedPortfolioSymbols([]);

      await loadPortfolioFromSheet();
    } catch (err: any) {
      console.error("Save error:", err);
      setLoadError(err.message || "Save error");
      alert(`Save failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const saveProgressTargets = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const totalWealthTarget = num(targets.totalWealth);

      const payload = {
        action: "saveSettings",
        portfolioName: portfolioName,
        portfolioPhase: phase,
        lineAvailable: Number(cash) || 0,

        // Only Total Wealth is editable. Dividend/Growth targets are formulas in Google Sheets.
        targets: {
          totalWealth: totalWealthTarget,
        },
        totalWealthTarget,
        targetTotalWealth: totalWealthTarget,
      };

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!result.success && result.status !== "success") {
        throw new Error(result.message || "Save targets failed");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadPortfolioFromSheet();
    } catch (err: any) {
      console.error("Save targets error:", err);
      setLoadError(err.message || "Save targets error");
      alert(`Save targets failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const card = "card";
  const ST = {
    fontSize: isMobile ? 11 : 12,
    color: "#a5b4cc",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    marginBottom: 14,
  };
  const IB = {
    background: "#07111f",
    border: "1px solid #162235",
    borderRadius: 12,
    padding: isMobile ? "16px 16px" : "18px 20px",
    marginBottom: 14,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
  };
  const TH = (left = false) => ({
    padding: "12px 14px",
    fontSize: 11,
    color: "#d6e0ee",
    fontWeight: 800,
    textAlign: left ? "left" : "right",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    borderBottom: "1px solid #1d2a3d",
    background: "#060d18",
  });

  const navTabs = [
    ["dashboard", "📊 Dashboard"],
    ["trades", "📋 Orders"],
    ["input", "✏️ Settings"],
    ["progress", "🎯 Progress"],
  ];

  const typeData = [
    { name: "Dividend", value: divValue },
    { name: "Growth", value: growValue },
  ];

  const targetWeightTotals = useMemo(() => {
    const currentPhaseData = phases[phase] ||
      phases.Build || { dividendPct: 40, growthPct: 60 };
    return {
      Dividend: Number(currentPhaseData.dividendPct) || 0,
      Growth: Number(currentPhaseData.growthPct) || 0,
    };
  }, [phases, phase]);

  const targetCoverageCards = [
    {
      label: "Dividend Target Weight",
      total: targetWeightTotals.Dividend,
      color: "#34d399",
      subtitle: "From MASTER TARGET phase allocation",
    },
    {
      label: "Growth Target Weight",
      total: targetWeightTotals.Growth,
      color: "#60a5fa",
      subtitle: "From MASTER TARGET phase allocation",
    },
  ];

  const progressMetrics = [
    {
      label: "Total Wealth",
      current: totalWealth,
      target: num(targets.totalWealth),
      color: "#f59e0b",
    },
    {
      label: "Dividend Value",
      current: divValue,
      target: num(targets.dividendValue),
      color: "#34d399",
    },
    {
      label: "Growth Value",
      current: growValue,
      target: num(targets.growthValue),
      color: "#60a5fa",
    },
  ];

  const barData = progressMetrics.map((m) => ({
    name: m.label,
    current: m.current,
    target: m.target,
    fill: m.color,
  }));

  const radarData = progressMetrics.map((m) => ({
    metric: m.label,
    actual: m.target > 0 ? Math.min((m.current / m.target) * 100, 100) : 0,
    target: 100,
  }));

  const decisionTrendData = (decisionAnalytics.trend || []).map((d, i) => ({
    name: `D${i + 1}`,
    note: d.note || "",
    score: num(d.score),
    outcomePercent: num(d.outcomePercent),
  }));

  const decisionStatusData = (decisionAnalytics.status || []).map((d) => ({
    name: String(d.status || "").replace(/[🟢🟡🔴]/g, "").trim() || String(d.status || "Status"),
    value: num(d.count),
    rawStatus: d.status,
  }));

  const averageDecisionScore =
    decisionTrendData.length > 0
      ? decisionTrendData.reduce((s, d) => s + num(d.score), 0) /
        decisionTrendData.length
      : 0;

  const averageOutcomePercent =
    decisionTrendData.length > 0
      ? decisionTrendData.reduce((s, d) => s + num(d.outcomePercent), 0) /
        decisionTrendData.length
      : 0;

  const decisionCount = decisionTrendData.length;

  const followSystemCount = decisionTrendData.filter(
    (d) => String(d.note || "").trim() === "Follow System"
  ).length;

  const followSystemRate =
    decisionCount > 0 ? (followSystemCount / decisionCount) * 100 : 0;

  const decisionAverageByNote = Object.values(
    decisionTrendData.reduce((acc, d) => {
      const key = String(d.note || "Unknown").trim() || "Unknown";
      if (!acc[key]) {
        acc[key] = {
          note: key,
          count: 0,
          totalScore: 0,
          totalOutcome: 0,
        };
      }
      acc[key].count += 1;
      acc[key].totalScore += num(d.score);
      acc[key].totalOutcome += num(d.outcomePercent);
      return acc;
    }, {})
  ).map((d: any) => ({
    name: d.note,
    count: d.count,
    avgScore: d.count > 0 ? d.totalScore / d.count : 0,
    avgOutcomePercent: d.count > 0 ? d.totalOutcome / d.count : 0,
  }));

  const decisionRadarData = DECISION_NOTE_OPTIONS.map((note) => {
    const found = decisionAverageByNote.find((d: any) => d.name === note);
    return {
      reason: note,
      avgScore: found ? num((found as any).avgScore) : 0,
      fullScore: 3,
    };
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050b14",
        color: "#e2e8f0",
        fontFamily: "'Inter','DM Sans',sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #050b14; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #08101c; }
        ::-webkit-scrollbar-thumb { background: #233247; border-radius: 6px; }
        ::-webkit-scrollbar-thumb:hover { background: #31445d; }

        .card {
          background: linear-gradient(180deg, #081321 0%, #07111d 100%);
          border: 1px solid #162235;
          border-radius: 14px;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.02),
            0 8px 24px rgba(0,0,0,0.18);
        }

        .tab-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Inter', 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 700;
          padding: 8px 16px;
          border-radius: 10px;
          transition: all .18s ease;
          letter-spacing: 0.01em;
          white-space: nowrap;
          flex: 0 0 auto;
        }

        .tab-btn:hover {
          background: rgba(37,99,235,0.08);
          color: #e6edf7 !important;
        }

        .pill {
          border-radius: 7px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.02em;
        }

        .pbar {
          height: 6px;
          background: #162235;
          border-radius: 999px;
          overflow: hidden;
        }

        .pfill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.8s ease;
        }

        .rh:hover td {
          background: #0b1626 !important;
        }

        .ibtn {
          background: none;
          border: none;
          cursor: pointer;
          color: #4b607b;
          font-size: 13px;
          padding: 2px 6px;
          border-radius: 4px;
          transition: all .15s ease;
        }

        .ibtn:hover {
          color: #f87171;
          background: rgba(248,113,113,0.08);
        }

        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
        }

        select option {
          background: #0c1523;
          color: #e2e8f0;
        }
      `}</style>

      <div
        style={{
          background: "#07101c",
          borderBottom: "1px solid #162235",
          padding: isMobile ? "0 14px" : "0 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: isMobile ? 74 : 70,
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 8 : 12,
          }}
        >
          <div
            style={{
              width: isMobile ? 36 : 40,
              height: isMobile ? 36 : 40,
              background: "linear-gradient(135deg,#3b82f6,#34d399)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              boxShadow: "0 8px 20px rgba(59,130,246,0.22)",
              flex: "0 0 auto",
            }}
          >
            ◈
          </div>
          <span
            style={{
              fontSize: isMobile ? 14 : 16,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            Portfolio OS
          </span>
          {!isMobile && (
            <span
              style={{
                fontSize: 11,
                color: "#48607d",
                fontFamily: "'DM Mono', monospace",
                marginLeft: 2,
              }}
            >
              v3.3
            </span>
          )}
        </div>

        {isMobile ? (
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            style={{
              background: "#0c1523",
              border: "1px solid #1a2940",
              color: "#ffffff",
              borderRadius: 10,
              padding: "7px 10px",
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "'Inter', sans-serif",
              outline: "none",
              width: "38vw",
              maxWidth: 170,
            }}
          >
            {navTabs.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 4,
              overflowX: "auto",
              maxWidth: "none",
              paddingBottom: 0,
            }}
          >
            {navTabs.map(([id, label]) => (
              <button
                key={id}
                className="tab-btn"
                onClick={() => setTab(id)}
                style={{
                  color: tab === id ? "#ffffff" : "#7d8ea5",
                  background: tab === id ? "#1f3c63" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "0 0 auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#0c1523",
              border: "1px solid #1a2940",
              borderRadius: 10,
              padding: isMobile ? "5px 8px" : "6px 12px",
            }}
          >
            {!isMobile && (
              <span
                style={{
                  fontSize: 10,
                  color: "#7d8ea5",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontWeight: 700,
                }}
              >
                Phase
              </span>
            )}
            <select
              value={phase}
              onChange={(e) => savePortfolioPhase(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "#60a5fa",
                fontSize: isMobile ? 12 : 13,
                fontWeight: 700,
                fontFamily: "'Inter', sans-serif",
                outline: "none",
                cursor: "pointer",
                maxWidth: isMobile ? 92 : "none",
              }}
            >
              <option value="Build">🏗️ Build</option>
              <option value="Accumulate">📦 Accumulate</option>
              <option value="Income">💰 Income</option>
            </select>
          </div>
          {!isMobile && (
            <>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#34d399",
                  display: "inline-block",
                  boxShadow: "0 0 8px #34d399",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "#7d8ea5",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {summary.lastUpdate || "—"}
              </span>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          padding: isMobile ? "14px 14px 28px" : "24px 28px 48px",
          maxWidth: 1260,
        }}
      >
        {loading && (
          <div
            style={{
              background: "#102542",
              border: "1px solid #2563eb",
              borderRadius: 12,
              padding: "11px 16px",
              marginBottom: 16,
              color: "#93c5fd",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Loading portfolio...
          </div>
        )}

        {loadError && (
          <div
            style={{
              background: "#2d1515",
              border: "1px solid #7f1d1d",
              borderRadius: 12,
              padding: "11px 16px",
              marginBottom: 16,
              color: "#fca5a5",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Error: {loadError}
          </div>
        )}

        {tab === "dashboard" && (
          <>
            {needRebal ? (
              <div
                style={{
                  background: "linear-gradient(135deg,#2b1417,#1b0c0e)",
                  border: "1px solid #7f1d1d",
                  borderRadius: 14,
                  padding: isMobile ? "12px 14px" : "14px 18px",
                  marginBottom: 22,
                  display: "flex",
                  alignItems: isMobile ? "flex-start" : "center",
                  gap: 12,
                  flexDirection: isMobile ? "column" : "row",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span>🔴</span>
                  <span
                    style={{ fontWeight: 800, color: "#fca5a5", fontSize: 13 }}
                  >
                    Rebalance Needed
                  </span>
                </div>
                <span style={{ color: "#7d8ea5", fontSize: 12 }}>
                  Dividend overweight +{fmt(Math.abs(divGap))}% · Target D:
                  {phaseData.dividendPct}% / G:{phaseData.growthPct}%
                </span>
              </div>
            ) : (
              equityValue > 0 && (
                <div
                  style={{
                    background: "#06261a",
                    border: "1px solid #0d5a3d",
                    borderRadius: 14,
                    padding: isMobile ? "12px 14px" : "14px 18px",
                    marginBottom: 22,
                  }}
                >
                  <span>✅ </span>
                  <span
                    style={{ fontWeight: 800, color: "#4ade80", fontSize: 13 }}
                  >
                    Portfolio Balanced
                  </span>
                  <span
                    style={{ color: "#7d8ea5", fontSize: 12, marginLeft: 8 }}
                  >
                    Phase: {phase}
                  </span>
                </div>
              )
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : isTablet
                  ? "repeat(2,1fr)"
                  : "repeat(6,1fr)",
                gap: 14,
                marginBottom: 20,
              }}
            >
              {[
                {
                  label: "Total Wealth",
                  value: `฿${fmtB(totalWealth)}`,
                  sub: `Equity ฿${fmtB(equityValue)} + Cash ฿${fmtB(
                    num(cash)
                  )}`,
                  accent: "#3b82f6",
                },
                {
                  label: "Unrealized P/L",
                  value: `${totalGL >= 0 ? "+" : ""}฿${fmtB(
                    Math.abs(totalGL)
                  )}`,
                  sub: `${totalGLPct >= 0 ? "+" : ""}${fmt(
                    totalGLPct
                  )}% vs cost basis`,
                  accent: totalGL >= 0 ? "#34d399" : "#f87171",
                },
                {
                  label: "Dividend Value",
                  value: `฿${fmtB(divValue)}`,
                  sub: `${fmt(divPct)}% (Target ${phaseData.dividendPct}%)`,
                  accent: "#34d399",
                },
                {
                  label: "Growth Value",
                  value: `฿${fmtB(growValue)}`,
                  sub: `${fmt(growPct)}% (Target ${phaseData.growthPct}%)`,
                  accent: "#60a5fa",
                },
                {
                  label: "Portfolio Name",
                  value: portfolioName || "—",
                  accent: "#a78bfa",
                },
                {
                  label: "Line Available",
                  value: `฿${fmt(num(cash))}`,
                  accent: "#f59e0b",
                },
              ].map((c, i) => (
                <div
                  key={i}
                  className={card}
                  style={{
                    padding: isMobile ? "16px 16px" : "18px 20px",
                    borderTop: `2px solid ${c.accent}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: isMobile ? 12 : 13,
                      color: "#d6e0ee",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      marginBottom: 8,
                    }}
                  >
                    {c.label}
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? 18 : 22,
                      fontWeight: 800,
                      fontFamily: "'DM Mono', monospace",
                      color: c.accent,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {c.value}
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? 11 : 12,
                      color: "#7f8da3",
                      marginTop: 6,
                      lineHeight: 1.45,
                    }}
                  >
                    {c.sub}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
                <div style={ST}>Portfolio Allocation — Phase: {phase}</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    gap: 18,
                    flexDirection: isMobile ? "column" : "row",
                  }}
                >
                  <ResponsiveContainer
                    width={isMobile ? 120 : 140}
                    height={isMobile ? 120 : 140}
                  >
                    <PieChart>
                      <Pie
                        data={typeData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={isMobile ? 30 : 38}
                        outerRadius={isMobile ? 50 : 60}
                        paddingAngle={4}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {typeData.map((e, i) => (
                          <Cell
                            key={i}
                            fill={i === 0 ? "#34d399" : "#60a5fa"}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  <div style={{ flex: 1, width: "100%" }}>
                    {[
                      {
                        label: "Dividend",
                        pct: divPct,
                        target: phaseData.dividendPct,
                        color: "#34d399",
                        gap: divGap,
                      },
                      {
                        label: "Growth",
                        pct: growPct,
                        target: phaseData.growthPct,
                        color: "#60a5fa",
                        gap: growGap,
                      },
                    ].map((s) => (
                      <div key={s.label} style={{ marginBottom: 14 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 5,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#b6c3d6",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontWeight: 600,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: s.color,
                                display: "inline-block",
                              }}
                            />
                            {s.label}
                          </span>
                          <span
                            style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 12,
                              color: s.color,
                              fontWeight: 700,
                            }}
                          >
                            {fmt(s.pct)}%
                          </span>
                        </div>

                        <div className="pbar">
                          <div
                            className="pfill"
                            style={{
                              width: `${Math.min(s.pct, 100)}%`,
                              background: s.color,
                            }}
                          />
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 4,
                          }}
                        >
                          <span style={{ fontSize: 10, color: "#63748b" }}>
                            Target {s.target}%
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "'DM Mono', monospace",
                              color:
                                Math.abs(s.gap) <= 5
                                  ? "#4ade80"
                                  : s.gap > 0
                                  ? "#f87171"
                                  : "#f59e0b",
                              fontWeight: 700,
                            }}
                          >
                            {s.gap > 0 ? "+" : ""}
                            {fmt(s.gap)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
                <div style={ST}>P/L by Position</div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {[...computed]
                    .sort((a, b) => b.glPct - a.glPct)
                    .map((h) => (
                      <div
                        key={h.symbol}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            width: isMobile ? 52 : 64,
                            fontSize: 12,
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 700,
                            color: "#e2e8f0",
                          }}
                        >
                          {h.symbol}
                        </span>
                        <span
                          className="pill"
                          style={{
                            ...typeBadgeStyle(h.type),
                            padding: isMobile ? "4px 8px" : "4px 10px",
                          }}
                        >
                          {normalizeHoldingType(h.type)[0]}
                        </span>
                        <div
                          style={{
                            flex: 1,
                            height: 18,
                            background: "#091221",
                            borderRadius: 5,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(
                                (Math.abs(h.glPct) / 10) * 100,
                                100
                              )}%`,
                              background:
                                h.gl >= 0
                                  ? "linear-gradient(90deg,#0d5a3d,#10b981)"
                                  : "linear-gradient(90deg,#7f1d1d,#ef4444)",
                              borderRadius: 5,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            width: isMobile ? 56 : 62,
                            textAlign: "right",
                            fontSize: 11,
                            fontFamily: "'DM Mono', monospace",
                            color: h.gl >= 0 ? "#34d399" : "#f87171",
                            fontWeight: 700,
                          }}
                        >
                          {h.gl >= 0 ? "+" : ""}
                          {fmt(h.glPct)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className={card} style={{ overflow: "hidden" }}>
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #1d2a3d",
                  background: "#060d18",
                }}
              >
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: isMobile ? 14 : 15,
                    letterSpacing: "-0.02em",
                    color: "#e2e8f0",
                  }}
                >
                  Holdings — {computed.length} Positions
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    minWidth: 900,
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#060d18" }}>
                      {[
                        ["Symbol", true],
                        ["Type", true],
                        ["Units", false],
                        ["Avg Cost", false],
                        ["Price", false],
                        ["Market Value", false],
                        ["P/L (฿)", false],
                        ["P/L (%)", false],
                      ].map(([h, l]) => (
                        <th key={h} style={TH(Boolean(l))}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {[...computed]
                      .sort((a, b) =>
                        String(a.symbol).localeCompare(String(b.symbol), "en", {
                          sensitivity: "base",
                        })
                      )
                      .map((h, i) => (
                        <tr
                          key={`${h.symbol}-${i}`}
                          className="rh"
                          style={{
                            background: i % 2 === 0 ? "transparent" : "#08111f",
                          }}
                        >
                          <td
                            style={{
                              padding: "11px 14px",
                              fontFamily: "'DM Mono', monospace",
                              fontWeight: 700,
                              fontSize: 13,
                              color: "#e2e8f0",
                            }}
                          >
                            {h.symbol}
                          </td>
                          <td style={{ padding: "11px 14px" }}>
                            <span
                              className="pill"
                              style={{
                                ...typeBadgeStyle(h.type),
                              }}
                            >
                              {normalizeHoldingType(h.type)}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              textAlign: "right",
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 12,
                              color: "#aebacd",
                            }}
                          >
                            {Number(h.units).toLocaleString()}
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              textAlign: "right",
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 12,
                              color: "#aebacd",
                            }}
                          >
                            ฿{fmt(num(h.avgCost))}
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              textAlign: "right",
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 13,
                              color: "#f2f6fb",
                              fontWeight: 600,
                            }}
                          >
                            ฿{fmt(num(h.price))}
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              textAlign: "right",
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 13,
                              color: "#e2e8f0",
                            }}
                          >
                            ฿{fmt(h.value)}
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              textAlign: "right",
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 12,
                              color: h.gl >= 0 ? "#34d399" : "#f87171",
                              fontWeight: 700,
                            }}
                          >
                            {h.gl >= 0 ? "+" : ""}฿{fmt(h.gl)}
                          </td>
                          <td
                            style={{ padding: "11px 14px", textAlign: "right" }}
                          >
                            <span
                              className="pill"
                              style={{
                                background: h.gl >= 0 ? "#07261c" : "#2d1515",
                                color: h.gl >= 0 ? "#4ade80" : "#f87171",
                                border: `1px solid ${
                                  h.gl >= 0 ? "#0d5a3d" : "#7f1d1d"
                                }`,
                              }}
                            >
                              {h.gl >= 0 ? "+" : ""}
                              {fmt(h.glPct)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "trades" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 16,
            }}
          >
            <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "flex-start" : "center",
                  flexDirection: isMobile ? "column" : "row",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#e2e8f0",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 0,
                  }}
                >
                  🟢 Buy Orders
                </div>
                <button
                  disabled
                  style={{
                    background: "#0d1526",
                    border: "1px solid #1a2540",
                    color: "#64748b",
                    borderRadius: 8,
                    padding: "6px 14px",
                    fontSize: 12,
                    cursor: "not-allowed",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 700,
                    opacity: 0.7,
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  Synced from Google Sheets
                </button>
              </div>

              {buyOrders.filter((o, i) => String(o.execute || o.note || "EXECUTE").trim().toUpperCase() !== "SKIP" && !loggedOrderIds.includes(`BUY-${o.id || o.symbol || i}`)).length === 0 && (
                <div
                  style={{
                    background: "#080e1c",
                    borderRadius: 12,
                    padding: "28px 20px",
                    textAlign: "center",
                    border: "1px dashed #1a2540",
                    color: "#5f728a",
                    fontSize: 13,
                  }}
                >
                  No buy orders
                </div>
              )}

              {buyOrders.filter((o, i) => String(o.execute || o.note || "EXECUTE").trim().toUpperCase() !== "SKIP" && !loggedOrderIds.includes(`BUY-${o.id || o.symbol || i}`)).map((o, i) => {
                const orderId = `BUY-${o.id || o.symbol || i}`;
                const edit = getOrderEdit(o, "BUY");
                const isLogged = loggedOrderIds.includes(orderId);
                const buyUnits = num(o.units);
                const buyCash = num(o.cash);
                const isActionableBuy = buyUnits > 0 && buyCash > 0;
                const orderNote =
                  o.note || o.status || "Wait for next budget cycle";

                return (
                  <div
                    key={o.id || i}
                    style={{
                      background: "#080e1c",
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 10,
                      border: "1px solid #0d5a3d",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: isMobile ? "flex-start" : "center",
                        flexDirection: isMobile ? "column" : "row",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 700,
                            fontSize: 16,
                            color: "#e2e8f0",
                          }}
                        >
                          {o.symbol}
                        </span>
                        <span
                          className="pill"
                          style={{ ...typeBadgeStyle(o.type) }}
                        >
                          {normalizeHoldingType(o.type)}
                        </span>
                      </div>

                      <span
                        className="pill"
                        style={{
                          background: isActionableBuy ? "#07261c" : "#33260b",
                          color: isActionableBuy ? "#4ade80" : "#fbbf24",
                          border: `1px solid ${
                            isActionableBuy ? "#0d5a3d" : "#8a6a16"
                          }`,
                        }}
                      >
                        {isActionableBuy ? "BUY" : orderNote}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
                        gap: 8,
                      }}
                    >
                      {[
                        ["Suggested Price", `฿${fmt(num(o.price))}`],
                        [
                          "Suggested Units",
                          `${buyUnits.toLocaleString()} shares`,
                        ],
                        ["Suggested Cash", `฿${fmt(buyCash)}`],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          style={{
                            background: "#0d1526",
                            borderRadius: 8,
                            padding: "8px 10px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: "#64748b",
                              marginBottom: 3,
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                            }}
                          >
                            {k}
                          </div>
                          <div
                            style={{
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 13,
                              color: "#b8c5d6",
                            }}
                          >
                            {v}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      <div
                        style={{
                          background: "#0d1526",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            marginBottom: 5,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          Actual Units
                        </div>
                        <input
                          value={edit.actualUnits}
                          onChange={(e) =>
                            updateOrderEdit(
                              orderId,
                              "actualUnits",
                              e.target.value
                            )
                          }
                          disabled={isLogged || !isActionableBuy}
                          style={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#e2e8f0",
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        />
                      </div>

                      <div
                        style={{
                          background: "#0d1526",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            marginBottom: 5,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          Actual Buy Price
                        </div>
                        <input
                          value={edit.actualPrice}
                          onChange={(e) =>
                            updateOrderEdit(
                              orderId,
                              "actualPrice",
                              e.target.value
                            )
                          }
                          disabled={isLogged || !isActionableBuy}
                          style={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#f59e0b",
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        />
                      </div>
                    </div>

                    <select
                      value={edit.note || "Follow System"}
                      onChange={(e) =>
                        updateOrderEdit(orderId, "note", e.target.value)
                      }
                      disabled={isLogged || !isActionableBuy}
                      style={{
                        width: "100%",
                        marginTop: 8,
                        background: "#0d1526",
                        border: "1px solid #1d2a3d",
                        borderRadius: 8,
                        color: "#aebacd",
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 12,
                        padding: "8px 10px",
                        outline: "none",
                      }}
                    >
                      {SYSTEM_ORDER_NOTE_OPTIONS.map((noteOption) => (
                        <option key={noteOption} value={noteOption}>
                          {noteOption}
                        </option>
                      ))}
                    </select>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 10,
                        color: isLogged
                          ? "#4ade80"
                          : isActionableBuy
                          ? "#aebacd"
                          : "#fbbf24",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor:
                          isLogged || loading || !isActionableBuy
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isLogged}
                        disabled={isLogged || loading || !isActionableBuy}
                        onChange={(e) => {
                          if (e.target.checked) saveOrderDecision(o, "BUY");
                        }}
                      />
                      {isLogged
                        ? "Recorded to Decision Log"
                        : isActionableBuy
                        ? "Done — save to Decision Log"
                        : "Waiting — not enough for 1 lot"}
                    </label>
                  </div>
                );
              })}

              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  background: "#080e1c",
                  borderRadius: 10,
                  border: "1px solid #1a2540",
                  fontSize: 12,
                  color: "#64748b",
                  lineHeight: 1.5,
                }}
              >
                💵 Cash Available:{" "}
                <span
                  style={{
                    color: "#34d399",
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 700,
                  }}
                >
                  ฿{fmt(num(cash))}
                </span>
                &nbsp;|&nbsp; Total Buy Need:{" "}
                <span
                  style={{
                    color: "#60a5fa",
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 700,
                  }}
                >
                  ฿{fmt(totalBuyCash)}
                </span>
                &nbsp;|&nbsp; Growth Sell:{" "}
                <span
                  style={{
                    color: "#f59e0b",
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 700,
                  }}
                >
                  ฿{fmt(growthSellCash)}
                </span>
                &nbsp;|&nbsp; Remaining Need:{" "}
                <span
                  style={{
                    color: remainingNeedCash > 0 ? "#f87171" : "#34d399",
                    fontFamily: "'DM Mono', monospace",
                    fontWeight: 700,
                  }}
                >
                  ฿{fmt(remainingNeedCash)}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: isMobile ? "flex-start" : "center",
                    flexDirection: isMobile ? "column" : "row",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#e2e8f0",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 0,
                    }}
                  >
                    🔴 Sell Orders
                  </div>
                  <button
                    disabled
                    style={{
                      background: "#0d1526",
                      border: "1px solid #1a2540",
                      color: "#64748b",
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 12,
                      cursor: "not-allowed",
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 700,
                      opacity: 0.7,
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    Synced from Google Sheets
                  </button>
                </div>

                {sellOrders.length === 0 ||
                (sellOrders.length === 1 &&
                  !sellOrders[0].symbol &&
                  String(sellOrders[0].type)
                    .toLowerCase()
                    .includes("no asset")) ? (
                  <div
                    style={{
                      background: "#080e1c",
                      borderRadius: 12,
                      padding: "28px 20px",
                      textAlign: "center",
                      border: "1px dashed #1a2540",
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>—</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      No sell orders
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#334155", marginTop: 4 }}
                    >
                      Current phase: {phase}
                    </div>
                  </div>
                ) : (
                  sellOrders.map((o, i) => {
                    const orderId = `SELL-${o.id || o.symbol || i}`;
                    const edit = getOrderEdit(o, "SELL");
                    const isLogged = loggedOrderIds.includes(orderId);

                    return (
                      <div
                        key={o.id || i}
                        style={{
                          background: "#080e1c",
                          borderRadius: 12,
                          padding: 16,
                          marginBottom: 10,
                          border: "1px solid #7f1d1d",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: isMobile ? "flex-start" : "center",
                            flexDirection: isMobile ? "column" : "row",
                            gap: 10,
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "'DM Mono', monospace",
                                fontWeight: 700,
                                fontSize: 16,
                                color: "#e2e8f0",
                              }}
                            >
                              {o.symbol || "—"}
                            </span>
                            {!!o.type &&
                              !String(o.type)
                                .toLowerCase()
                                .includes("no asset") && (
                                <span
                                  className="pill"
                                  style={{ ...typeBadgeStyle(o.type) }}
                                >
                                  {normalizeHoldingType(o.type)}
                                </span>
                              )}
                          </div>

                          <span
                            className="pill"
                            style={{
                              background: "#2d1515",
                              color: "#f87171",
                              border: "1px solid #7f1d1d",
                            }}
                          >
                            {o.status || "PENDING"}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: isMobile
                              ? "1fr"
                              : "repeat(3,1fr)",
                            gap: 8,
                          }}
                        >
                          {[
                            [
                              "Suggested Price",
                              o.price === "" ? "—" : `฿${fmt(num(o.price))}`,
                            ],
                            [
                              "Suggested Units",
                              o.units === ""
                                ? "—"
                                : `${Number(o.units).toLocaleString()} shares`,
                            ],
                            [
                              "Sell Value",
                              o.sellValue === ""
                                ? "—"
                                : `฿${fmt(num(o.sellValue))}`,
                            ],
                          ].map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                background: "#0d1526",
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "#64748b",
                                  marginBottom: 3,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                }}
                              >
                                {k}
                              </div>
                              <div
                                style={{
                                  fontFamily: "'DM Mono', monospace",
                                  fontSize: 13,
                                  color: "#b8c5d6",
                                }}
                              >
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                            gap: 8,
                            marginTop: 10,
                          }}
                        >
                          <div
                            style={{
                              background: "#0d1526",
                              borderRadius: 8,
                              padding: "8px 10px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                color: "#64748b",
                                marginBottom: 5,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                              }}
                            >
                              Actual Units
                            </div>
                            <input
                              value={edit.actualUnits}
                              onChange={(e) =>
                                updateOrderEdit(
                                  orderId,
                                  "actualUnits",
                                  e.target.value
                                )
                              }
                              disabled={isLogged}
                              style={{
                                width: "100%",
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "#e2e8f0",
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 13,
                                fontWeight: 800,
                              }}
                            />
                          </div>

                          <div
                            style={{
                              background: "#0d1526",
                              borderRadius: 8,
                              padding: "8px 10px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                color: "#64748b",
                                marginBottom: 5,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                              }}
                            >
                              Actual Sell Price
                            </div>
                            <input
                              value={edit.actualPrice}
                              onChange={(e) =>
                                updateOrderEdit(
                                  orderId,
                                  "actualPrice",
                                  e.target.value
                                )
                              }
                              disabled={isLogged}
                              style={{
                                width: "100%",
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "#f59e0b",
                                fontFamily: "'DM Mono', monospace",
                                fontSize: 13,
                                fontWeight: 800,
                              }}
                            />
                          </div>
                        </div>

                        <select
                          value={edit.note || "Follow System"}
                          onChange={(e) =>
                            updateOrderEdit(orderId, "note", e.target.value)
                          }
                          disabled={isLogged}
                          style={{
                            width: "100%",
                            marginTop: 8,
                            background: "#0d1526",
                            border: "1px solid #1d2a3d",
                            borderRadius: 8,
                            color: "#aebacd",
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 12,
                            padding: "8px 10px",
                            outline: "none",
                          }}
                        >
                          {SYSTEM_ORDER_NOTE_OPTIONS.map((noteOption) => (
                            <option key={noteOption} value={noteOption}>
                              {noteOption}
                            </option>
                          ))}
                        </select>

                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 10,
                            color: isLogged ? "#4ade80" : "#aebacd",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor:
                              isLogged || loading ? "not-allowed" : "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isLogged}
                            disabled={isLogged || loading}
                            onChange={(e) => {
                              if (e.target.checked)
                                saveOrderDecision(o, "SELL");
                            }}
                          />
                          {isLogged
                            ? "Recorded to Decision Log"
                            : "Done — save to Decision Log"}
                        </label>
                      </div>
                    );
                  })
                )}
              </div>

              <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
                <div style={ST}>Circuit Status</div>

                {circuitAlerts.length === 0 ? (
                  <div
                    style={{
                      border: "1px dashed #1d2a3d",
                      borderRadius: 12,
                      padding: "18px 16px",
                      color: "#64748b",
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    No circuit alerts
                  </div>
                ) : (
                  circuitAlerts.map((alert) => {
                    const isReview = alert.status === "REVIEW";
                    const isCooling = alert.status === "COOLING";
                    const borderColor = isReview
                      ? "#7f1d1d"
                      : isCooling
                      ? "#92400e"
                      : "#334155";
                    const bgColor = isReview
                      ? "#1a0f0f"
                      : isCooling
                      ? "#1f1708"
                      : "#080e1c";
                    const textColor = isReview
                      ? "#fca5a5"
                      : isCooling
                      ? "#fbbf24"
                      : "#cbd5e1";

                    return (
                      <div
                        key={alert.id}
                        style={{
                          background: bgColor,
                          border: `1px solid ${borderColor}`,
                          borderRadius: 12,
                          padding: "14px 16px",
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <strong
                            style={{
                              color: "#e2e8f0",
                              fontSize: 13,
                              letterSpacing: "0.04em",
                            }}
                          >
                            {isReview ? "🔴" : isCooling ? "🟠" : "⚠️"} {alert.asset}
                          </strong>
                          <span
                            style={{
                              border: `1px solid ${borderColor}`,
                              borderRadius: 999,
                              padding: "4px 10px",
                              color: textColor,
                              background: "rgba(0,0,0,0.18)",
                              fontFamily: "'DM Mono', monospace",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {alert.status}
                          </span>
                        </div>

                        <div
                          style={{
                            marginTop: 8,
                            color: textColor,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {alert.message ||
                            (isReview
                              ? "Review position before adding more"
                              : "Pause averaging before adding more")}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
                <div style={ST}>Rebalance Insight</div>
                {[
                  {
                    label: "Growth",
                    pct: growPct,
                    target: phaseData.growthPct,
                    gap: growGap,
                    color: "#60a5fa",
                    advice:
                      growGap < -5
                        ? `🟢 Buy Bias — increase Growth from ${fmt(
                            growPct
                          )}% to ${phaseData.growthPct}%`
                        : growGap > 5
                        ? `⚠️ Trim Bias — Growth exceeds target by ${fmt(
                            growGap
                          )}%`
                        : `✅ Growth is on target`,
                  },
                  {
                    label: "Dividend",
                    pct: divPct,
                    target: phaseData.dividendPct,
                    gap: divGap,
                    color: "#34d399",
                    advice:
                      divGap > 5
                        ? `🔴 Trim Bias — Dividend exceeds target by ${fmt(
                            divGap
                          )}%`
                        : divGap < -5
                        ? `🟢 Buy Bias — increase Dividend`
                        : `✅ Dividend is on target`,
                  },
                ].map((r, i) => {
                  const isOk = Math.abs(r.gap) <= 5;
                  const isOver = r.gap > 5;

                  return (
                    <div
                      key={i}
                      style={{
                        background: isOk
                          ? "#080e1c"
                          : isOver
                          ? "#1a0f0f"
                          : "#0d1a10",
                        border: `1px solid ${
                          isOk ? "#1a2540" : isOver ? "#7f1d1d" : "#0d5a3d"
                        }`,
                        borderRadius: 10,
                        padding: "12px 14px",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: isOk
                            ? "#4ade80"
                            : isOver
                            ? "#fca5a5"
                            : "#4ade80",
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        {r.advice}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          lineHeight: 1.5,
                        }}
                      >
                        Current{" "}
                        <span
                          style={{
                            color: r.color,
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 700,
                          }}
                        >
                          {fmt(r.pct)}%
                        </span>
                        &nbsp;→ Target{" "}
                        <span
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 700,
                          }}
                        >
                          {r.target}%
                        </span>
                        &nbsp;(Gap:{" "}
                        <span
                          style={{
                            color: isOk
                              ? "#4ade80"
                              : isOver
                              ? "#f87171"
                              : "#f59e0b",
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 700,
                          }}
                        >
                          {r.gap > 0 ? "+" : ""}
                          {fmt(r.gap)}%
                        </span>
                        )
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={card}
              style={{
                padding: isMobile ? 16 : 22,
                gridColumn: "1 / -1",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "flex-start" : "center",
                  flexDirection: isMobile ? "column" : "row",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div style={{ ...ST, marginBottom: 0 }}>Manual Override</div>
                <span
                  className="pill"
                  style={{
                    background: "#2a1f0a",
                    border: "1px solid #7c5c12",
                    color: "#fbbf24",
                  }}
                >
                  OFF_SYSTEM
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 0.8fr 0.8fr 0.8fr 0.8fr",
                  gap: 12,
                }}
              >
                <div>
                  <div style={ST}>Asset Code</div>
                  <input
                    value={decisionForm.assetCode}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        assetCode: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g. SPALI"
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#e2e8f0",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <div style={ST}>Action</div>
                  <select
                    value={decisionForm.action}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        action: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color:
                        decisionForm.action === "SELL" ? "#f87171" : "#34d399",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 800,
                    }}
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>

                <div>
                  <div style={ST}>Units</div>
                  <input
                    value={decisionForm.units}
                    onChange={(e) =>
                      setDecisionForm((p) => ({ ...p, units: e.target.value }))
                    }
                    placeholder="0"
                    type="number"
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#e2e8f0",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <div style={ST}>Price</div>
                  <input
                    value={decisionForm.price}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        price: e.target.value,
                        marketPrice: p.marketPrice || e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    type="number"
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#f59e0b",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 800,
                    }}
                  />
                </div>

                <div>
                  <div style={ST}>Market Price</div>
                  <input
                    value={decisionForm.marketPrice}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        marketPrice: e.target.value,
                      }))
                    }
                    placeholder={decisionForm.price || "0.00"}
                    type="number"
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#93c5fd",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 800,
                    }}
                  />
                </div>

                <div>
                  <div style={ST}>Reason</div>
                  <select
                    value={decisionForm.note || "OFF_SYSTEM"}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        note: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#fbbf24",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 800,
                    }}
                  >
                    {MANUAL_OVERRIDE_NOTE_OPTIONS.map((noteOption) => (
                      <option key={noteOption} value={noteOption}>
                        {noteOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={saveDecisionRecord}
                style={{
                  marginTop: 16,
                  background: decisionSaved
                    ? "#06261a"
                    : "linear-gradient(135deg,#1d4ed8,#2563eb)",
                  border: `1px solid ${decisionSaved ? "#0d5a3d" : "#3b82f6"}`,
                  color: decisionSaved ? "#4ade80" : "#fff",
                  borderRadius: 12,
                  padding: "14px 18px",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: decisionSaved
                    ? "none"
                    : "0 10px 24px rgba(37,99,235,.22)",
                  width: "100%",
                }}
              >
                {decisionSaved ? "Recorded" : "Save to Decision Log"}
              </button>
            </div>
          </div>
        )}

        {tab === "record" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 16,
            }}
          >
            <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "flex-start" : "center",
                  flexDirection: isMobile ? "column" : "row",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div style={{ ...ST, marginBottom: 0 }}>Manual Override</div>
                <span
                  className="pill"
                  style={{
                    background: "#2a1f0a",
                    border: "1px solid #7c5c12",
                    color: "#fbbf24",
                  }}
                >
                  OFF_SYSTEM
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <div style={ST}>Asset Code</div>
                  <input
                    value={decisionForm.assetCode}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        assetCode: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g. BBIK"
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#e2e8f0",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <div style={ST}>Action</div>
                  <select
                    value={decisionForm.action}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        action: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color:
                        decisionForm.action === "SELL" ? "#f87171" : "#34d399",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 800,
                    }}
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>

                <div>
                  <div style={ST}>Units</div>
                  <input
                    value={decisionForm.units}
                    onChange={(e) =>
                      setDecisionForm((p) => ({ ...p, units: e.target.value }))
                    }
                    placeholder="0"
                    type="number"
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#e2e8f0",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <div style={ST}>Price</div>
                  <input
                    value={decisionForm.price}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        price: e.target.value,
                        marketPrice: p.marketPrice || e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    type="number"
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#f59e0b",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 800,
                    }}
                  />
                </div>

                <div>
                  <div style={ST}>Market Price</div>
                  <input
                    value={decisionForm.marketPrice}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        marketPrice: e.target.value,
                      }))
                    }
                    placeholder={decisionForm.price || "0.00"}
                    type="number"
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#93c5fd",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 800,
                    }}
                  />
                </div>

                <div>
                  <div style={ST}>Reason</div>
                  <select
                    value={decisionForm.note || "OFF_SYSTEM"}
                    onChange={(e) =>
                      setDecisionForm((p) => ({
                        ...p,
                        note: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#fbbf24",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 800,
                    }}
                  >
                    {MANUAL_OVERRIDE_NOTE_OPTIONS.map((noteOption) => (
                      <option key={noteOption} value={noteOption}>
                        {noteOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={saveDecisionRecord}
                style={{
                  marginTop: 16,
                  background: decisionSaved
                    ? "#06261a"
                    : "linear-gradient(135deg,#1d4ed8,#2563eb)",
                  border: `1px solid ${decisionSaved ? "#0d5a3d" : "#3b82f6"}`,
                  color: decisionSaved ? "#4ade80" : "#fff",
                  borderRadius: 12,
                  padding: "14px 18px",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: decisionSaved
                    ? "none"
                    : "0 10px 24px rgba(37,99,235,.22)",
                  width: "100%",
                }}
              >
                {decisionSaved ? "Recorded" : "Save to Decision Log"}
              </button>
            </div>

            <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
              <div style={ST}>How this works</div>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  color: "#aebacd",
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                <div style={IB}>
                  <b style={{ color: "#e2e8f0" }}>1. Follow Orders</b>
                  <br />
                  Use the Orders tab as the system suggestion.
                </div>
                <div style={IB}>
                  <b style={{ color: "#e2e8f0" }}>2. Execute in Broker</b>
                  <br />
                  Buy or sell in your trading app.
                </div>
                <div style={IB}>
                  <b style={{ color: "#e2e8f0" }}>3. Save Record</b>
                  <br />
                  This creates a DECISION LOG row and prevents immediate flip
                  trades.
                </div>
                <div
                  style={{
                    background: "#0d1a10",
                    border: "1px solid #0d5a3d",
                    borderRadius: 10,
                    padding: "12px 14px",
                    color: "#4ade80",
                    fontWeight: 700,
                  }}
                >
                  Anti-Flip: recent trades are temporarily locked unless time
                  passes or price moves enough.
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "input" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
              gap: 20,
            }}
          >
            <div>
              <div style={{ ...IB, padding: 0, overflow: "hidden" }}>
                <div
                  style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid #1d2a3d",
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    justifyContent: "space-between",
                    flexDirection: isMobile ? "column" : "row",
                    gap: 12,
                    background: "#060d18",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 13,
                        color: "#e2e8f0",
                      }}
                    >
                      Portfolio Holdings
                    </div>
                    <div
                      style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}
                    >
                      Enter symbol, type, units, average cost, and target %.
                      Price is automatic.
                    </div>
                  </div>
                  <button
                    onClick={addHolding}
                    style={{
                      background: "#1f3c63",
                      border: "none",
                      color: "#8ec5ff",
                      borderRadius: 8,
                      padding: "7px 14px",
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 700,
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    + Add Position
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 980,
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#060d18" }}>
                        {[
                          "#",
                          "Symbol",
                          "Type",
                          "Units",
                          "Avg Cost",
                          "Target %",
                          "Price",
                          "Market Value",
                          "",
                        ].map((h, i) => (
                          <th
                            key={i}
                            style={{
                              padding: "12px 10px",
                              fontSize: 11,
                              color: "#d6e0ee",
                              fontWeight: 800,
                              textAlign:
                                i === 0 || i === 8
                                  ? "center"
                                  : i <= 2
                                  ? "left"
                                  : "right",
                              textTransform: "uppercase",
                              letterSpacing: "0.12em",
                              borderBottom: "1px solid #1d2a3d",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {holdings.map((h, i) => {
                        const mv = num(h.units) * num(h.price);

                        return (
                          <tr
                            key={i}
                            className="rh"
                            style={{
                              background:
                                i % 2 === 0 ? "transparent" : "#08111f",
                              borderBottom: "1px solid #0d1526",
                            }}
                          >
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "center",
                                fontSize: 10,
                                color: "#4b607b",
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {i + 1}
                            </td>
                            <td style={{ padding: "4px 5px" }}>
                              <EInput
                                val={h.symbol}
                                onChange={(v) =>
                                  updateHolding(i, "symbol", v.toUpperCase())
                                }
                                placeholder="SYMBOL"
                                align="left"
                                width="76px"
                              />
                            </td>
                            <td style={{ padding: "4px 5px" }}>
                              <EInput
                                val={normalizeHoldingType(h.type)}
                                onChange={(v) => updateHolding(i, "type", v)}
                                options={HOLDING_TYPES}
                                width="88px"
                              />
                            </td>
                            <td style={{ padding: "4px 5px" }}>
                              <EInput
                                val={h.units}
                                onChange={(v) => updateHolding(i, "units", v)}
                                placeholder="0"
                                width="66px"
                              />
                            </td>
                            <td style={{ padding: "4px 5px" }}>
                              <EInput
                                val={h.avgCost}
                                onChange={(v) => updateHolding(i, "avgCost", v)}
                                placeholder="0.00"
                                width="72px"
                              />
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "right",
                                fontSize: 12,
                                fontFamily: "'DM Mono', monospace",
                                color:
                                  targetPct(h.targetWeight) > 0
                                    ? "#60a5fa"
                                    : "#64748b",
                                fontWeight: 800,
                                letterSpacing: "0.01em",
                              }}
                            >
                              {fmtPct(h.targetWeight, 0)}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "right",
                                fontSize: 12,
                                fontFamily: "'DM Mono', monospace",
                                color: num(h.price) > 0 ? "#9fb0c6" : "#64748b",
                                fontWeight: 400,
                                letterSpacing: "0.01em",
                              }}
                            >
                              {num(h.price) > 0 ? fmt(num(h.price)) : "—"}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "right",
                                fontSize: 11,
                                fontFamily: "'DM Mono', monospace",
                                color: mv > 0 ? "#b8c5d6" : "#2f3f55",
                              }}
                            >
                              {mv > 0 ? `฿${fmt(mv)}` : "—"}
                            </td>
                            <td
                              style={{
                                padding: "4px 5px",
                                textAlign: "center",
                              }}
                            >
                              <button
                                className="ibtn"
                                onClick={() => removeHolding(i)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    <tfoot>
                      <tr
                        style={{
                          background: "#060d18",
                          borderTop: "2px solid #1d2a3d",
                        }}
                      >
                        <td
                          colSpan={7}
                          style={{
                            padding: "11px 14px",
                            fontSize: 11,
                            color: "#7d8ea5",
                            fontWeight: 800,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                          }}
                        >
                          Total Equity
                        </td>
                        <td
                          style={{
                            padding: "11px 14px",
                            textAlign: "right",
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#f2f6fb",
                          }}
                        >
                          ฿{fmt(equityValue)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div style={IB}>
                <div style={ST}>Portfolio Name</div>
                <input
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="Enter portfolio name"
                  style={{
                    width: "100%",
                    background: "#0d1526",
                    border: "1px solid #1d2a3d",
                    borderRadius: 10,
                    color: "#e2e8f0",
                    fontSize: 14,
                    fontFamily: "'DM Mono', monospace",
                    padding: "10px 12px",
                    outline: "none",
                    fontWeight: 600,
                  }}
                />
              </div>

              <div style={IB}>
                <div style={ST}>Cash / Line Available</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 13, color: "#7d8ea5" }}>฿</span>
                  <input
                    value={cash}
                    onChange={(e) => setCash(e.target.value)}
                    type="number"
                    style={{
                      background: "#0d1526",
                      border: "1px solid #1d2a3d",
                      borderRadius: 10,
                      color: "#34d399",
                      fontSize: 16,
                      fontFamily: "'DM Mono', monospace",
                      padding: "9px 12px",
                      outline: "none",
                      width: isMobile ? "100%" : "220px",
                      fontWeight: 700,
                    }}
                  />
                  {!isMobile && (
                    <span style={{ fontSize: 11, color: "#4b607b" }}>THB</span>
                  )}
                </div>
              </div>


              <div style={IB}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    marginBottom: 14,
                    color: "#e2e8f0",
                  }}
                >
                  Target Weight Coverage
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {targetCoverageCards.map((c) => {
                    const pct = Math.min(c.total, 100);

                    return (
                      <div
                        key={c.label}
                        style={{
                          background: "#080e1c",
                          border: `1px solid ${c.color}40`,
                          borderRadius: 10,
                          padding: "12px 12px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: "#aebacd",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontWeight: 700,
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: c.color,
                              display: "inline-block",
                            }}
                          />
                          {c.label}
                        </div>

                        <div
                          style={{
                            fontSize: 20,
                            color: c.color,
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 800,
                            marginBottom: 6,
                          }}
                        >
                          {fmt(c.total, 0)}%
                        </div>

                        <div className="pbar" style={{ marginBottom: 8 }}>
                          <div
                            className="pfill"
                            style={{
                              width: `${pct}%`,
                              background: c.color,
                            }}
                          />
                        </div>

                        <div
                          style={{
                            color: "#4b607b",
                            fontSize: 10,
                            lineHeight: 1.45,
                          }}
                        >
                          {c.subtitle}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={IB}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    marginBottom: 14,
                    color: "#e2e8f0",
                  }}
                >
                  Phase Controls
                </div>

                {[
                  { key: "Build", label: "🏗️ Build" },
                  { key: "Accumulate", label: "📦 Accumulate" },
                  { key: "Income", label: "💰 Income" },
                ].map((p) => (
                  <div
                    key={p.key}
                    style={{
                      marginBottom: 10,
                      background: phase === p.key ? "#0c1a2e" : "#080e1c",
                      border: `1px solid ${
                        phase === p.key ? "#234980" : "#1a2540"
                      }`,
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: phase === p.key ? "#8ec5ff" : "#aebacd",
                        marginBottom: 8,
                      }}
                    >
                      {p.label}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {[
                        {
                          field: "dividendPct",
                          label: "Div %",
                          color: "#34d399",
                        },
                        {
                          field: "growthPct",
                          label: "Growth %",
                          color: "#60a5fa",
                        },
                      ].map((f) => (
                        <div key={f.field}>
                          <div
                            style={{
                              fontSize: 9,
                              color: "#64748b",
                              marginBottom: 3,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              fontWeight: 700,
                            }}
                          >
                            {f.label}
                          </div>
                          <input
                            value={phases[p.key][f.field]}
                            type="number"
                            onChange={(e) =>
                              setPhases((prev) => ({
                                ...prev,
                                [p.key]: {
                                  ...prev[p.key],
                                  [f.field]:
                                    num(e.target.value) || e.target.value,
                                },
                              }))
                            }
                            style={{
                              width: "100%",
                              background: "#0d1526",
                              border: `1px solid ${f.color}40`,
                              borderRadius: 8,
                              color: f.color,
                              fontSize: 13,
                              fontFamily: "'DM Mono', monospace",
                              padding: "6px 8px",
                              outline: "none",
                              fontWeight: 700,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                style={{
                  background: saved
                    ? "#06261a"
                    : "linear-gradient(135deg,#1d4ed8,#2563eb)",
                  border: `1px solid ${saved ? "#0d5a3d" : "#3b82f6"}`,
                  color: saved ? "#4ade80" : "#fff",
                  borderRadius: 12,
                  padding: "15px 18px",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: saved ? "none" : "0 10px 24px rgba(37,99,235,.22)",
                  width: "100%",
                }}
              >
                {saved ? "✓ Saved" : "Save"}
              </button>
            </div>
          </div>
        )}

        {tab === "progress" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "flex-start" : "center",
                  gap: 12,
                  flexDirection: isMobile ? "column" : "row",
                  marginBottom: 14,
                }}
              >
                <div>
                  <div style={{ ...ST, marginBottom: 4 }}>
                    Portfolio Progress
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45 }}
                  >
                    Goal progress stays meaningful even when broker P/L resets
                    after rebalancing.
                  </div>
                </div>
                <button
                  onClick={saveProgressTargets}
                  disabled={loading}
                  style={{
                    background: saved ? "#06261a" : "#0d1f3a",
                    border: `1px solid ${saved ? "#0d5a3d" : "#234980"}`,
                    color: saved ? "#4ade80" : "#8ec5ff",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 12,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 800,
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  {saved ? "✓ Saved" : "Save Targets"}
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
                  gap: 12,
                }}
              >
                {progressMetrics.map((m) => {
                  const pct =
                    m.target > 0
                      ? Math.min((m.current / m.target) * 100, 100)
                      : 0;
                  const keyMap = {
                    "Total Wealth": "totalWealth",
                    "Dividend Value": "dividendValue",
                    "Growth Value": "growthValue",
                  };
                  const targetKey = keyMap[m.label];
                  const isTotalWealth = m.label === "Total Wealth";

                  return (
                    <div
                      key={m.label}
                      style={{
                        background: "#080e1c",
                        border: `1px solid ${m.color}40`,
                        borderRadius: 12,
                        padding: "14px 14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#e2e8f0",
                          marginBottom: 8,
                        }}
                      >
                        {m.label}
                      </div>

                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 16,
                          color: m.color,
                          fontWeight: 800,
                          marginBottom: 8,
                        }}
                      >
                        ฿{fmtB(m.current)}
                      </div>

                      <div
                        style={{
                          fontSize: 10,
                          color: "#64748b",
                          marginBottom: 5,
                          fontWeight: 700,
                        }}
                      >
                        TARGET
                      </div>
                      <input
                        value={targets[targetKey]}
                        disabled={!isTotalWealth}
                        title={
                          isTotalWealth
                            ? "Edit total wealth target"
                            : "Auto-calculated from Portfolio Phase"
                        }
                        onChange={(e) => {
                          if (!isTotalWealth) return;
                          setTargets((prev) => ({
                            ...prev,
                            totalWealth: e.target.value,
                          }));
                        }}
                        style={{
                          width: "100%",
                          background: isTotalWealth ? "#0d1526" : "#0a1220",
                          border: isTotalWealth
                            ? "1px solid #1d2a3d"
                            : "1px solid #162235",
                          borderRadius: 8,
                          color: isTotalWealth ? m.color : "#7d8ea5",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 13,
                          padding: "8px 10px",
                          textAlign: "right",
                          outline: "none",
                          fontWeight: 800,
                          marginBottom: 6,
                          cursor: isTotalWealth ? "text" : "not-allowed",
                          opacity: 1,
                        }}
                      />

                      {!isTotalWealth && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            marginBottom: 10,
                            fontFamily: "'DM Mono', monospace",
                            textAlign: "right",
                          }}
                        >
                          Auto from Portfolio Phase
                        </div>
                      )}

                      <div
                        className="pbar"
                        style={{ height: 8, marginBottom: 8 }}
                      >
                        <div
                          className="pfill"
                          style={{
                            width: `${pct}%`,
                            background: m.color,
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        <span style={{ color: "#7d8ea5" }}>Progress</span>
                        <span style={{ color: m.color, fontWeight: 800 }}>
                          {fmt(pct, 2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={card} style={{ padding: isMobile ? 16 : 22 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "flex-start" : "center",
                  gap: 12,
                  flexDirection: isMobile ? "column" : "row",
                  marginBottom: 14,
                }}
              >
                <div>
                  <div style={{ ...ST, marginBottom: 4 }}>
                    Decision Quality
                  </div>
                  <div
                    style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45 }}
                  >
                    Average decision quality from Decision Log. This stays
                    readable even when you have hundreds of records.
                  </div>
                </div>
              </div>

              {decisionTrendData.length === 0 ? (
                <div
                  style={{
                    background: "#080e1c",
                    borderRadius: 12,
                    padding: "26px 20px",
                    textAlign: "center",
                    border: "1px dashed #1a2540",
                    color: "#5f728a",
                    fontSize: 13,
                  }}
                >
                  No decision log data yet
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "1fr"
                        : "repeat(4,1fr)",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    {[
                      {
                        label: "Avg Score",
                        value: fmt(averageDecisionScore, 2),
                        color: "#a78bfa",
                        sub: "Good = 3 / Neutral = 1 / Bad = 0",
                      },
                      {
                        label: "Avg Outcome",
                        value: `${averageOutcomePercent > 0 ? "+" : ""}${fmt(
                          averageOutcomePercent,
                          2
                        )}%`,
                        color:
                          averageOutcomePercent > 0
                            ? "#34d399"
                            : averageOutcomePercent < 0
                            ? "#f87171"
                            : "#f59e0b",
                        sub: "Average outcome after decision",
                      },
                      {
                        label: "Follow System Rate",
                        value: `${fmt(followSystemRate, 2)}%`,
                        color: "#60a5fa",
                        sub: `${followSystemCount} of ${decisionCount} decisions`,
                      },
                      {
                        label: "Decision Count",
                        value: decisionCount.toLocaleString(),
                        color: "#f59e0b",
                        sub: "Total logged decisions",
                      },
                    ].map((m) => (
                      <div
                        key={m.label}
                        style={{
                          background: "#080e1c",
                          border: "1px solid #1a2540",
                          borderRadius: 12,
                          padding: "12px 14px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: "#64748b",
                            marginBottom: 5,
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          {m.label}
                        </div>
                        <div
                          style={{
                            color: m.color,
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 800,
                            fontSize: 20,
                            marginBottom: 5,
                          }}
                        >
                          {m.value}
                        </div>
                        <div
                          style={{
                            color: "#4b607b",
                            fontSize: 10,
                            lineHeight: 1.45,
                          }}
                        >
                          {m.sub}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        background: "#080e1c",
                        border: "1px solid #1a2540",
                        borderRadius: 12,
                        padding: "16px 14px",
                      }}
                    >
                      <div style={ST}>Behavior Radar — Avg Score</div>
                      <ResponsiveContainer
                        width="100%"
                        height={isMobile ? 240 : 270}
                      >
                        <RadarChart data={decisionRadarData}>
                          <PolarGrid stroke="#1a2540" />
                          <PolarAngleAxis
                            dataKey="reason"
                            tick={{ fill: "#7d8ea5", fontSize: 10 }}
                          />
                          <YAxis domain={[0, 3]} hide />
                          <Radar
                            name="Full Score"
                            dataKey="fullScore"
                            stroke="#334155"
                            fill="#334155"
                            fillOpacity={0.08}
                            strokeOpacity={0.35}
                            strokeWidth={1}
                          />
                          <Radar
                            name="Avg Score"
                            dataKey="avgScore"
                            stroke="#a78bfa"
                            fill="#a78bfa"
                            fillOpacity={0.28}
                            strokeWidth={2}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              background: "#0d1526",
                              border: "1px solid #1a2540",
                              borderRadius: 8,
                            }}
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: 11,
                              color: "#7d8ea5",
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div
                      style={{
                        background: "#080e1c",
                        border: "1px solid #1a2540",
                        borderRadius: 12,
                        padding: "16px 14px",
                      }}
                    >
                      <div style={ST}>Decision Status</div>
                      <ResponsiveContainer
                        width="100%"
                        height={isMobile ? 220 : 250}
                      >
                        <PieChart>
                          <Pie
                            data={decisionStatusData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={isMobile ? 34 : 46}
                            outerRadius={isMobile ? 68 : 82}
                            paddingAngle={4}
                          >
                            {decisionStatusData.map((d, i) => (
                              <Cell
                                key={i}
                                fill={
                                  String(d.rawStatus || "").includes("Good")
                                    ? "#34d399"
                                    : String(d.rawStatus || "").includes("Bad")
                                    ? "#f87171"
                                    : "#f59e0b"
                                }
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{
                              background: "#0d1526",
                              border: "1px solid #1a2540",
                              borderRadius: 8,
                            }}
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: 11,
                              color: "#7d8ea5",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                  </div>
                </>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr",
                gap: 14,
              }}
            >
              <div className={card} style={{ padding: "20px 16px" }}>
                <div style={ST}>Current vs Target</div>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 220}>
                  <BarChart data={barData} barGap={4} barCategoryGap="30%">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1a2540"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#7d8ea5", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#7d8ea5", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `฿${fmtB(v)}`}
                      width={55}
                    />
                    <RechartsTooltip content={<CTip />} />
                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        color: "#7d8ea5",
                        paddingTop: 8,
                      }}
                    />
                    <Bar dataKey="current" name="Current" radius={[4, 4, 0, 0]}>
                      {barData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="target"
                      name="Target"
                      fill="#1a2540"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={card} style={{ padding: "20px 16px" }}>
                <div style={ST}>Portfolio Radar</div>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1a2540" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: "#7d8ea5", fontSize: 10 }}
                    />
                    <Radar
                      name="Target"
                      dataKey="target"
                      stroke="#94a3b8"
                      fill="#94a3b8"
                      fillOpacity={0.08}
                      strokeOpacity={0.35}
                      strokeWidth={1.5}
                    />
                    <Radar
                      name="Current"
                      dataKey="actual"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: "#0d1526",
                        border: "1px solid #1a2540",
                        borderRadius: 8,
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default App;
