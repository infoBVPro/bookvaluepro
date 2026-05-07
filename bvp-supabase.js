// bvp-supabase.js — BookValuePro shared Supabase client v2
// Include via: <script src="bvp-supabase.js"></script>
// Requires: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const BVP_URL  = 'https://wspxgkbcdkvlripmvnjh.supabase.co';
const BVP_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcHhna2JjZGt2bHJpcG12bmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTY1MDYsImV4cCI6MjA5MzEzMjUwNn0.LwaD7RdXqS1-VrRGZHY2p0PzTXspvLUpt1XY2ldKhKk';

const bvp = window.supabase.createClient(BVP_URL, BVP_ANON);

// ── CONSTANTS ─────────────────────────────────────────────────
const BVP_ENROLLMENT_TYPES = [
  'Open Enrollment','Underwritten',
  'Federal Guaranteed Issue','State Guaranteed Issue','Disabled',
];

const BVP_GI_TYPES = [
  'Federal Guaranteed Issue','State Guaranteed Issue','Disabled',
];

const BVP_CARRIERS = [
  'AARP/UHC','AETNA','HealthSpring','Humana',
  'Blue Cross Blue Shield','Mutual of Omaha','Elevance','Generic',
];

// ── AUTH ──────────────────────────────────────────────────────
const BVP_IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
const BVP_LAST_ACTIVE_KEY = 'bvp_last_active';

function bvpTrackActivity() {
  localStorage.setItem(BVP_LAST_ACTIVE_KEY, Date.now().toString());
}

function bvpIsSessionExpired() {
  const last = parseInt(localStorage.getItem(BVP_LAST_ACTIVE_KEY) || '0');
  if (!last) return false;
  return (Date.now() - last) > BVP_IDLE_TIMEOUT_MS;
}

let _bvpIdleTimer = null;
function bvpStartIdleTimer() {
  if (_bvpIdleTimer) return;
  const reset = () => bvpTrackActivity();
  ['mousedown','mousemove','keydown','touchstart','scroll','click'].forEach(evt => {
    document.addEventListener(evt, reset, { passive: true });
  });
  _bvpIdleTimer = setInterval(async () => {
    if (bvpIsSessionExpired()) {
      clearInterval(_bvpIdleTimer);
      await bvp.auth.signOut();
      localStorage.removeItem(BVP_LAST_ACTIVE_KEY);
      window.location.href = 'index.html';
    }
  }, 5 * 60 * 1000);
}

async function bvpRequireAuth() {
  if (bvpIsSessionExpired()) {
    await bvp.auth.signOut();
    localStorage.removeItem(BVP_LAST_ACTIVE_KEY);
    window.location.href = 'index.html';
    return null;
  }
  const { data: { session } } = await bvp.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return null; }
  bvpTrackActivity();
  bvpStartIdleTimer();
  return session;
}

async function bvpSignOut() {
  clearInterval(_bvpIdleTimer);
  localStorage.removeItem(BVP_LAST_ACTIVE_KEY);
  await bvp.auth.signOut();
  window.location.href = 'index.html';
}

// Smart redirect — dashboard if book exists, upload if not
async function bvpSmartRedirect(agentId) {
  const book = await bvpGetActiveBook(agentId);
  if (book && book.policy_count > 0) {
    window.location.href = 'bookvaluepro-dashboard.html';
  } else {
    window.location.href = 'bookvaluepro-upload.html';
  }
}

// ── BOOKS ─────────────────────────────────────────────────────

async function bvpGetAllBooks(agentId) {
  const { data, error } = await bvp
    .from('books')
    .select('*')
    .eq('agent_id', agentId)
    .order('uploaded_at', { ascending: false });
  if (error) { console.error('bvpGetAllBooks:', error); return []; }
  return data;
}

async function bvpGetActiveBook(agentId) {
  const { data, error } = await bvp
    .from('books')
    .select('*')
    .eq('agent_id', agentId)
    .eq('is_active', true)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('bvpGetActiveBook:', error); return null; }
  return data;
}

async function bvpSetActiveBook(agentId, bookId) {
  const { error: e1 } = await bvp.from('books').update({ is_active: false }).eq('agent_id', agentId);
  if (e1) { console.error('bvpSetActiveBook deactivate:', e1); return false; }
  const { error: e2 } = await bvp.from('books').update({ is_active: true }).eq('id', bookId).eq('agent_id', agentId);
  if (e2) { console.error('bvpSetActiveBook activate:', e2); return false; }
  return true;
}

