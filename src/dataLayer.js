import { supabase, isSupabaseConfigured } from './supabaseClient'

const LOCAL_KEY = 'coaching_dashboard_v1'

// ── Local Storage fallback ─────────────────────────────────────────
const loadLocal = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

const saveLocal = (days) => {
  try {
    const existing = loadLocal()
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...existing, ...days }))
  } catch {}
}

// ── Supabase operations ────────────────────────────────────────────

// Save a single day entry
export async function saveDay(dayData) {
  // Always save locally as cache
  saveLocal({ [dayData.date]: dayData })

  if (!isSupabaseConfigured()) return { ok: true, source: 'local' }

  const { error } = await supabase
    .from('daily_logs')
    .upsert({
      date: dayData.date,
      weight: dayData.weight,
      hrv: dayData.hrv,
      rhr: dayData.rhr,
      sleep_score: dayData.sleepScore,
      sleep_duration: dayData.sleepDuration,
      xert_burn: dayData.xertBurn || 0,
      meals: dayData.meals,
      checklist: dayData.checklist,
      locked: dayData.locked,
      notes: dayData.notes || '',
      total_calories: dayData.meals.reduce((s, m) => s + (m.calories || 0), 0),
      total_protein: dayData.meals.reduce((s, m) => s + (m.protein || 0), 0),
    }, { onConflict: 'date' })

  if (error) {
    console.error('Supabase save error:', error)
    return { ok: false, source: 'local', error }
  }
  return { ok: true, source: 'supabase' }
}

// Load a single day
export async function loadDay(date) {
  if (!isSupabaseConfigured()) {
    const local = loadLocal()
    return local[date] || null
  }

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('date', date)
    .single()

  if (error || !data) {
    // Fall back to local
    const local = loadLocal()
    return local[date] || null
  }

  return {
    date: data.date,
    weight: data.weight,
    hrv: data.hrv,
    rhr: data.rhr,
    sleepScore: data.sleep_score,
    sleepDuration: data.sleep_duration,
    xertBurn: data.xert_burn,
    meals: data.meals || [],
    checklist: data.checklist || { sardines: false, fermented: false, fiber: false, resistant_starch: false },
    locked: data.locked,
    notes: data.notes,
  }
}

// Load all days (for trends)
export async function loadAllDays() {
  if (!isSupabaseConfigured()) {
    return loadLocal()
  }

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .order('date', { ascending: true })

  if (error || !data) {
    console.error('Supabase load error:', error)
    return loadLocal()
  }

  const days = {}
  data.forEach(row => {
    days[row.date] = {
      date: row.date,
      weight: row.weight,
      hrv: row.hrv,
      rhr: row.rhr,
      sleepScore: row.sleep_score,
      sleepDuration: row.sleep_duration,
      xertBurn: row.xert_burn,
      meals: row.meals || [],
      checklist: row.checklist || { sardines: false, fermented: false, fiber: false, resistant_starch: false },
      locked: row.locked,
      notes: row.notes,
    }
  })
  return days
}

// Load days in a date range (for trend charts)
export async function loadDayRange(startDate, endDate) {
  if (!isSupabaseConfigured()) {
    const all = loadLocal()
    return Object.values(all).filter(d => d.date >= startDate && d.date <= endDate)
  }

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) {
    console.error('Supabase range load error:', error)
    return []
  }

  return data.map(row => ({
    date: row.date,
    weight: row.weight,
    hrv: row.hrv,
    rhr: row.rhr,
    sleepScore: row.sleep_score,
    sleepDuration: row.sleep_duration,
    xertBurn: row.xert_burn,
    meals: row.meals || [],
    checklist: row.checklist || { sardines: false, fermented: false, fiber: false, resistant_starch: false },
    locked: row.locked,
    notes: row.notes,
    totalCalories: row.total_calories,
    totalProtein: row.total_protein,
  }))
}
