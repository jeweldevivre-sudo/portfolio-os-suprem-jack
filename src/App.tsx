// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

const SCRIPT_URL =
  (process as any).env?.REACT_APP_PREMIUM_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbwKj1kNhxks8ry1ufNQYYpesxd_GGo6aW7btDRa9C50Tu5W4l7gw4j9Mm4HhcAL6x485A/exec";

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
};

const PHASES = ["Build", "Accumulate", "Income"];
const SOURCES = ["All", "Dividend", "Growth"];
const ORDER_TABS = ["All", "BUY", "SELL"];

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
  const [settings, setSettings] = useState({
    portfolioName: "",
    phase: "Build",
    lineAvailable: "",
    maxBudget: "",
    totalWealth: "",
  });

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
      setLastSync(new Date().toLocaleString("th-TH"));
      setSettings({
        portfolioName: next.summary?.portfolioName || "",
        phase: next.summary?.phase || next.summary?.portfolioPhase || "Build",
        lineAvailable: String(next.summary?.lineAvailable ?? ""),
        maxBudget: String(next.summary?.maxBudget ?? ""),
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
          glPct: costValue > 0 ? (gl / costValue) * 100 : pct(h.glPct ?? h.unrealizedPLPercent),
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

  const filteredStocks = stockList.filter((stock: any) => {
    const text = `${stock.assetCode || stock.symbol} ${stock.source} ${stock.sector} ${stock.leaderFlag} ${stock.universeNote} ${stock.manualStatus}`.toLowerCase();
    const matchesQuery = !stockQuery || text.includes(stockQuery.toLowerCase());
    const matchesSource = stockSource === "All" || normalizeType(stock.source) === stockSource;
    const statusText = String(stock.manualStatus || stock.universeNote || "").toUpperCase();
    const matchesStatus = stockStatus === "All" || statusText.includes(stockStatus.toUpperCase());
    return matchesQuery && matchesSource && matchesStatus;
  });

  const filteredOrders = orders.filter((order: any) => orderFilter === "All" || order.actionType === orderFilter);

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
          maxBudget: n(settings.maxBudget),
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

  const logOrder = async (order: any) => {
    try {
      setSaving(true);
      setError("");
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "logDecision",
          source: "SYSTEM",
          actionType: order.actionType,
          assetCode: order.assetCode || order.symbol,
          suggestedUnits: order.units,
          actualUnits: order.units,
          actualPrice: order.price || order.marketPrice,
          marketPrice: order.price || order.marketPrice,
          note: "Follow System",
        }),
      });
      const result = await res.json();
      if (!result.success && result.status !== "success") throw new Error(result.message || "Log failed");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Log failed");
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
            ["orders", "Orders"],
            ["stockList", "Stock List"],
            ["settings", "Settings"],
            ["progress", "Progress"],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button className="sync" onClick={loadData} disabled={loading}>
          {loading ? "SYNCING" : "SYNC"}
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
              <Metric title="LINE AVAILABLE" value={baht(cash)} sub={`Budget ${baht(summary.maxBudget || cash)}`} color="amber" />
            </div>

            <div className="grid two">
              <Panel title="Allocation Monitor">
                <Allocation label="Dividend" value={dividendWeight} target={targetDividend} color="#20d6a2" />
                <Allocation label="Growth" value={growthWeight} target={targetGrowth} color="#5aa2ff" />
              </Panel>
              <Panel title="P/L By Position">
                <div className="bars">
                  {holdings.slice(0, 10).map((h) => (
                    <div className="barrow" key={h.symbol}>
                      <span>{h.symbol}</span>
                      <div className="track"><i style={{ width: `${Math.min(Math.abs(h.glPct), 40) * 2.5}%`, background: h.gl >= 0 ? "#20d6a2" : "#ff4d6d" }} /></div>
                      <b className={h.gl >= 0 ? "good" : "bad"}>{h.glPct >= 0 ? "+" : ""}{percent(h.glPct)}</b>
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
                  <span className={h.glPct >= 0 ? "good" : "bad"}>{h.glPct >= 0 ? "+" : ""}{percent(h.glPct)}</span>,
                ])}
              />
            </Panel>
          </>
        )}

        {tab === "orders" && (
          <Panel title="Execution Blotter">
            <div className="toolbar">
              {ORDER_TABS.map((item) => (
                <button key={item} className={orderFilter === item ? "chip active" : "chip"} onClick={() => setOrderFilter(item)}>{item}</button>
              ))}
            </div>
            <Table
              columns={["SIDE", "SYMBOL", "SOURCE", "PRIORITY", "UNITS", "VALUE", "PRICE", "GAP", "EXECUTE", "LOG"]}
              rows={filteredOrders.map((o: any) => [
                <span className={o.actionType === "BUY" ? "good" : "bad"}>{o.actionType}</span>,
                o.symbol || o.assetCode,
                <Badge value={o.source || o.type} />,
                o.priority || "-",
                fmt(o.units, 0),
                baht(o.suggestedValue || o.cash || o.sellValue),
                baht(o.price || o.marketPrice),
                percent(o.gapWeight),
                o.execute || "-",
                <button className="mini" disabled={saving} onClick={() => logOrder(o)}>Done</button>,
              ])}
            />
          </Panel>
        )}

        {tab === "stockList" && (
          <Panel title={`Stock List - ${filteredStocks.length}/${stockList.length}`}>
            <div className="toolbar">
              <input value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} placeholder="Search symbol, sector, note" />
              <select value={stockSource} onChange={(e) => setStockSource(e.target.value)}>
                {SOURCES.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>
                {["All", "OK", "FADE IN", "FADE OUT"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <Table
              columns={["SYMBOL", "SOURCE", "SECTOR", "LEADER", "UNIVERSE NOTE", "STATUS", "TARGET WT"]}
              rows={filteredStocks.map((s: any) => [
                <b>{s.symbol || s.assetCode}</b>,
                <Badge value={s.source || s.type} />,
                s.sector || "-",
                <span className={clsFor(s.leaderFlag)}>{s.leaderFlag || "-"}</span>,
                s.universeNote || "-",
                <span className={clsFor(s.manualStatus)}>{s.manualStatus || "-"}</span>,
                percent(s.targetWeight),
              ])}
            />
          </Panel>
        )}

        {tab === "settings" && (
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
              <Field label="Max Budget" value={settings.maxBudget} onChange={(v) => setSettings({ ...settings, maxBudget: v })} />
              <Field label="Total Wealth Target" value={settings.totalWealth} onChange={(v) => setSettings({ ...settings, totalWealth: v })} />
            </div>
            <div className="actions">
              <button className="primary" disabled={saving} onClick={saveSettings}>{saving ? "Saving..." : "Save Settings"}</button>
            </div>
          </Panel>
        )}

        {tab === "progress" && (
          <div className="cards four">
            <Metric title="TOTAL DECISIONS" value={fmt(data.progress?.TotalDecisions, 0)} sub="Decision log volume" color="blue" />
            <Metric title="FOLLOW SYSTEM" value={fmt(data.progress?.FollowSystemCount, 0)} sub="System discipline count" color="green" />
            <Metric title="OVERRIDES" value={fmt(data.progress?.OverrideCount, 0)} sub="Manual override count" color="amber" />
            <Metric title="AVG OUTCOME" value={percent(data.progress?.AverageOutcome)} sub={`Behavior score ${fmt(data.progress?.BehaviorScore)}`} color="violet" />
          </div>
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

function Panel({ title, children }: any) {
  return (
    <section className="panel">
      <div className="panel-title">{title}</div>
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

function Badge({ value }: any) {
  const type = normalizeType(value);
  return <span className={`badge ${type.toLowerCase()}`}>{type}</span>;
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
*{box-sizing:border-box}body{margin:0;background:#03070d;color:#e8f1ff;font-family:Inter,Segoe UI,Arial,sans-serif}.terminal-app{min-height:100vh;background:radial-gradient(circle at top left,#10284a 0,#06101d 32%,#02060b 100%)}.topbar{height:88px;display:flex;align-items:center;gap:16px;padding:0 34px;border-bottom:1px solid #15253b;background:#07111f}.brand-mark{width:50px;height:50px;border-radius:8px;background:linear-gradient(135deg,#2b83ff,#20d6a2);display:grid;place-items:center;font-weight:900;color:#fff;box-shadow:0 0 28px rgba(43,131,255,.25)}.brand{min-width:210px}.brand-title{font-size:22px;font-weight:900;letter-spacing:-.02em}.brand-sub{font-family:Consolas,monospace;color:#6d8db8;font-size:12px;margin-top:4px}.tabs{flex:1;display:flex;justify-content:center;gap:8px}.tab,.sync,.chip,.mini,.primary{border:1px solid #1b3353;background:#09182a;color:#96b1d4;border-radius:6px;padding:10px 14px;font-weight:800;cursor:pointer}.tab.active,.chip.active,.primary{background:#163c6e;color:#fff;border-color:#2b83ff}.sync{margin-left:auto}.shell{padding:30px 34px 70px;display:flex;flex-direction:column;gap:20px}.alert{padding:14px 18px;border:1px solid #7f1d1d;background:#2a0d12;color:#ffb4b4;border-radius:6px;font-weight:800}.market-strip{display:flex;align-items:center;gap:22px;border:1px solid #2f4058;background:#081423;border-radius:6px;padding:14px 18px;color:#94afd3;font-family:Consolas,monospace}.market-strip b{color:#fff}.dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:10px;box-shadow:0 0 15px currentColor}.red{color:#ff4d6d}.green,.good{color:#20d6a2}.bad{color:#ff4d6d}.amber{color:#ffb020}.gold{color:#ffd166}.muted{color:#8095b5}.blue{color:#5aa2ff}.violet{color:#a78bfa}.cards{display:grid;gap:16px}.cards.six{grid-template-columns:repeat(6,minmax(0,1fr))}.cards.four{grid-template-columns:repeat(4,minmax(0,1fr))}.metric{min-height:150px;border:1px solid #173151;background:linear-gradient(180deg,#091827,#06101c);border-radius:8px;padding:20px 24px;border-top:2px solid currentColor}.metric-title{font-size:13px;letter-spacing:.16em;font-weight:900;color:#d9e8ff}.metric-value{font-family:Consolas,monospace;font-size:25px;line-height:1.2;margin:16px 0 8px;font-weight:900}.metric-sub{font-size:14px;color:#88a6cc;line-height:1.45}.grid{display:grid;gap:20px}.grid.two{grid-template-columns:1fr 1fr}.panel{border:1px solid #173151;background:#06101c;border-radius:8px;overflow:hidden}.panel-title{padding:18px 26px;border-bottom:1px solid #142840;font-size:13px;letter-spacing:.18em;text-transform:uppercase;font-weight:900;color:#bed4f5}.allocation{padding:18px 26px}.row{display:flex;justify-content:space-between;align-items:center;gap:14px;font-weight:800}.row i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:10px}.row.small{font-size:12px;color:#7894ba;margin-top:7px}.allocation-track{height:8px;background:#152740;border-radius:999px;margin:10px 0;position:relative}.allocation-track div{height:100%;border-radius:999px}.allocation-track em{position:absolute;top:-4px;width:2px;height:16px;background:#fff;opacity:.8}.bars{padding:18px 26px;display:flex;flex-direction:column;gap:13px}.barrow{display:grid;grid-template-columns:70px 1fr 80px;gap:12px;align-items:center;font-family:Consolas,monospace}.track{height:8px;background:#14243a;border-radius:999px;overflow:hidden}.track i{display:block;height:100%;border-radius:999px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:840px}th,td{padding:13px 18px;border-bottom:1px solid #12243a;text-align:left;white-space:nowrap}th{font-size:12px;letter-spacing:.14em;color:#d9e8ff;background:#050c16;position:sticky;top:0}td{font-family:Consolas,monospace;color:#d8e6fa;font-size:13px}tr:hover td{background:#091827}.badge{display:inline-flex;align-items:center;justify-content:center;min-width:74px;border-radius:999px;padding:4px 9px;font-family:Inter,Arial,sans-serif;font-size:11px;font-weight:900}.badge.dividend{background:#063b2c;color:#20d6a2}.badge.growth{background:#0b2a55;color:#5aa2ff}.badge.other{background:#263247;color:#aebdd4}.toolbar{display:flex;gap:10px;padding:16px 18px;border-bottom:1px solid #13263d;align-items:center;flex-wrap:wrap}.toolbar input,.toolbar select,.field input,.field select{height:40px;border:1px solid #1c385a;background:#071321;color:#e8f1ff;border-radius:6px;padding:0 12px;outline:none}.toolbar input{min-width:280px}.mini{padding:7px 10px;font-size:12px}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:22px}.field{display:flex;flex-direction:column;gap:8px}.field span{font-size:12px;letter-spacing:.14em;color:#8ea8cc;text-transform:uppercase;font-weight:900}.actions{padding:0 22px 22px}.primary{min-width:150px}.empty{padding:28px;color:#637d9e;text-align:center;font-family:Inter,Arial,sans-serif}
@media(max-width:1200px){.cards.six{grid-template-columns:repeat(3,1fr)}.grid.two{grid-template-columns:1fr}.tabs{justify-content:flex-start;overflow:auto}.topbar{padding:0 18px}.brand{min-width:auto}}@media(max-width:760px){.topbar{height:auto;align-items:flex-start;flex-direction:column;padding:18px}.tabs{width:100%;justify-content:flex-start}.shell{padding:18px}.cards.six,.cards.four,.form-grid{grid-template-columns:1fr}.market-strip{align-items:flex-start;flex-direction:column}.toolbar input{min-width:100%;width:100%}}
`;

export default App;