async function bvpUploadBook(agentId, fileName, policies, mode = 'version', versionName = null) {
  let bookId;
  console.log('bvpUploadBook: starting upload for', policies.length, 'policies');

  if (mode === 'append') {
    const active = await bvpGetActiveBook(agentId);
    if (!active) { console.error('bvpUploadBook: no active book to append to'); return null; }
    bookId = active.id;
    await bvp.from('books').update({
      policy_count: (active.policy_count || 0) + policies.length,
      uploaded_at:  new Date().toISOString(),
    }).eq('id', bookId);
  } else {
    await bvp.from('books').update({ is_active: false }).eq('agent_id', agentId);
    const { data: book, error } = await bvp.from('books').insert({
      agent_id:     agentId,
      file_name:    fileName,
      version_name: versionName || fileName,
      is_active:    true,
      policy_count: policies.length,
    }).select().single();
    if (error) { console.error('bvpUploadBook insert book error:', error); return null; }
    bookId = book.id;
    console.log('bvpUploadBook: book created with id', bookId);
  }

  // Bulk insert in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < policies.length; i += CHUNK) {
    const chunk = policies.slice(i, i + CHUNK).map(p => ({ ...p, book_id: bookId, agent_id: agentId }));
    console.log('bvpUploadBook: inserting chunk', i, 'to', i + chunk.length, '— sample policy:', JSON.stringify(chunk[0]).substring(0, 200));
    const { error } = await bvp.from('policies').insert(chunk);
    if (error) { console.error('bvpUploadBook policies chunk error:', error); return null; }
  }
  console.log('bvpUploadBook: all policies inserted successfully');
  return bookId;
}

// ── POLICIES ─────────────────────────────────────────────────
async function bvpGetPolicies(bookId) {
  const { data, error } = await bvp
    .from('policies').select('*').eq('book_id', bookId)
    .order('priority').order('policy_idx');
  if (error) { console.error('bvpGetPolicies:', error); return []; }
  return data;
}

// ── COMMISSIONS ───────────────────────────────────────────────

// Returns all commission rates — agent overrides win over system defaults
async function bvpGetCommissions(agentId, state = null, carrier = null) {
  let query = bvp.from('commissions').select('*')
    .or(`is_default.eq.true,agent_id.eq.${agentId}`)
    .order('carrier').order('enrollment_type').order('duration_yr');
  if (state)   query = query.eq('issued_state', state);
  if (carrier) query = query.eq('carrier', carrier);
  const { data, error } = await query;
  if (error) { console.error('bvpGetCommissions:', error); return []; }
  if (!data || data.length === 0) {
    console.warn('bvpGetCommissions: no commission data returned — check RLS policies on commissions table');
    return [];
  }
  console.log('bvpGetCommissions: loaded', data.length, 'rate rows');
  // Log unique carriers and enrollment types for debugging
  console.log('bvpGetCommissions: unique carriers:', [...new Set(data.map(r => r.carrier))]);
  console.log('bvpGetCommissions: unique enrollment types:', [...new Set(data.map(r => r.enrollment_type))]);
  return data;
}

// Get a single rate via DB function (handles fallback to Generic)
async function bvpGetRate(agentId, state, carrier, enrollmentType, durationYr) {
  const { data, error } = await bvp.rpc('get_commission_rate', {
    p_agent_id:    agentId,
    p_state:       state,
    p_carrier:     carrier,
    p_enrollment:  enrollmentType,
    p_duration_yr: durationYr,
  });
  if (error) { console.error('bvpGetRate:', error); return null; }
  return data;
}

// Save an agent override rate
async function bvpSetCommissionRate(agentId, state, carrier, enrollmentType, durationYr, rate) {
  const { error } = await bvp.from('commissions').upsert({
    agent_id:        agentId,
    issued_state:    state,
    carrier:         carrier,
    enrollment_type: enrollmentType,
    duration_yr:     durationYr,
    rate:            rate,
    is_default:      false,
    updated_at:      new Date().toISOString(),
  }, { onConflict: 'issued_state,carrier,enrollment_type,duration_yr' });
  if (error) { console.error('bvpSetCommissionRate:', error); return false; }
  return true;
}

// Reset an override back to system default
async function bvpResetCommissionRate(agentId, state, carrier, enrollmentType, durationYr) {
  const { error } = await bvp.from('commissions').delete()
    .eq('agent_id', agentId).eq('issued_state', state).eq('carrier', carrier)
    .eq('enrollment_type', enrollmentType).eq('duration_yr', durationYr).eq('is_default', false);
  if (error) { console.error('bvpResetCommissionRate:', error); return false; }
  return true;
}

