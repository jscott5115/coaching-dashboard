import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, ReferenceLine
} from "recharts";
import { saveDay, loadDay, loadAllDays } from "./dataLayer";
import { isSupabaseConfigured } from "./supabaseClient";

// ── Constants ──────────────────────────────────────────────────────
const BASELINE_BURN = 2180;
const TARGET_DEFICIT = 500;
const REST_DAY_BUDGET = BASELINE_BURN - TARGET_DEFICIT;
const PROTEIN_TARGET = 160;
const GOAL_WEIGHT = 183;
const GOAL_DATE = "2026-04-01";

const PRESET_FOODS = [
  { name: "Coffee w/ cream", calories: 50, protein: 0.5, fat: 5, carbs: 0, tags: [] },
  { name: "Rice cake block", calories: 135, protein: 2, fat: 1.75, carbs: 27.5, tags: ["carb"] },
  { name: "Sardines (1 can)", calories: 200, protein: 23, fat: 11, carbs: 0, tags: ["sardines", "protein"] },
  { name: "Mackerel (1 can)", calories: 200, protein: 22, fat: 12, carbs: 0, tags: ["sardines", "protein"] },
  { name: "Greek yogurt (170g)", calories: 100, protein: 17, fat: 0.7, carbs: 6, tags: ["protein", "fermented"] },
  { name: "Kimchi (100g)", calories: 15, protein: 1, fat: 0.5, carbs: 2, tags: ["fermented", "fiber"] },
  { name: "Sauerkraut (100g)", calories: 19, protein: 1, fat: 0.1, carbs: 4, tags: ["fermented", "fiber"] },
  { name: "Oats (50g dry)", calories: 190, protein: 7, fat: 3.5, carbs: 34, tags: ["fiber", "resistant_starch"] },
  { name: "Lentils (100g cooked)", calories: 116, protein: 9, fat: 0.4, carbs: 20, tags: ["fiber", "resistant_starch", "protein"] },
  { name: "Banana", calories: 105, protein: 1.3, fat: 0.4, carbs: 27, tags: ["fiber"] },
  { name: "Chicken breast (150g)", calories: 230, protein: 43, fat: 5, carbs: 0, tags: ["protein"] },
  { name: "Eggs (2 large)", calories: 140, protein: 12, fat: 10, carbs: 1, tags: ["protein"] },
  { name: "Whey protein scoop", calories: 120, protein: 24, fat: 1, carbs: 3, tags: ["protein"] },
  { name: "Cold rice (150g)", calories: 180, protein: 3, fat: 0.3, carbs: 40, tags: ["resistant_starch", "carb"] },
  { name: "Sugar solution (100g)", calories: 400, protein: 0, fat: 0, carbs: 100, tags: ["carb"] },
];

const todayStr = () => new Date().toISOString().split("T")[0];

const emptyDay = (date) => ({
  date,
  weight: null,
  hrv: null,
  rhr: null,
  sleepScore: null,
  sleepDuration: "",
  xertBurn: 0,
  meals: [],
  checklist: { sardines: false, fermented: false, fiber: false, resistant_starch: false },
  locked: false,
  notes: "",
});

const fmt = (n) => (n ?? 0).toFixed(0);
const fmtDec = (n) => (n ?? 0).toFixed(1);

const daysUntilGoal = () => {
  const d = new Date(GOAL_DATE);
  return Math.max(0, Math.ceil((d - new Date()) / 86400000));
};

// ── Colors ─────────────────────────────────────────────────────────
const C = {
  bg: "#0a0e17", surface: "#111827", surfaceAlt: "#1a2236",
  border: "#1e2d4a", borderLight: "#2a3f66",
  text: "#e2e8f0", textMuted: "#8294b0", textDim: "#4a5e7a",
  accent: "#f59e0b", accentDim: "#b47008",
  green: "#10b981", greenDim: "#065f46",
  red: "#ef4444", redDim: "#7f1d1d",
  blue: "#3b82f6", purple: "#a78bfa", cyan: "#06b6d4",
};

