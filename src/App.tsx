// @ts-nocheck
import { useEffect, useMemo, useState } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwfaKVblw8JfzE36N_ulBlTDIToxYBjCW9sTXlQEAk4HrwT17GBQui8mIe4hT015A9geA/exec";

type AnyRow = Record<string, any>;

const tabs = [
  ["dashboard", "Dashboard"],
  ["orders", "Orders"],
  ["portfolio", "Portfolio"],
  ["stockList", "Stock List"],
  ["progress", "Progress"],
  ["settings", "Settings"],
];

const phaseOptions = ["BUILD", "BALANCE", "INCOME"];

const toNum = (v: any) => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[,%฿\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const text = (v: any, fallback = "—") => {
  const s = String(v ?? "").trim();
  return s || fallback;
};

const money = (v: any, digits = 0) => {
  const n = toNum(v);
  if (v === "" || v === null || v === undefined || Number.isNaN(n)) return "—";
  return "฿" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const num = (v: any, digits = 2) => {
  const n = toNum(v);
  if (v === "" || v === null || v === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const pct = (v: any, digits = 2) => {
  const n = toNum(v);
  if (v === "" || v === null || v === undefined || Number.isNaN(n)) return "—";
  const value = Math.abs(n) <= 1 ? n * 100 : n;
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + "%";
};

const getData = (raw: any) => raw?.data || raw || {};
const getAsset = (r: AnyRow) => text(r.assetCode || r.symbol, "");
const getAction = (r: AnyRow) => String(r.actionType || r.action || "").toUpperCase();
const getSource = (r: AnyRow) => text(r.source || r.type, "");
const getStatus = (r: AnyRow) => text(r.holdingStatus || r.manualStatus || r.lifecycleStatus || r.stockListStatus, "");

const normalizeArray = (v: any) => Array.isArray(v) ? v : [];

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top left, #101a2b 0, #05070b 42%, #030407 100%)",
    color: "#f8fafc",
    fontFamily: "'Inter', 'Arial', sans-serif",
    padding: 18,
  },
  shell: { maxWidth: 1880, margin: "0 auto" },
  header: {
    border: "1px solid #20304a",
    background: "linear-gradient(180deg, #101827, #0a101b)",
    borderRadius: 18,
    padding: "22px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 16px 40px rgba(0,0,0,.35)",
  },
  brand: { color: "#f6b100", fontWeight: 900, letterSpacing: 5, fontSize: 14 },
  h1: { margin: "12px 0 0", fontSize: 28, lineHeight: 1.15, fontWeight: 900 },
  live: { display: "flex", alignItems: "center", gap: 14, color: "#9db7d9", fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 99, background: "#20c878", boxShadow: "0 0 16px #20c878" },
  nav: { display: "flex", gap: 10, flexWrap: "wrap", margin: "18px 0" },
  navBtn: {
    border: "1px solid #20304a",
    background: "#0d1524",
    color: "#9db7d9",
    padding: "13px 20px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 15,
  },
  navActive: { background: "#f6b100", color: "#030407", borderColor: "#f6b100" },
  card: {
    border: "1px solid #20304a",
    background: "rgba(9,16,27,.94)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
  },
  row: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 },
  title: { fontSize: 20, fontWeight: 900, margin: 0 },
  sub: { color: "#9db7d9", fontSize: 13 },
  line: { height: 1, background: "#20304a", margin: "14px 0 18px" },
  kpi: { border: "1px solid #20304a", borderLeft: "3px solid #f6b100", background: "#0d1524", borderRadius: 12, padding: 16 },
  kpiLabel: { color: "#9db7d9", fontSize: 12, textTransform: "uppercase", letterSpacing: .7 },
  kpiValue: { fontSize: 28, fontWeight: 900, marginTop: 10 },
  badge: { display: "inline-flex", border: "1px solid rgba(246,177,0,.5)", color: "#f6b100", borderRadius: 99, padding: "6px 10px", fontSize: 11, fontWeight: 900, background: "rgba(246,177,0,.12)" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", minWidth: 900 },
  th: { textAlign: "left", color: "#f6b100", fontSize: 12, padding: "11px 12px", textTransform: "uppercase", background: "#0d1524" },
  td: { padding: "12px", background: "#08111d", borderTop: "1px solid #17263e", borderBottom: "1px solid #17263e", fontSize: 13 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #20304a",
    background: "#060b13",
    color: "#f8fafc",
    borderRadius: 10,
    padding: "12px",
    fontSize: 14,
    outline: "none",
  },
  btn: {
    border: "1px solid #f6b100",
    background: "#f6b100",
    color: "#030407",
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  btnDark: {
    border: "1px solid #20304a",
    background: "#0d1524",
    color: "#f8fafc",
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  error: {
    border: "1px solid #e5484d",
    background: "rgba(126, 19, 38, .55)",
    color: "#ffd4d6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  ok: {
    border: "1px solid #20c878",
    background: "rgba(32,200,120,.12)",
    color: "#bfffe0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  }
};

function App() {
  const [active, setActive] = useState("dashboard");
  const [raw, setRaw] = useState<any>({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [portfolioDraft, setPortfolioDraft] = useState<any[]>([]);
  const [settings, setSettings] = useState({ portfolioName: "", lineAvailable: "", selectedPhase: "BUILD" });

  const data = useMemo(() => getData(raw), [raw]);
  const system = data.system || data.summary || {};
  const dashboard = normalizeArray(data.dashboard);
  const orders = normalizeArray(data.orders);
  const portfolio = normalizeArray(data.portfolio || data.holdings);
  const stockList = normalizeArray(data.stockList);
  const progress = data.progress || data.decisionAnalytics || {};
  const buyOrders = normalizeArray(data.buyOrders).length ? normalizeArray(data.buyOrders) : orders.filter((r) => getAction(r) === "BUY");
  const sellOrders = normalizeArray(data.sellOrders || data.sellAlerts).length ? normalizeArray(data.sellOrders || data.sellAlerts) : orders.filter((r) => getAction(r) === "SELL");

  const selectedPhase = text(system.selectedPhase || system.portfolioPhase || settings.selectedPhase, "BUILD").toUpperCase();
  const totalPortfolioVal = system.totalPortfolioVal ?? system.totalPortfolioValue ?? system.portfolioValue ?? dashboard.find((x: AnyRow) => x.cardId === "totalWealth")?.value ?? 0;
  const lineAvailable = system.lineAvailable ?? dashboard.find((x: AnyRow) => x.cardId === "lineAvailable")?.value ?? 0;

  const allocation = [
    { label: "Dividend", value: toNum(system.dividendValue), weight: system.dividendWeight },
    { label: "Growth", value: toNum(system.growthValue), weight: system.growthWeight },
  ];

  async function load() {
    try {
      setLoading(true);
      setError("");
      setToast("");
      if (!SCRIPT_URL || SCRIPT_URL.includes("PASTE_YOUR")) throw new Error("Please paste your Apps Script /exec URL into SCRIPT_URL.");
      const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`, { method: "GET", redirect: "follow" });
      const json = await res.json();
      if (json.success === false || json.status === "error") throw new Error(json.message || json.error || "API returned error");
      setRaw(json);
      const d = getData(json);
      const s = d.system || d.summary || {};
      const pf = normalizeArray(d.portfolio || d.holdings);
      setSettings({
        portfolioName: text(s.portfolioName, ""),
        lineAvailable: String(s.lineAvailable ?? ""),
        selectedPhase: text(s.selectedPhase || s.portfolioPhase, "BUILD").toUpperCase(),
      });
      setPortfolioDraft(pf.map((h: AnyRow) => ({
        assetCode: getAsset(h),
        units: h.units ?? "",
        avgCost: h.avgCost ?? "",
      })));
    } catch (e: any) {
      setError(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  async function post(payload: AnyRow) {
    try {
      setLoading(true);
      setError("");
      setToast("");
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success === false) throw new Error(json.message || "Save failed");
      setToast(json.message || "Saved");
      await load();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const Header = () => (
    <div style={styles.header}>
      <div>
        <div style={styles.brand}>PORTFOLIO OS</div>
        <h1 style={styles.h1}>Human-Guided Portfolio Management</h1>
      </div>
      <div style={styles.live}>
        <span style={styles.dot} />
        <span>LIVE</span>
        <span>{selectedPhase}</span>
        <button style={styles.btnDark} onClick={load}>{loading ? "LOADING" : "REFRESH"}</button>
      </div>
    </div>
  );

  const Nav = () => (
    <div style={styles.nav}>
      {tabs.map(([id, label]) => (
        <button key={id} style={{...styles.navBtn, ...(active === id ? styles.navActive : {})}} onClick={() => setActive(id)}>
          {label}
        </button>
      ))}
    </div>
  );

  const Section = ({ title, badge, children }: any) => (
    <section style={styles.card}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
        <h2 style={styles.title}>{title}</h2>
        {badge && <span style={styles.badge}>{badge}</span>}
      </div>
      <div style={styles.line} />
      {children}
    </section>
  );

  const Empty = ({ children }: any) => (
    <div style={{border:"1px dashed #20304a", borderRadius:12, padding:28, color:"#9db7d9", textAlign:"center"}}>
      {children}
    </div>
  );

  const RowTable = ({ headers, rows, render }: any) => (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead><tr>{headers.map((h: string) => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r: AnyRow, i: number) => render(r, i))}</tbody>
      </table>
    </div>
  );

  const Dashboard = () => (
    <>
      <Section title="Market Command Center" badge="SYSTEM">
        <div style={styles.row}>
          <div style={styles.kpi}><div style={styles.kpiLabel}>Portfolio Value</div><div style={styles.kpiValue}>{money(totalPortfolioVal)}</div><div style={styles.sub}>Current portfolio</div></div>
          <div style={styles.kpi}><div style={styles.kpiLabel}>Line Available</div><div style={styles.kpiValue}>{money(lineAvailable)}</div><div style={styles.sub}>Buying power</div></div>
          <div style={styles.kpi}><div style={styles.kpiLabel}>Unrealized P/L</div><div style={styles.kpiValue}>{money(system.totalUnrealizedPL)}</div><div style={styles.sub}>{pct(system.totalPLPercent)}</div></div>
        </div>
      </Section>
      <div style={styles.grid2}>
        <Section title="Allocation" badge="WEIGHT">
          {allocation.some(x => x.value) ? allocation.map(x => (
            <div key={x.label} style={{marginBottom:14}}>
              <div style={{display:"flex", justifyContent:"space-between", fontWeight:900}}>
                <span>{x.label}</span><span>{money(x.value)} / {pct(x.weight)}</span>
              </div>
              <div style={{height:10, background:"#0d1524", borderRadius:99, overflow:"hidden", marginTop:8}}>
                <div style={{height:"100%", width: `${Math.max(0, Math.min(100, Math.abs(toNum(x.weight) <= 1 ? toNum(x.weight)*100 : toNum(x.weight))))}%`, background:"#f6b100"}} />
              </div>
            </div>
          )) : <Empty>No allocation data from API OUTPUT</Empty>}
        </Section>
        <Section title="Key Numbers" badge="API OUTPUT">
          <RowTable
            headers={["Metric", "Value", "Sub Label", "Type"]}
            rows={dashboard}
            render={(r: AnyRow, i: number) => (
              <tr key={i}>
                <td style={styles.td}>{text(r.label || r.cardId)}</td>
                <td style={styles.td}>{r.type === "currency" ? money(r.value, 2) : text(r.value)}</td>
                <td style={styles.td}>{text(r.subLabel)}</td>
                <td style={styles.td}>{text(r.type)}</td>
              </tr>
            )}
          />
        </Section>
      </div>
    </>
  );

  const OrderCard = ({ r, i }: any) => {
    const action = getAction(r);
    return (
      <tr key={`${action}-${getAsset(r)}-${i}`}>
        <td style={styles.td}><span style={styles.badge}>{action}</span></td>
        <td style={styles.td}><b>{getAsset(r)}</b><div style={styles.sub}>{getSource(r)}</div></td>
        <td style={styles.td}>{text(r.priority)}</td>
        <td style={styles.td}>{num(r.suggestedUnits ?? r.units, 0)}</td>
        <td style={styles.td}>{money(r.suggestedValue ?? r.suggestedBuy ?? r.suggestedSell, 2)}</td>
        <td style={styles.td}>{money(r.marketPrice ?? r.price, 2)}</td>
        <td style={styles.td}>{pct(r.currentWeight)}</td>
        <td style={styles.td}>{pct(r.targetWeight)}</td>
        <td style={styles.td}>{pct(r.weightGap)}</td>
        <td style={styles.td}>{text(r.reason || r.note)}</td>
        <td style={styles.td}>
          <button
            style={styles.btn}
            onClick={() => post({
              action: "logDecision",
              assetCode: getAsset(r),
              actionType: action,
              source: "SYSTEM",
              suggestedUnits: r.suggestedUnits ?? r.units,
              actualUnits: r.suggestedUnits ?? r.units,
              actualPrice: r.marketPrice ?? r.price,
              marketPrice: r.marketPrice ?? r.price,
              note: "Follow System",
            })}
          >
            LOG
          </button>
        </td>
      </tr>
    );
  };

  const Orders = () => (
    <Section title="Action Center" badge={`${buyOrders.length} BUY / ${sellOrders.length} SELL`}>
      <h3 style={{color:"#f6b100", letterSpacing:2}}>BUY ORDERS</h3>
      {buyOrders.length ? <RowTable headers={["Action", "Asset", "Priority", "Units", "Value", "Price", "Current W", "Target W", "Gap", "Reason", ""]} rows={buyOrders} render={(r: AnyRow, i: number) => <OrderCard r={r} i={i} />} /> : <Empty>No buy orders from API OUTPUT</Empty>}
      <h3 style={{color:"#f6b100", letterSpacing:2, marginTop:24}}>SELL ALERTS</h3>
      {sellOrders.length ? <RowTable headers={["Action", "Asset", "Priority", "Units", "Value", "Price", "Current W", "Target W", "Gap", "Reason", ""]} rows={sellOrders} render={(r: AnyRow, i: number) => <OrderCard r={r} i={i} />} /> : <Empty>No sell alerts from API OUTPUT</Empty>}
    </Section>
  );

  const Portfolio = () => (
    <Section title="Master Portfolio" badge="Editable">
      {portfolioDraft.length === 0 && <Empty>No portfolio data from API OUTPUT</Empty>}
      {portfolioDraft.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr>{["Asset Code", "Units", "Avg Cost", "Current Value", "Weight", ""].map(h => <th style={styles.th} key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {portfolioDraft.map((h, i) => {
                const live = portfolio.find((p: AnyRow) => getAsset(p) === h.assetCode) || {};
                return (
                  <tr key={i}>
                    <td style={styles.td}><input style={styles.input} value={h.assetCode} onChange={(e) => setPortfolioDraft(portfolioDraft.map((x, j) => j === i ? {...x, assetCode:e.target.value.toUpperCase()} : x))} /></td>
                    <td style={styles.td}><input style={styles.input} value={h.units} onChange={(e) => setPortfolioDraft(portfolioDraft.map((x, j) => j === i ? {...x, units:e.target.value} : x))} /></td>
                    <td style={styles.td}><input style={styles.input} value={h.avgCost} onChange={(e) => setPortfolioDraft(portfolioDraft.map((x, j) => j === i ? {...x, avgCost:e.target.value} : x))} /></td>
                    <td style={styles.td}>{money(live.currentValue, 2)}</td>
                    <td style={styles.td}>{pct(live.currentWeight)}</td>
                    <td style={styles.td}><button style={styles.btnDark} onClick={() => setPortfolioDraft(portfolioDraft.filter((_, j) => j !== i))}>REMOVE</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{display:"flex", justifyContent:"flex-end", gap:12}}>
        <button style={styles.btnDark} onClick={() => setPortfolioDraft([...portfolioDraft, { assetCode:"", units:"", avgCost:"" }])}>ADD ROW</button>
        <button style={styles.btn} onClick={() => post({ action:"savePortfolio", portfolio: portfolioDraft })}>SAVE PORTFOLIO</button>
      </div>
    </Section>
  );

  const StockList = () => (
    <Section title="Stock List Control" badge="Fade In / Fade Out">
      {stockList.length ? <RowTable
        headers={["Asset", "Source", "Sector", "Leader", "Universe Note", "Manual Status", "Target Weight", "Holding Status", "Eligible"]}
        rows={stockList}
        render={(r: AnyRow, i: number) => (
          <tr key={i}>
            <td style={styles.td}><b>{getAsset(r)}</b></td>
            <td style={styles.td}>{getSource(r)}</td>
            <td style={styles.td}>{text(r.sector)}</td>
            <td style={styles.td}>{text(r.leaderFlag)}</td>
            <td style={styles.td}>{text(r.universeNote)}</td>
            <td style={styles.td}>{text(r.manualStatus)}</td>
            <td style={styles.td}>{pct(r.targetWeight)}</td>
            <td style={styles.td}>{getStatus(r)}</td>
            <td style={styles.td}>{text(r.engineEligible)}</td>
          </tr>
        )}
      /> : <Empty>No stock list data from API OUTPUT</Empty>}
    </Section>
  );

  const Progress = () => (
    <>
      <Section title="Decision Analytics" badge="PROGRESS">
        <div style={styles.row}>
          <div style={styles.kpi}><div style={styles.kpiLabel}>Total Decisions</div><div style={styles.kpiValue}>{num(progress.totalDecisions, 0)}</div></div>
          <div style={styles.kpi}><div style={styles.kpiLabel}>Follow System</div><div style={styles.kpiValue}>{num(progress.followSystemCount, 0)}</div></div>
          <div style={styles.kpi}><div style={styles.kpiLabel}>Override</div><div style={styles.kpiValue}>{num(progress.overrideCount, 0)}</div></div>
          <div style={styles.kpi}><div style={styles.kpiLabel}>Good / Neutral / Bad</div><div style={styles.kpiValue}>{num(progress.goodCount, 0)} / {num(progress.neutralCount, 0)} / {num(progress.badCount, 0)}</div></div>
          <div style={styles.kpi}><div style={styles.kpiLabel}>Average Outcome</div><div style={styles.kpiValue}>{pct(progress.averageOutcome)}</div></div>
          <div style={styles.kpi}><div style={styles.kpiLabel}>Behavior Score</div><div style={styles.kpiValue}>{num(progress.behaviorScore, 2)}</div></div>
        </div>
      </Section>
    </>
  );

  const Settings = () => (
    <Section title="System Settings" badge="Google Sheets Sync">
      <div style={styles.row}>
        <label><div style={styles.kpiLabel}>Portfolio Name</div><input style={styles.input} value={settings.portfolioName} onChange={(e) => setSettings({...settings, portfolioName:e.target.value})} /></label>
        <label><div style={styles.kpiLabel}>Line Available</div><input style={styles.input} value={settings.lineAvailable} onChange={(e) => setSettings({...settings, lineAvailable:e.target.value})} /></label>
        <label><div style={styles.kpiLabel}>Portfolio Phase</div><select style={styles.input} value={settings.selectedPhase} onChange={(e) => setSettings({...settings, selectedPhase:e.target.value})}>{phaseOptions.map(p => <option key={p}>{p}</option>)}</select></label>
      </div>
      <div style={styles.row, marginTop:16}>
        <div style={styles.kpi}><h3 style={{marginTop:0, color:"#f6b100"}}>BUILD</h3><div style={styles.sub}>Dividend 40% · Growth 60%</div></div>
        <div style={styles.kpi}><h3 style={{marginTop:0, color:"#f6b100"}}>BALANCE</h3><div style={styles.sub}>Dividend 50% · Growth 50%</div></div>
        <div style={styles.kpi}><h3 style={{marginTop:0, color:"#f6b100"}}>INCOME</h3><div style={styles.sub}>Dividend 70% · Growth 30%</div></div>
      </div>
      <div style={{display:"flex", justifyContent:"flex-end", marginTop:18}}>
        <button style={styles.btn} onClick={() => post({ action:"saveSettings", portfolioName: settings.portfolioName, lineAvailable: settings.lineAvailable, selectedPhase: settings.selectedPhase })}>SAVE SETTINGS</button>
      </div>
    </Section>
  );

  return (
    <div style={styles.app}>
      <div style={styles.shell}>
        <Header />
        <Nav />
        {error && <div style={styles.error}>{error}</div>}
        {toast && <div style={styles.ok}>{toast}</div>}
        {active === "dashboard" && <Dashboard />}
        {active === "orders" && <Orders />}
        {active === "portfolio" && <Portfolio />}
        {active === "stockList" && <StockList />}
        {active === "progress" && <Progress />}
        {active === "settings" && <Settings />}
      </div>
    </div>
  );
}

export default App;