// ── ASSUMPTIONS ───────────────────────────────────────────────
async function bvpSaveAssumptions(bookId, discountRate, savingsPct) {
  const { error } = await bvp.from('books')
    .update({ discount_rate: discountRate, savings_pct: savingsPct }).eq('id', bookId);
  if (error) console.error('bvpSaveAssumptions:', error);
}

// ── NPV CALCULATION (client-side) ────────────────────────────
// commRates: array of 11 rates [yr1, yr2, ... yr11]
// Current NPV: policy is at currentDurationYr, rates step through remaining schedule
// Renewal NPV: restarts at duration 1, uses newPrem = currPrem * (1 - savingsPct/100)

function bvpCalcCurrentNPV(commPrem, currentDurationYr, commRates, discountPct = 10) {
  const r = discountPct / 100;
  let npv = 0;
  for (let i = 0; i < 11; i++) {
    const durIdx = Math.min(currentDurationYr - 1 + i, 10);
    const rate = commRates[durIdx] || 0;
    npv += (commPrem * rate) / Math.pow(1 + r, i + 1);
  }
  return npv * 12;
}

function bvpCalcRenewalNPV(currPrem, savingsPct, commRates, discountPct = 10) {
  const r = discountPct / 100;
  const newPrem = currPrem * (1 - savingsPct / 100);
  let npv = 0;
  for (let i = 0; i < 11; i++) {
    const rate = commRates[i] || 0;
    npv += (newPrem * rate) / Math.pow(1 + r, i + 1);
  }
  return npv * 12;
}

// ── LIVE NPV ENRICHMENT ───────────────────────────────────────
// Calculates curr_npv and ren_npv live from current commission rates.
// Call this after loading policies — replaces stored NPV values with
// fresh calculations using the agent's current commission schedule.
// discountPct: discount rate % (default 10)
// savingsPct:  avg policyholder savings on switch % (default 10)

const FALLBACK_RATES = {
  'AARP/UHC':               [0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.02,0.02],
  'AETNA':                  [0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.02,0.02],
  'Elevance':               [0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.02,0.02],
  'Humana':                 [0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.05,0.05],
  'Mutual of Omaha':        [0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.02,0.02],
  'Blue Cross Blue Shield': [0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.05,0.05],
  'HealthSpring':           [0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.02,0.02],
  'Generic':                [0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.22,0.02,0.02],
};

async function bvpEnrichPolicies(agentId, policies, discountPct = 10, savingsPct = 10) {
  // Load all commission rates for this agent
  const comms = await bvpGetCommissions(agentId);

  // Build rate lookup: carrier|enrollmentType -> array[11] of rates
  function getRates(carrier, enrollmentType) {
    const rows = comms.filter(r =>
      r.carrier === carrier && r.enrollment_type === enrollmentType
    );
    if (rows.length > 0) {
      const rates = Array(11).fill(0);
      rows.forEach(r => {
        const idx = Math.min(Math.max((r.duration_yr || 1) - 1, 0), 10);
        rates[idx] = parseFloat(r.rate) || 0;
      });
      if (rates.some(r => r > 0)) return rates;
    }
    // Fallback to hardcoded defaults
    return [...(FALLBACK_RATES[carrier] || FALLBACK_RATES['Generic'])];
  }

  // Enrich each policy with live NPV
  return policies.map(p => {
    const carrier     = p.company  || 'Generic';
    const durYr       = p.duration_yr || 1;
    const commPrem    = p.comm_prem   || 0;
    const currPrem    = p.curr_prem   || 0;

    // Use stored curr_pcts/ren_pcts if available and non-zero,
    // otherwise look up from commissions table / fallback
    let currRates = (p.curr_pcts && p.curr_pcts.some(r => r > 0))
      ? p.curr_pcts
      : getRates(carrier, 'Open Enrollment');

    let renRates  = (p.ren_pcts  && p.ren_pcts.some(r => r > 0))
      ? p.ren_pcts
      : getRates(carrier, 'Open Enrollment');

    const curr_npv = bvpCalcCurrentNPV(commPrem, durYr, currRates, discountPct);
    const ren_npv  = bvpCalcRenewalNPV(currPrem, savingsPct, renRates, discountPct);

    return { ...p, curr_npv, ren_npv, _currRates: currRates, _renRates: renRates };
  });
}