// ── Inline Styles ──────────────────────────────────────────────────
const S = {
  card: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: "12px", padding: "20px", position: "relative", overflow: "hidden",
  },
  cardLabel: {
    fontSize: "10px", fontWeight: "600", textTransform: "uppercase",
    letterSpacing: "1.5px", color: C.textMuted, marginBottom: "8px",
  },
  cardValue: { fontSize: "28px", fontWeight: "800", letterSpacing: "-1px" },
  cardSub: { fontSize: "11px", color: C.textMuted, marginTop: "4px" },
  sectionTitle: {
    fontSize: "13px", fontWeight: "700", textTransform: "uppercase",
    letterSpacing: "2px", color: C.textDim, margin: "24px 0 12px 0",
    display: "flex", alignItems: "center", gap: "8px",
  },
  line: { flex: 1, height: "1px", background: C.border },
  input: {
    background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: "8px",
    padding: "10px 14px", color: C.text, fontFamily: "inherit", fontSize: "13px",
    width: "100%", boxSizing: "border-box", outline: "none",
  },
  btn: {
    background: `linear-gradient(135deg, ${C.accent}, ${C.accentDim})`,
    color: C.bg, border: "none", borderRadius: "8px", padding: "10px 18px",
    fontFamily: "inherit", fontSize: "12px", fontWeight: "700", cursor: "pointer",
    letterSpacing: "0.5px", textTransform: "uppercase",
  },
  btnSec: {
    background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}`,
    borderRadius: "8px", padding: "8px 14px", fontFamily: "inherit",
    fontSize: "11px", fontWeight: "600", cursor: "pointer",
  },
  tag: (on, col) => ({
    display: "inline-flex", alignItems: "center", gap: "4px",
    padding: "6px 12px", borderRadius: "20px", fontSize: "11px",
    fontWeight: "600", fontFamily: "inherit", cursor: "pointer", border: "none",
    background: on ? (col || C.green) + "22" : C.surfaceAlt,
    color: on ? (col || C.green) : C.textMuted,
    outline: on ? `1px solid ${col || C.green}44` : `1px solid ${C.border}`,
  }),
  tab: (on) => ({
    padding: "8px 16px", borderRadius: "6px", fontSize: "11px", fontWeight: "600",
    fontFamily: "inherit", cursor: "pointer", border: "none",
    background: on ? C.accent + "22" : "transparent",
    color: on ? C.accent : C.textMuted,
  }),
  mealRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 0", borderBottom: `1px solid ${C.border}22`, fontSize: "13px",
  },
  presetBtn: {
    background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: "8px",
    padding: "10px 12px", textAlign: "left", cursor: "pointer",
    fontFamily: "inherit", color: C.text, fontSize: "11px", lineHeight: "1.4",
    transition: "border-color 0.2s",
  },
  chartBox: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: "12px", padding: "20px",
  },
  tooltipStyle: {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: "8px", fontFamily: "inherit", fontSize: "12px",
  },
};

// ── Small components ───────────────────────────────────────────────
const MetricCard = ({ label, value, unit, sub, color, icon }) => (
  <div style={S.card}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${color || C.accent}, transparent)` }} />
    <div style={S.cardLabel}>{icon} {label}</div>
    <div style={{ ...S.cardValue, color: color || C.text }}>
      {value ?? "—"}<span style={{ fontSize: "14px", fontWeight: "500", color: C.textMuted, marginLeft: "4px" }}>{unit}</span>
    </div>
    {sub && <div style={S.cardSub}>{sub}</div>}
  </div>
);

const ProgressRing = ({ pct, color, size = 64, stroke = 5 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.surfaceAlt} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={pct > 100 ? C.red : color}
        strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
    </svg>
  );
};

