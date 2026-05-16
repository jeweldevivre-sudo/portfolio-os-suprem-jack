// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyDsuHcsmeQEfse_3uQPqWHOOO0pKbr8wL4nGfaJnJUrcuzs1HqFGXliC_5mbPQ4poXJQ/exec";

const COLORS = ["#f6b100", "#2f80ed", "#27ae60", "#eb5757", "#9b51e0", "#56ccf2"];

const fmt = (value: any, digits = 2) => {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const fmt0 = (value: any) => fmt(value, 0);
const pct = (value: any, digits = 2) => {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || Number.isNaN(n)) return "—";
  return `${fmt(n * (Math.abs(n) <= 1 ? 100 : 1), digits)}%`;
};

const money = (value: any, digits = 0) => {
  const n = Number(value);
  if (value === "" || value === null || value === undefined || Number.isNaN(n)) return "—";
  return `฿${fmt(n, digits)}`;
};

const cleanText = (v: any, fallback = "—") => {
  const t = String(v ?? "").trim();
  return t || fallback;
};

const toNum = (v: any) => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[,%฿,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const apiData = (raw: any) => raw?.data || raw || {};

const normalizePhase = (v: any) => {
  const t = String(v ?? "").trim().toUpperCase();
  if (["BUILD", "BALANCE", "INCOME"].includes(t)) return t;
  if (t.includes("ACC")) return "BALANCE";
  if (t.includes("LOCK")) return "INCOME";
  return "BUILD";
};

const phaseLabel = (v: any) => {
  const p = normalizePhase(v);
  if (p === "BUILD") return "Build";
  if (p === "BALANCE") return "Balance";
  return "Income";
};

const getAsset = (row: any) => cleanText(row?.assetCode || row?.symbol, "");
const getAction = (row: any) => String(row?.actionType || row?.action || "").toUpperCase();
const getSource = (row: any) => cleanText(row?.source || row?.type, "");
const getPrice = (row: any) => toNum(row?.marketPrice ?? row?.price ?? row?.suggestedPrice);
const getUnits = (row: any) => toNum(row?.suggestedUnits ?? row?.units ?? row?.buyUnits ?? row?.sellUnits);
const getValue = (row: any) => toNum(row?.suggestedValue ?? row?.suggestedBuy ?? row?.suggestedSell ?? row?.actualBuyValue ?? row?.actualSellValue);

const emptyHolding = { assetCode: "", units: "", avgCost: "" };

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [raw, setRaw] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [portfolioName, setPortfolioName] = useState("");
  const [lineAvailable, setLineAvailable] = useState("");
  const [phase, setPhase] = useState("BUILD");
  const [holdings, setHoldings] = useState<any[]>([]);
  const [stockDrafts, setStockDrafts] = useState<Record<string, any>>({});
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, any>>({});

  const data = useMemo(() => apiData(raw), [raw]);
  const system = data.system || data.summary || {};
  const dashboard = Array.isArray(data.dashboard) ? data.dashboard : [];
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const portfolio = Array.isArray(data.portfolio || data.holdings) ? data.portfolio || data.holdings : [];
  const stockList = Array.isArray(data.stockList) ? data.stockList : [];
  const progress = data.progress || data.decisionAnalytics || {};
  const targets = data.targets || {};
  const buyOrders = Array.isArray(data.buyOrders) ? data.buyOrders : orders.filter((x) => getAction(x) === "BUY");
  const sellOrders = Array.isArray(data.sellOrders) ? data.sellOrders : orders.filter((x) => getAction(x) === "SELL");

  const post = async (payload: any) => {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Save failed");
    return json;
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Load failed");
      const d = apiData(json);
      setRaw(json);
      setPortfolioName(d.system?.portfolioName || d.summary?.portfolioName || "");
      setLineAvailable(String(d.system?.lineAvailable ?? d.summary?.lineAvailable ?? ""));
      setPhase(normalizePhase(d.system?.selectedPhase || d.phaseControl?.portfolioPhase));
      const pf = Array.isArray(d.portfolio || d.holdings) ? d.portfolio || d.holdings : [];
      setHoldings(pf.map((h: any) => ({
        assetCode: getAsset(h),
        units: h.units ?? "",
        avgCost: h.avgCost ?? h.averageCost ?? "",
      })));
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2400);
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await post({
        action: "saveSettings",
        selectedPhase: phase,
        portfolioPhase: phase,
        lineAvailable: toNum(lineAvailable),
        portfolioName,
      });
      await load();
      showToast("Settings saved");
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const savePortfolio = async () => {
    try {
      setSaving(true);
      await post({
        action: "savePortfolio",
        portfolio: holdings
          .filter((h) => cleanText(h.assetCode, ""))
          .map((h) => ({
            assetCode: String(h.assetCode).trim().toUpperCase(),
            units: toNum(h.units),
            avgCost: toNum(h.avgCost),
          })),
      });
      await load();
      showToast("Portfolio saved");
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteHolding = async (assetCode: string, index: number) => {
    const next = holdings.filter((_, i) => i !== index);
    setHoldings(next);
    if (!assetCode) return;
    try {
      setSaving(true);
      await post({ action: "deletePortfolio", assetCode });
      await load();
      showToast(`${assetCode} deleted`);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveStockStatus = async (row: any) => {
    const assetCode = getAsset(row);
    const draft = stockDrafts[assetCode] || {};
    try {
      setSaving(true);
      await post({
        action: "saveStockStatus",
        assetCode,
        manualStatus: draft.manualStatus ?? row.manualStatus ?? row.status ?? "",
        targetWeight: toNum(draft.targetWeight ?? row.targetWeight ?? row.targetWeightPct),
      });
      await load();
      showToast(`${assetCode} updated`);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const logDecision = async (row: any) => {
    const assetCode = getAsset(row);
    const actionType = getAction(row);
    const draft = decisionDrafts[`${actionType}-${assetCode}`] || {};
    const actualUnits = toNum(draft.actualUnits || getUnits(row));
    const actualPrice = toNum(draft.actualPrice || getPrice(row));
    try {
      setSaving(true);
      await post({
        action: "logDecision",
        source: "SYSTEM",
        actionType,
        assetCode,
        suggestedUnits: getUnits(row),
        actualUnits,
        actualPrice,
        marketPrice: getPrice(row),
        price: getPrice(row),
        note: draft.note || "Follow System",
      });
      await load();
      showToast(`${actionType} ${assetCode} logged`);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const cards = dashboard.length ? dashboard : [
    { metric: "Portfolio Value", value: system.portfolioValue || system.totalValue || 0, note: "Current portfolio" },
    { metric: "Line Available", value: system.lineAvailable || 0, note: "Buying power" },
    { metric: "Target Goal", value: system.targetGoal || targets.totalWealth || 0, note: "Total goal" },
  ];

  const allocationData = portfolio
    .filter((h: any) => getAsset(h))
    .map((h: any) => ({
      name: getAsset(h),
      value: toNum(h.currentValue ?? h.marketValue ?? h.value ?? h.totalValue),
      weight: toNum(h.currentWeight ?? h.weight ?? h.actualWeight),
      type: getSource(h),
    }))
    .filter((x) => x.value || x.weight);

  const dashboardBars = cards.map((c: any) => ({
    name: cleanText(c.metric || c.title || c.label, "Metric"),
    value: toNum(c.value ?? c.amount),
  })).filter((x) => x.value);

  const progressData = Object.keys(progress || {}).map((k) => ({
    name: k,
    value: toNum(progress[k]),
  })).filter((x) => x.value !== 0);

  const renderOrderCard = (row: any) => {
    const asset = getAsset(row);
    const action = getAction(row);
    const key = `${action}-${asset}`;
    const draft = decisionDrafts[key] || {};
    const isSell = action === "SELL";
    const value = getValue(row);
    return (
      <div className={`orderCard ${isSell ? "sell" : "buy"}`} key={key}>
        <div className="orderTop">
          <div>
            <div className="ticker">{asset}</div>
            <div className="subline">{getSource(row)} · {cleanText(row.reason || row.note, "System suggestion")}</div>
          </div>
          <span className={`pill ${isSell ? "danger" : "success"}`}>{action}</span>
        </div>

        <div className="miniGrid">
          <Metric label="Suggested Units" value={fmt0(getUnits(row))} />
          <Metric label="Market Price" value={money(getPrice(row), 2)} />
          <Metric label="Suggested Value" value={money(value, 0)} />
          <Metric label="Priority" value={cleanText(row.priority || row.rank || row.score, "—")} />
        </div>

        <div className="executeBox">
          <Input
            label="Actual Units"
            value={draft.actualUnits ?? getUnits(row)}
            onChange={(v) => setDecisionDrafts((p) => ({ ...p, [key]: { ...p[key], actualUnits: v } }))}
          />
          <Input
            label="Actual Price"
            value={draft.actualPrice ?? getPrice(row)}
            onChange={(v) => setDecisionDrafts((p) => ({ ...p, [key]: { ...p[key], actualPrice: v } }))}
          />
          <label className="field">
            <span>Decision Note</span>
            <select
              value={draft.note || "Follow System"}
              onChange={(e) => setDecisionDrafts((p) => ({ ...p, [key]: { ...p[key], note: e.target.value } }))}
            >
              <option>Follow System</option>
              <option>Partial Execute</option>
              <option>Skip</option>
              <option>Manual Override</option>
            </select>
          </label>
          <button className="terminalBtn primary" onClick={() => logDecision(row)} disabled={saving}>
            EXECUTE
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="terminal">
      <style>{STYLES}</style>

      <header className="topbar">
        <div>
          <div className="brand">PORTFOLIO OS</div>
          <div className="headline">{cleanText(portfolioName || system.portfolioName, "Human-Guided Portfolio Management")}</div>
        </div>
        <div className="statusStrip">
          <span className="liveDot" /> LIVE
          <span>{phaseLabel(phase)}</span>
          <button className="ghostBtn" onClick={load} disabled={loading || saving}>REFRESH</button>
        </div>
      </header>

      <nav className="tabs">
        {[
          ["dashboard", "Dashboard"],
          ["orders", "Orders"],
          ["portfolio", "Portfolio"],
          ["stock", "Stock List"],
          ["progress", "Progress"],
          ["settings", "Settings"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} className={activeTab === id ? "active" : ""}>{label}</button>
        ))}
      </nav>

      {error && <div className="alert">{error}</div>}
      {toast && <div className="toast">{toast}</div>}
      {loading ? (
        <div className="loading">Loading Portfolio OS...</div>
      ) : (
        <main>
          {activeTab === "dashboard" && (
            <section className="grid">
              <div className="panel wide">
                <PanelTitle title="Market Command Center" tag="SYSTEM" />
                <div className="cardGrid">
                  {cards.map((c: any, i: number) => (
                    <div className="statCard" key={i}>
                      <div className="statLabel">{cleanText(c.metric || c.title || c.label, "Metric")}</div>
                      <div className="statValue">{money(c.value ?? c.amount, 0)}</div>
                      <div className="statNote">{cleanText(c.note || c.status || c.description, "")}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <PanelTitle title="Allocation" tag="WEIGHT" />
                <div className="chartBox">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={allocationData} dataKey={allocationData.some(x => x.value) ? "value" : "weight"} nameKey="name" outerRadius={92} innerRadius={48}>
                        {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="panel">
                <PanelTitle title="Key Numbers" tag="API OUTPUT" />
                <div className="chartBox">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dashboardBars}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1d2a3d" />
                      <XAxis dataKey="name" tick={{ fill: "#8795aa", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#8795aa", fontSize: 10 }} />
                      <RechartsTooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="#f6b100" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}

          {activeTab === "orders" && (
            <section className="panel wide">
              <PanelTitle title="Action Center" tag={`${buyOrders.length} BUY / ${sellOrders.length} SELL`} />
              <div className="split">
                <div>
                  <h3 className="sectionLabel">BUY ORDERS</h3>
                  {buyOrders.length ? buyOrders.map(renderOrderCard) : <Empty text="No buy orders from API OUTPUT" />}
                </div>
                <div>
                  <h3 className="sectionLabel">SELL ALERTS</h3>
                  {sellOrders.length ? sellOrders.map(renderOrderCard) : <Empty text="No sell alerts from API OUTPUT" />}
                </div>
              </div>
            </section>
          )}

          {activeTab === "portfolio" && (
            <section className="panel wide">
              <PanelTitle title="Master Portfolio" tag="Editable" />
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asset Code</th>
                      <th>Units</th>
                      <th>Avg Cost</th>
                      <th>Current Value</th>
                      <th>Weight</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h, i) => {
                      const live = portfolio.find((p: any) => getAsset(p) === h.assetCode) || {};
                      return (
                        <tr key={i}>
                          <td><input value={h.assetCode} onChange={(e) => setHoldings((p) => p.map((x, idx) => idx === i ? { ...x, assetCode: e.target.value.toUpperCase() } : x))} /></td>
                          <td><input value={h.units} onChange={(e) => setHoldings((p) => p.map((x, idx) => idx === i ? { ...x, units: e.target.value } : x))} /></td>
                          <td><input value={h.avgCost} onChange={(e) => setHoldings((p) => p.map((x, idx) => idx === i ? { ...x, avgCost: e.target.value } : x))} /></td>
                          <td>{money(live.currentValue ?? live.marketValue ?? live.value, 0)}</td>
                          <td>{pct(live.currentWeight ?? live.weight ?? live.actualWeight, 2)}</td>
                          <td><button className="ghostBtn dangerText" onClick={() => deleteHolding(h.assetCode, i)}>DELETE</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="buttonRow">
                <button className="terminalBtn" onClick={() => setHoldings((p) => [...p, { ...emptyHolding }])}>ADD ROW</button>
                <button className="terminalBtn primary" onClick={savePortfolio} disabled={saving}>SAVE PORTFOLIO</button>
              </div>
            </section>
          )}

          {activeTab === "stock" && (
            <section className="panel wide">
              <PanelTitle title="Stock List Control" tag="Fade In / Fade Out" />
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Target Weight</th>
                      <th>Reason / Note</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockList.map((s: any) => {
                      const asset = getAsset(s);
                      const draft = stockDrafts[asset] || {};
                      return (
                        <tr key={asset}>
                          <td className="tickerCell">{asset}</td>
                          <td>{getSource(s)}</td>
                          <td>
                            <select
                              value={draft.manualStatus ?? s.manualStatus ?? s.status ?? ""}
                              onChange={(e) => setStockDrafts((p) => ({ ...p, [asset]: { ...p[asset], manualStatus: e.target.value } }))}
                            >
                              <option value="">Auto</option>
                              <option value="FADE IN">FADE IN</option>
                              <option value="HOLD">HOLD</option>
                              <option value="FADE OUT">FADE OUT</option>
                              <option value="EXIT">EXIT</option>
                            </select>
                          </td>
                          <td>
                            <input
                              value={draft.targetWeight ?? s.targetWeight ?? s.targetWeightPct ?? ""}
                              onChange={(e) => setStockDrafts((p) => ({ ...p, [asset]: { ...p[asset], targetWeight: e.target.value } }))}
                            />
                          </td>
                          <td>{cleanText(s.reason || s.note || s.actionNote, "")}</td>
                          <td><button className="terminalBtn" onClick={() => saveStockStatus(s)} disabled={saving}>SAVE</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === "progress" && (
            <section className="grid">
              <div className="panel wide">
                <PanelTitle title="Decision Analytics" tag="PROGRESS" />
                <div className="cardGrid">
                  {Object.keys(progress).length ? Object.entries(progress).map(([k, v]) => (
                    <div className="statCard" key={k}>
                      <div className="statLabel">{k}</div>
                      <div className="statValue">{fmt(v, 2)}</div>
                    </div>
                  )) : <Empty text="No progress data from API OUTPUT" />}
                </div>
              </div>
              <div className="panel">
                <PanelTitle title="Progress Trend" tag="LOG" />
                <div className="chartBox">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1d2a3d" />
                      <XAxis dataKey="name" tick={{ fill: "#8795aa", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#8795aa", fontSize: 10 }} />
                      <RechartsTooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="value" stroke="#f6b100" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="panel">
                <PanelTitle title="Behavior Radar" tag="MIRROR" />
                <div className="chartBox">
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={progressData.slice(0, 8)}>
                      <PolarGrid stroke="#1d2a3d" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: "#8795aa", fontSize: 10 }} />
                      <Radar dataKey="value" stroke="#f6b100" fill="#f6b100" fillOpacity={0.25} />
                      <RechartsTooltip contentStyle={tooltipStyle} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}

          {activeTab === "settings" && (
            <section className="panel wide">
              <PanelTitle title="System Settings" tag="Google Sheets Sync" />
              <div className="settingsGrid">
                <Input label="Portfolio Name" value={portfolioName} onChange={setPortfolioName} />
                <Input label="Line Available" value={lineAvailable} onChange={setLineAvailable} />
                <label className="field">
                  <span>Portfolio Phase</span>
                  <select value={phase} onChange={(e) => setPhase(e.target.value)}>
                    <option value="BUILD">BUILD</option>
                    <option value="BALANCE">BALANCE</option>
                    <option value="INCOME">INCOME</option>
                  </select>
                </label>
              </div>

              <div className="phaseCards">
                <div className={phase === "BUILD" ? "phaseCard active" : "phaseCard"} onClick={() => setPhase("BUILD")}>
                  <b>BUILD</b><span>Dividend 40% · Growth 60%</span>
                </div>
                <div className={phase === "BALANCE" ? "phaseCard active" : "phaseCard"} onClick={() => setPhase("BALANCE")}>
                  <b>BALANCE</b><span>Dividend 50% · Growth 50%</span>
                </div>
                <div className={phase === "INCOME" ? "phaseCard active" : "phaseCard"} onClick={() => setPhase("INCOME")}>
                  <b>INCOME</b><span>Dividend 70% · Growth 30%</span>
                </div>
              </div>

              <div className="buttonRow">
                <button className="terminalBtn primary" onClick={saveSettings} disabled={saving}>SAVE SETTINGS</button>
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

function PanelTitle({ title, tag }: any) {
  return (
    <div className="panelTitle">
      <h2>{title}</h2>
      <span>{tag}</span>
    </div>
  );
}

function Metric({ label, value }: any) {
  return (
    <div className="metric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Input({ label, value, onChange }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Empty({ text }: any) {
  return <div className="empty">{text}</div>;
}

const tooltipStyle = {
  background: "#0a0f18",
  border: "1px solid #26364f",
  borderRadius: 8,
  color: "#e7edf7",
};

const STYLES = `
*{box-sizing:border-box}
body{margin:0;background:#05080d;color:#d7e0ea;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.terminal{min-height:100vh;background:radial-gradient(circle at top left,#122033 0,#05080d 42%,#020409 100%);padding:18px}
.topbar{display:flex;justify-content:space-between;align-items:center;border:1px solid #1b2940;background:linear-gradient(180deg,#101927,#070b12);padding:16px 18px;border-radius:14px;box-shadow:0 0 30px rgba(0,0,0,.35)}
.brand{font-weight:900;letter-spacing:.18em;color:#f6b100;font-size:14px}
.headline{font-size:24px;font-weight:800;margin-top:4px;color:#f3f6fb}
.statusStrip{display:flex;gap:14px;align-items:center;color:#93a4b8;font-size:12px;text-transform:uppercase}
.liveDot{width:9px;height:9px;background:#27ae60;border-radius:50%;box-shadow:0 0 12px #27ae60}
.tabs{display:flex;gap:8px;margin:14px 0;overflow:auto}
.tabs button{background:#0c1421;border:1px solid #1b2940;color:#8ea0b8;padding:10px 14px;border-radius:10px;font-weight:800;cursor:pointer;white-space:nowrap}
.tabs button.active{background:#f6b100;color:#080b10;border-color:#f6b100}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.panel{background:rgba(8,13,22,.92);border:1px solid #1b2940;border-radius:14px;padding:16px;box-shadow:0 20px 40px rgba(0,0,0,.25)}
.panel.wide{grid-column:1/-1}
.panelTitle{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid #162237;padding-bottom:10px}
.panelTitle h2{font-size:16px;margin:0;color:#f3f6fb;letter-spacing:.03em}
.panelTitle span{font-size:11px;color:#f6b100;border:1px solid #594719;background:#171206;padding:5px 8px;border-radius:999px;font-weight:900}
.cardGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.statCard{background:#0b121e;border:1px solid #1b2940;border-left:3px solid #f6b100;border-radius:12px;padding:14px}
.statLabel{font-size:11px;color:#8ea0b8;text-transform:uppercase;letter-spacing:.06em}
.statValue{font-size:24px;font-weight:900;margin:6px 0;color:#f3f6fb}
.statNote{font-size:12px;color:#74849a}
.chartBox{height:260px}
.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.sectionLabel{font-size:12px;color:#f6b100;letter-spacing:.12em}
.orderCard{border:1px solid #1b2940;background:#0a111d;border-radius:14px;padding:14px;margin-bottom:12px}
.orderCard.buy{border-left:4px solid #27ae60}
.orderCard.sell{border-left:4px solid #eb5757}
.orderTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.ticker,.tickerCell{font-weight:900;color:#fff;font-size:18px;letter-spacing:.04em}
.subline{font-size:12px;color:#8795aa;margin-top:4px}
.pill{border-radius:999px;padding:5px 10px;font-size:11px;font-weight:900}
.pill.success{background:#10291d;color:#5be38a;border:1px solid #1f8b4c}
.pill.danger{background:#301217;color:#ff8080;border:1px solid #eb5757}
.miniGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
.metric{background:#07101b;border:1px solid #172338;border-radius:10px;padding:10px}
.metric span{display:block;font-size:10px;color:#7b8ca3;text-transform:uppercase}
.metric b{font-size:15px;color:#eef3fb}
.executeBox{display:grid;grid-template-columns:1fr 1fr 1.2fr auto;gap:8px;align-items:end}
.field{display:flex;flex-direction:column;gap:6px;font-size:11px;color:#8ea0b8;text-transform:uppercase;font-weight:800}
input,select{width:100%;background:#050a12;border:1px solid #23324a;border-radius:9px;color:#eaf0f7;padding:10px 11px;outline:none}
input:focus,select:focus{border-color:#f6b100;box-shadow:0 0 0 2px rgba(246,177,0,.12)}
.terminalBtn,.ghostBtn{border:1px solid #2a3a55;background:#101927;color:#dbe6f4;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer}
.terminalBtn.primary{background:#f6b100;color:#06080c;border-color:#f6b100}
.terminalBtn:disabled,.ghostBtn:disabled{opacity:.55;cursor:not-allowed}
.ghostBtn{padding:8px 10px;font-size:11px}
.dangerText{color:#ff8080}
.tableWrap{overflow:auto;border:1px solid #172338;border-radius:12px}
table{width:100%;border-collapse:collapse;min-width:760px}
th,td{border-bottom:1px solid #172338;padding:10px;text-align:left;font-size:13px}
th{background:#0b1422;color:#f6b100;text-transform:uppercase;font-size:11px;letter-spacing:.06em}
td{color:#dbe6f4}
.buttonRow{display:flex;justify-content:flex-end;gap:10px;margin-top:12px}
.settingsGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.phaseCards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.phaseCard{border:1px solid #1b2940;background:#0a111d;border-radius:12px;padding:14px;cursor:pointer}
.phaseCard.active{border-color:#f6b100;background:#171206}
.phaseCard b{display:block;color:#f6b100;margin-bottom:6px}
.phaseCard span{font-size:12px;color:#8ea0b8}
.alert{background:#341018;color:#ffb4b4;border:1px solid #eb5757;padding:12px;border-radius:12px;margin:12px 0}
.toast{position:fixed;right:18px;bottom:18px;background:#10291d;color:#5be38a;border:1px solid #1f8b4c;padding:12px 16px;border-radius:12px;z-index:20;font-weight:800}
.loading,.empty{border:1px dashed #26364f;border-radius:12px;padding:26px;color:#8795aa;text-align:center;background:#07101b}
@media(max-width:900px){
  .grid,.split,.settingsGrid,.phaseCards{grid-template-columns:1fr}
  .topbar{align-items:flex-start;gap:12px;flex-direction:column}
  .miniGrid,.executeBox{grid-template-columns:1fr}
}
`;

export default App;