const SyncBadge = () => {
  const configured = isSupabaseConfigured();
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "4px 10px", borderRadius: "12px", fontSize: "10px", fontWeight: "600",
      background: configured ? C.green + "22" : C.accent + "22",
      color: configured ? C.green : C.accent,
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" }} />
      {configured ? "Cloud Sync" : "Local Only"}
    </div>
  );
};

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [days, setDays] = useState({});
  const [currentDate, setCurrentDate] = useState(todayStr());
  const [activeTab, setActiveTab] = useState("dashboard");
  const [customMeal, setCustomMeal] = useState({ name: "", calories: "", protein: "", fat: "", carbs: "" });
  const [presetQty, setPresetQty] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");
  const saveTimer = useRef(null);

  // ── Load all data on mount ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const allDays = await loadAllDays();
      if (!allDays[todayStr()]) allDays[todayStr()] = emptyDay(todayStr());
      setDays(allDays);
      setLoading(false);
    })();
  }, []);

  const currentDay = days[currentDate] || emptyDay(currentDate);

  // ── Auto-save with debounce ──────────────────────────────────────
  const updateDay = useCallback((updates) => {
    setDays(prev => {
      const updated = { ...prev[currentDate] || emptyDay(currentDate), ...updates };
      const newDays = { ...prev, [currentDate]: updated };

      // Debounced save to Supabase
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveStatus("saving...");
        const result = await saveDay(updated);
        setSaveStatus(result.source === "supabase" ? "synced ✓" : "saved locally");
        setTimeout(() => setSaveStatus(""), 2000);
      }, 500);

      return newDays;
    });
  }, [currentDate]);

  // ── Computed ─────────────────────────────────────────────────────
  const totalCalories = useMemo(() => currentDay.meals.reduce((s, m) => s + (m.calories || 0), 0), [currentDay.meals]);
  const totalProtein = useMemo(() => currentDay.meals.reduce((s, m) => s + (m.protein || 0), 0), [currentDay.meals]);
  const totalFat = useMemo(() => currentDay.meals.reduce((s, m) => s + (m.fat || 0), 0), [currentDay.meals]);
  const totalCarbs = useMemo(() => currentDay.meals.reduce((s, m) => s + (m.carbs || 0), 0), [currentDay.meals]);

  const dayBudget = REST_DAY_BUDGET + (currentDay.xertBurn || 0);
  const caloriesRemaining = dayBudget - totalCalories;
  const proteinRemaining = PROTEIN_TARGET - totalProtein;
  const calPct = (totalCalories / dayBudget) * 100;
  const proPct = (totalProtein / PROTEIN_TARGET) * 100;
  const totalBurn = BASELINE_BURN + (currentDay.xertBurn || 0);
  const actualDeficit = totalBurn - totalCalories;

  // Auto-update checklist
  useEffect(() => {
    const allTags = currentDay.meals.flatMap(m => m.tags || []);
    const cl = { ...currentDay.checklist };
    let changed = false;
    if (allTags.includes("sardines") && !cl.sardines) { cl.sardines = true; changed = true; }
    if (allTags.includes("fermented") && !cl.fermented) { cl.fermented = true; changed = true; }
    if (allTags.includes("fiber") && !cl.fiber) { cl.fiber = true; changed = true; }
    if (allTags.includes("resistant_starch") && !cl.resistant_starch) { cl.resistant_starch = true; changed = true; }
    if (changed) updateDay({ checklist: cl });
  }, [currentDay.meals.length]);

  // ── Trend data ───────────────────────────────────────────────────
  const trendData = useMemo(() => {
    return Object.values(days)
      .filter(d => d.weight || d.hrv || d.rhr || d.sleepScore)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: d.date.slice(5),
        weight: d.weight,
        hrv: d.hrv,
        rhr: d.rhr,
        sleep: d.sleepScore,
        deficit: d.locked ? (BASELINE_BURN + (d.xertBurn || 0)) - d.meals.reduce((s, m) => s + m.calories, 0) : null,
      }));
  }, [days]);

  // ── Handlers ─────────────────────────────────────────────────────
  const addPreset = (preset, qty = 1) => {
    const meal = {
      ...preset, calories: preset.calories * qty, protein: preset.protein * qty,
      fat: preset.fat * qty, carbs: preset.carbs * qty,
      name: qty > 1 ? `${preset.name} ×${qty}` : preset.name,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    updateDay({ meals: [...currentDay.meals, meal] });
    setPresetQty({});
  };

  const addCustomMeal = () => {
    if (!customMeal.name || !customMeal.calories) return;
    const meal = {
      name: customMeal.name, calories: parseFloat(customMeal.calories) || 0,
      protein: parseFloat(customMeal.protein) || 0, fat: parseFloat(customMeal.fat) || 0,
      carbs: parseFloat(customMeal.carbs) || 0, tags: [],
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    updateDay({ meals: [...currentDay.meals, meal] });
    setCustomMeal({ name: "", calories: "", protein: "", fat: "", carbs: "" });
  };

  const removeMeal = (idx) => updateDay({ meals: currentDay.meals.filter((_, i) => i !== idx) });

  const lockDay = async () => {
    updateDay({ locked: true });
  };

  const switchDate = (date) => {
    setCurrentDate(date);
    if (!days[date]) setDays(prev => ({ ...prev, [date]: emptyDay(date) }));
  };

  const deficitAlert = useMemo(() => {
    if (totalCalories === 0) return null;
    if (actualDeficit > 750) return { msg: "Deficit running hot — consider adding calories", color: C.red };
    if (actualDeficit < 300) return { msg: "Deficit too shallow — watch portions", color: C.accent };
    return null;
  }, [actualDeficit, totalCalories]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.accent, fontFamily: "inherit" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px", animation: "spin 1s linear infinite" }}>◎</div>
          <div style={{ fontSize: "13px", letterSpacing: "2px" }}>LOADING DATA...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.bg} 0%, #0f1629 50%, ${C.bg} 100%)`, color: C.text, fontFamily: "'JetBrains Mono', 'SF Mono', monospace", padding: 0 }}>

      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(180deg, ${C.surfaceAlt} 0%, transparent 100%)`, borderBottom: `1px solid ${C.border}`, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", background: `linear-gradient(135deg, ${C.accent}, ${C.green})`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: C.bg }}>JC</div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "-0.5px" }}>Coaching Dashboard</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: C.textMuted, letterSpacing: "1px" }}>FAT LOSS PROTOCOL v1</span>
              <SyncBadge />
              {saveStatus && <span style={{ fontSize: "10px", color: C.green }}>{saveStatus}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "20px", fontSize: "11px", color: C.textMuted }}>
          <div><div>GOAL</div><div style={{ color: C.accent, fontWeight: "700", fontSize: "14px" }}>{GOAL_WEIGHT} lb</div></div>
          <div><div>DAYS LEFT</div><div style={{ color: C.accent, fontWeight: "700", fontSize: "14px" }}>{daysUntilGoal()}</div></div>
          <div><div>TO LOSE</div><div style={{ color: C.accent, fontWeight: "700", fontSize: "14px" }}>{currentDay.weight ? fmtDec(currentDay.weight - GOAL_WEIGHT) : "—"} lb</div></div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", padding: "12px 16px 0", maxWidth: "1200px", margin: "0 auto", gap: "4px" }}>
        {["dashboard", "meals", "trends"].map(tab => (
          <button key={tab} style={S.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab === "dashboard" ? "◉ Today" : tab === "meals" ? "◎ Meals" : "◈ Trends"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input type="date" value={currentDate} onChange={e => switchDate(e.target.value)}
          style={{ ...S.input, width: "auto", fontSize: "11px", padding: "6px 10px" }} />
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* ═══════════ DASHBOARD ═══════════ */}
        {activeTab === "dashboard" && (
          <>
            {deficitAlert && (
              <div style={{ ...S.card, background: deficitAlert.color + "11", borderColor: deficitAlert.color + "44", padding: "12px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: deficitAlert.color, fontWeight: "700" }}>⚠</span>
                <span style={{ fontSize: "13px", color: deficitAlert.color }}>{deficitAlert.msg}</span>
                <span style={{ marginLeft: "auto", fontSize: "12px", color: C.textMuted }}>Deficit: {fmt(actualDeficit)} kcal</span>
              </div>
            )}

            {/* Biometrics */}
            <div style={S.sectionTitle}><span>Biometrics</span><div style={S.line} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
              {[
                { label: "Weight (lb)", key: "weight", ph: "192.0", type: "number", step: "0.1" },
                { label: "HRV (ms)", key: "hrv", ph: "36", type: "number" },
                { label: "RHR (bpm)", key: "rhr", ph: "43", type: "number" },
                { label: "Sleep Score", key: "sleepScore", ph: "82", type: "number" },
                { label: "Sleep (h:mm)", key: "sleepDuration", ph: "8:29", type: "text" },
                { label: "Xert Burn (kcal)", key: "xertBurn", ph: "0", type: "number" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "1px" }}>{f.label}</label>
                  <input style={S.input} type={f.type} step={f.step} placeholder={f.ph}
                    value={f.key === "sleepDuration" ? (currentDay[f.key] || "") : (currentDay[f.key] ?? "")}
                    onChange={e => {
                      const v = e.target.value;
                      if (f.type === "text") updateDay({ [f.key]: v });
                      else if (f.key === "weight") updateDay({ [f.key]: v ? parseFloat(v) : null });
                      else updateDay({ [f.key]: v ? parseInt(v) : (f.key === "xertBurn" ? 0 : null) });
                    }} />
                </div>
              ))}
            </div>

            {/* Metric Cards */}
            <div style={S.sectionTitle}><span>Status</span><div style={S.line} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
              <MetricCard label="Weight" value={currentDay.weight ? fmtDec(currentDay.weight) : null} unit="lb" color={C.blue}
                sub={currentDay.weight ? `${fmtDec(currentDay.weight - GOAL_WEIGHT)} lb to goal` : null} icon="⚖" />
              <MetricCard label="HRV" value={currentDay.hrv} unit="ms" color={C.green}
                sub={currentDay.hrv ? (currentDay.hrv >= 35 ? "Baseline range" : "Below baseline") : null} icon="♡" />
              <MetricCard label="RHR" value={currentDay.rhr} unit="bpm" color={C.purple} icon="❤" />
              <MetricCard label="Sleep" value={currentDay.sleepScore} unit={`/ ${currentDay.sleepDuration || "—"}`} color={C.cyan}
                sub={currentDay.sleepScore >= 80 ? "Good recovery" : currentDay.sleepScore ? "Monitor" : null} icon="☾" />
            </div>

            {/* Calorie & Protein Gauges */}
            <div style={S.sectionTitle}><span>Nutrition</span><div style={S.line} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {/* Calories */}
              <div style={S.card}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${C.accent}, transparent)` }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={S.cardLabel}>Calories</div>
                    <div style={{ ...S.cardValue, color: calPct > 100 ? C.red : C.accent }}>
                      {fmt(totalCalories)} <span style={{ fontSize: "14px", color: C.textMuted }}>/ {fmt(dayBudget)}</span>
                    </div>
                    <div style={S.cardSub}>
                      {caloriesRemaining > 0 ? `${fmt(caloriesRemaining)} remaining` : `${fmt(Math.abs(caloriesRemaining))} over`}
                      {currentDay.xertBurn > 0 && <span style={{ color: C.green }}> • +{fmt(currentDay.xertBurn)} ride</span>}
                    </div>
                  </div>
                  <ProgressRing pct={calPct} color={C.accent} />
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: C.surfaceAlt, marginTop: "8px", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: "3px", width: `${Math.min(100, calPct)}%`, background: calPct > 100 ? C.red : `linear-gradient(90deg, ${C.accent}, ${C.accent}aa)`, transition: "width 0.5s ease" }} />
                </div>
              </div>
              {/* Protein */}
              <div style={S.card}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${C.green}, transparent)` }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={S.cardLabel}>Protein</div>
                    <div style={{ ...S.cardValue, color: proPct >= 100 ? C.green : C.text }}>
                      {fmt(totalProtein)}<span style={{ fontSize: "14px", color: C.textMuted }}>g / {PROTEIN_TARGET}g</span>
                    </div>
                    <div style={S.cardSub}>{proteinRemaining > 0 ? `${fmt(proteinRemaining)}g remaining` : "Target hit ✓"}</div>
                  </div>
                  <ProgressRing pct={proPct} color={C.green} />
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: C.surfaceAlt, marginTop: "8px", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: "3px", width: `${Math.min(100, proPct)}%`, background: proPct > 100 ? C.red : `linear-gradient(90deg, ${C.green}, ${C.green}aa)`, transition: "width 0.5s ease" }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: C.textMuted }}>
              <span>Fat: <strong style={{ color: C.text }}>{fmt(totalFat)}g</strong></span>
              <span>Carbs: <strong style={{ color: C.text }}>{fmt(totalCarbs)}g</strong></span>
              <span>Deficit: <strong style={{ color: actualDeficit >= 400 && actualDeficit <= 600 ? C.green : C.accent }}>{fmt(actualDeficit)} kcal</strong></span>
            </div>

            {/* Checklist */}
            <div style={S.sectionTitle}><span>Daily Checklist</span><div style={S.line} /></div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[
                { key: "sardines", label: "Sardines", color: C.accent },
                { key: "fermented", label: "Fermented", color: C.purple },
                { key: "fiber", label: "Fiber", color: C.green },
                { key: "resistant_starch", label: "Resistant Starch", color: C.cyan },
              ].map(item => (
                <button key={item.key} style={S.tag(currentDay.checklist[item.key], item.color)}
                  onClick={() => updateDay({ checklist: { ...currentDay.checklist, [item.key]: !currentDay.checklist[item.key] } })}>
                  {currentDay.checklist[item.key] ? "✓" : "○"} {item.label}
                </button>
              ))}
            </div>

            {/* Meals summary */}
            {currentDay.meals.length > 0 && (
              <>
                <div style={S.sectionTitle}><span>Today's Log</span><div style={S.line} /><span style={{ fontSize: "11px", color: C.textMuted }}>{currentDay.meals.length} items</span></div>
                {currentDay.meals.map((meal, i) => (
                  <div key={i} style={S.mealRow}>
                    <div>
                      <span style={{ color: C.textMuted, fontSize: "11px", marginRight: "8px" }}>{meal.time}</span>
                      <span>{meal.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <span style={{ color: C.accent, fontWeight: "600" }}>{fmt(meal.calories)}</span>
                      <span style={{ color: C.green, fontWeight: "600" }}>{fmt(meal.protein)}g</span>
                      <button onClick={() => removeMeal(i)} style={{ ...S.btnSec, padding: "4px 8px", color: C.red, borderColor: C.red + "44" }}>×</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Lock */}
            {!currentDay.locked && totalCalories > 0 && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
                <button style={S.btn} onClick={lockDay}>Lock Day & Save Summary</button>
              </div>
            )}
            {currentDay.locked && (
              <div style={{ textAlign: "center", padding: "16px", color: C.green, fontSize: "13px", fontWeight: "600" }}>✓ Day locked — Deficit: {fmt(actualDeficit)} kcal</div>
            )}
          </>
        )}

        {/* ═══════════ MEALS ═══════════ */}
        {activeTab === "meals" && (
          <>
            <div style={S.sectionTitle}><span>Quick Add</span><div style={S.line} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: "8px" }}>
              {PRESET_FOODS.map((food, i) => (
                <button key={i} style={S.presetBtn} onClick={() => addPreset(food, presetQty[i] || 1)}>
                  <div style={{ fontWeight: "600", marginBottom: "4px" }}>{food.name}</div>
                  <div style={{ color: C.textMuted }}>{food.calories} cal • {food.protein}g P</div>
                  <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "10px", color: C.textDim }}>Qty:</span>
                    <input type="number" min="1" max="10" value={presetQty[i] || 1}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); setPresetQty({ ...presetQty, [i]: parseInt(e.target.value) || 1 }); }}
                      style={{ ...S.input, width: "40px", padding: "2px 6px", fontSize: "11px", textAlign: "center" }} />
                  </div>
                </button>
              ))}
            </div>

            <div style={S.sectionTitle}><span>Custom Entry</span><div style={S.line} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: "8px", alignItems: "end" }}>
              {[
                { key: "name", label: "Name", ph: "Food item", type: "text", span: false },
                { key: "calories", label: "Calories", ph: "0", type: "number" },
                { key: "protein", label: "Protein", ph: "0", type: "number" },
                { key: "fat", label: "Fat", ph: "0", type: "number" },
                { key: "carbs", label: "Carbs", ph: "0", type: "number" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: "10px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "1px" }}>{f.label}</label>
                  <input style={S.input} type={f.type} placeholder={f.ph} value={customMeal[f.key]}
                    onChange={e => setCustomMeal({ ...customMeal, [f.key]: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && addCustomMeal()} />
                </div>
              ))}
              <button style={{ ...S.btn, marginBottom: "1px" }} onClick={addCustomMeal}>+ Add</button>
            </div>

            {/* Running Tally */}
            <div style={S.sectionTitle}><span>Running Tally</span><div style={S.line} /></div>
            <div style={S.card}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: C.accent }}>{fmt(totalCalories)}</div>
                  <div style={{ fontSize: "10px", color: C.textMuted }}>/ {fmt(dayBudget)} CAL</div>
                </div>
                <div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: C.green }}>{fmt(totalProtein)}g</div>
                  <div style={{ fontSize: "10px", color: C.textMuted }}>/ {PROTEIN_TARGET}g PRO</div>
                </div>
                <div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: C.text }}>{fmt(totalFat)}g</div>
                  <div style={{ fontSize: "10px", color: C.textMuted }}>FAT</div>
                </div>
                <div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: C.text }}>{fmt(totalCarbs)}g</div>
                  <div style={{ fontSize: "10px", color: C.textMuted }}>CARBS</div>
                </div>
              </div>
            </div>

            {currentDay.meals.length > 0 && (
              <>
                <div style={S.sectionTitle}><span>Logged Items</span><div style={S.line} /></div>
                <div style={S.card}>
                  {currentDay.meals.map((meal, i) => (
                    <div key={i} style={{ ...S.mealRow, borderBottom: i < currentDay.meals.length - 1 ? `1px solid ${C.border}22` : "none" }}>
                      <div>
                        <span style={{ color: C.textMuted, fontSize: "11px", marginRight: "8px" }}>{meal.time}</span>
                        <span style={{ fontWeight: "500" }}>{meal.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "12px" }}>
                        <span style={{ color: C.accent }}>{fmt(meal.calories)}</span>
                        <span style={{ color: C.green }}>{fmt(meal.protein)}g P</span>
                        <span style={{ color: C.textMuted }}>{fmt(meal.fat)}g F</span>
                        <span style={{ color: C.textMuted }}>{fmt(meal.carbs)}g C</span>
                        <button onClick={() => removeMeal(i)} style={{ ...S.btnSec, padding: "4px 8px", color: C.red, borderColor: C.red + "44", fontSize: "10px" }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════ TRENDS ═══════════ */}
        {activeTab === "trends" && (
          <>
            {trendData.length < 2 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 20px", color: C.textMuted }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>◈</div>
                <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>Not enough data yet</div>
                <div style={{ fontSize: "12px" }}>Log at least 2 days of biometrics to see trends</div>
              </div>
            ) : (
              <>
                <div style={S.chartBox}>
                  <div style={S.cardLabel}>Weight Trend</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="date" stroke={C.textDim} fontSize={10} />
                      <YAxis domain={["dataMin - 1", "dataMax + 1"]} stroke={C.textDim} fontSize={10} />
                      <Tooltip contentStyle={S.tooltipStyle} />
                      <ReferenceLine y={GOAL_WEIGHT} stroke={C.accent} strokeDasharray="5 5" label={{ value: "Goal", fill: C.accent, fontSize: 10 }} />
                      <Line type="monotone" dataKey="weight" stroke={C.blue} strokeWidth={2} dot={{ fill: C.blue, r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={S.chartBox}>
                    <div style={S.cardLabel}>HRV Trend</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="date" stroke={C.textDim} fontSize={10} />
                        <YAxis stroke={C.textDim} fontSize={10} />
                        <Tooltip contentStyle={S.tooltipStyle} />
                        <Line type="monotone" dataKey="hrv" stroke={C.green} strokeWidth={2} dot={{ fill: C.green, r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={S.chartBox}>
                    <div style={S.cardLabel}>RHR Trend</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="date" stroke={C.textDim} fontSize={10} />
                        <YAxis stroke={C.textDim} fontSize={10} />
                        <Tooltip contentStyle={S.tooltipStyle} />
                        <Line type="monotone" dataKey="rhr" stroke={C.purple} strokeWidth={2} dot={{ fill: C.purple, r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={S.chartBox}>
                  <div style={S.cardLabel}>Sleep Score</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="date" stroke={C.textDim} fontSize={10} />
                      <YAxis domain={[0, 100]} stroke={C.textDim} fontSize={10} />
                      <Tooltip contentStyle={S.tooltipStyle} />
                      <Bar dataKey="sleep" fill={C.cyan} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {trendData.some(d => d.deficit !== null) && (
                  <div style={S.chartBox}>
                    <div style={S.cardLabel}>Daily Deficit (locked days)</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={trendData.filter(d => d.deficit !== null)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="date" stroke={C.textDim} fontSize={10} />
                        <YAxis stroke={C.textDim} fontSize={10} />
                        <Tooltip contentStyle={S.tooltipStyle} />
                        <ReferenceLine y={TARGET_DEFICIT} stroke={C.accent} strokeDasharray="5 5" label={{ value: "Target", fill: C.accent, fontSize: 10 }} />
                        <Bar dataKey="deficit" fill={C.accent} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div style={{ textAlign: "center", padding: "24px 0 32px", fontSize: "10px", color: C.textDim, letterSpacing: "1px" }}>
          COACHING DASHBOARD v1.0 — {currentDate}
        </div>
      </div>
    </div>
  );
}

