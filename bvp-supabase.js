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
  }

  // Bulk insert in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < policies.length; i += CHUNK) {
    const chunk = policies.slice(i, i + CHUNK).map(p => ({ ...p, book_id: bookId, agent_id: agentId }));
    const { error } = await bvp.from('policies').insert(chunk);
    if (error) { console.error('bvpUploadBook policies chunk error:', error); return null; }
  }
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
  // Fetch ALL default rates using pagination to bypass the 1000-row limit
  async function fetchAll(baseQuery) {
    const PAGE = 1000;
    let allRows = [];
    let from = 0;
    while (true) {
      const { data, error } = await baseQuery.range(from, from + PAGE - 1);
      if (error) { console.error('bvpGetCommissions fetchAll:', error); break; }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < PAGE) break; // last page
      from += PAGE;
    }
    return allRows;
  }

  let defaultBase = bvp.from('commissions').select('*')
    .eq('is_default', true)
    .order('carrier').order('enrollment_type').order('duration_yr');
  if (state)   defaultBase = defaultBase.eq('issued_state', state);
  if (carrier) defaultBase = defaultBase.eq('carrier', carrier);

  let overrideBase = bvp.from('commissions').select('*')
    .eq('agent_id', agentId)
    .eq('is_default', false)
    .order('carrier').order('enrollment_type').order('duration_yr');
  if (state)   overrideBase = overrideBase.eq('issued_state', state);
  if (carrier) overrideBase = overrideBase.eq('carrier', carrier);

  const [defaults, overrides] = await Promise.all([
    fetchAll(defaultBase),
    fetchAll(overrideBase),
  ]);

  const combined = [...defaults, ...overrides];

  if (combined.length === 0) {
    console.warn('bvpGetCommissions: no data returned — check RLS on commissions table');
    return [];
  }


  return combined;
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

function bvpCalcCurrentNPV(commPrem, currentDurationYr, effMonth, commRates, discountPct = 10) {
  const VALUATION_MONTH = new Date().getMonth() + 1;
  const alreadyRenewed  = effMonth !== null && effMonth <= VALUATION_MONTH;
  const nextDur         = currentDurationYr + 1;
  const r               = discountPct / 100;
  let npv = 0;
  for (let i = 0; i < 11; i++) {
    let rate = 0;
    if (alreadyRenewed) {
      rate = i === 0 ? 0 : (commRates[Math.min(nextDur - 1 + (i - 1), 10)] || 0);
    } else {
      rate = commRates[Math.min(nextDur - 1 + i, 10)] || 0;
    }
    npv += (commPrem * rate) / Math.pow(1 + r, i + 1);
  }
  return npv * 12;
}

function bvpCalcRenewalNPV(currPrem, savingsPct, effMonth, commRates, discountPct = 10) {
  // Same already-renewed logic as current NPV:
  // If policy already renewed this year → cf[0] = $0, cf[1..10] = Dur1..10 rates
  // If not yet renewed → cf[0..10] = Dur1..11 rates
  // Renewal always restarts at Duration 1 commission rates
  const VALUATION_MONTH = new Date().getMonth() + 1;
  const alreadyRenewed  = effMonth !== null && effMonth <= VALUATION_MONTH;
  const r               = discountPct / 100;
  const newPrem         = currPrem * (1 - savingsPct / 100);
  let npv = 0;
  for (let i = 0; i < 11; i++) {
    let rate = 0;
    if (alreadyRenewed) {
      rate = i === 0 ? 0 : (commRates[Math.min(i - 1, 10)] || 0);
    } else {
      rate = commRates[Math.min(i, 10)] || 0;
    }
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

async function bvpEnrichPolicies(agentId, policies, discountPct = 10, savingsPct = 10) {
  // Always load fresh commission rates from Supabase
  const comms = await bvpGetCommissions(agentId);

  // Rate lookup: carrier + state + enrollment type
  // Priority: exact carrier+state → carrier only → Generic
  function getRates(carrier, state, enrollmentType) {
    const attempts = [
      r => r.carrier === carrier && r.issued_state === state  && r.enrollment_type === enrollmentType,
      r => r.carrier === carrier && !r.issued_state           && r.enrollment_type === enrollmentType,
      r => r.carrier === carrier &&                              r.enrollment_type === enrollmentType,
      r => r.carrier === 'Generic' && !r.issued_state         && r.enrollment_type === enrollmentType,
      r => r.carrier === 'Generic' &&                            r.enrollment_type === enrollmentType,
    ];
    for (const match of attempts) {
      const rows = comms.filter(match);
      if (rows.length > 0) {
        const rates = Array(11).fill(0);
        rows.forEach(r => {
          const idx = Math.min(Math.max((r.duration_yr || 1) - 1, 0), 10);
          rates[idx] = parseFloat(r.rate) || 0;
        });
        if (rates.some(r => r > 0)) return rates;
      }
    }
    console.error('bvpEnrichPolicies: no rates found for', carrier, state, enrollmentType);
    return Array(11).fill(0);
  }

  const VALUATION_MONTH = new Date().getMonth() + 1;

  return policies.map(p => {
    const carrier  = p.company      || 'Generic';
    const state    = p.issued_state || null;
    const durYr    = p.duration_yr  || 1;
    const effMonth = p.eff_month    || null;
    const commPrem = p.comm_prem    || 0;
    const currPrem = p.curr_prem    || 0;

    // Normalize premium to annual if prem_mode is set
    // (curr_prem should already be annualized from clients page save,
    //  but guard here in case legacy data or direct DB entries exist)
    const premMulti = p.prem_mode === 'monthly' ? 12 : p.prem_mode === 'quarterly' ? 4 : 1;
    const annualCurrPrem = currPrem * premMulti;
    const annualCommPrem = commPrem * premMulti;

    const currRates = getRates(carrier, state, 'Open Enrollment');

    const curr_npv = bvpCalcCurrentNPV(annualCommPrem, durYr, effMonth, currRates, discountPct);

    // Renewal NPV: if agent has entered a renewal carrier + premium, use those
    // Otherwise fall back to savings % estimate off current premium
    let ren_npv;
    if (p.ren_carrier && p.ren_prem != null) {
      const renCarrier = p.ren_carrier;
      const renRates   = getRates(renCarrier, state, 'Open Enrollment');
      // Agent-entered ren_prem is stored as annual; use directly in renewal calc
      // We call a simplified version: ren_prem × rate schedule × discount
      const VALUATION_MONTH = new Date().getMonth() + 1;
      const alreadyRenewed  = effMonth !== null && effMonth <= VALUATION_MONTH;
      const r = discountPct / 100;
      let npv = 0;
      for (let i = 0; i < 11; i++) {
        let rate = 0;
        if (alreadyRenewed) {
          rate = i === 0 ? 0 : (renRates[Math.min(i - 1, 10)] || 0);
        } else {
          rate = renRates[Math.min(i, 10)] || 0;
        }
        npv += (p.ren_prem * rate) / Math.pow(1 + r, i + 1);
      }
      ren_npv = npv * 12;
    } else {
      const renRates = getRates(carrier, state, 'Open Enrollment');
      ren_npv = bvpCalcRenewalNPV(annualCurrPrem, savingsPct, effMonth, renRates, discountPct);
    }

    // Build offset arrays for dashboard engine
    const alreadyRenewed = effMonth !== null && effMonth <= (new Date().getMonth() + 1);
    const nextDur        = durYr + 1;

    // renRatesForOffset: use agent-set renewal carrier rates if available, else current carrier
    const renRatesForOffset = (p.ren_carrier && p.ren_prem != null)
      ? getRates(p.ren_carrier, state, 'Open Enrollment')
      : getRates(carrier, state, 'Open Enrollment');

    const offsetCurrRates = Array(11).fill(0).map((_, i) => {
      if (alreadyRenewed) {
        if (i === 0) return 0;
        return currRates[Math.min(nextDur - 1 + (i - 1), 10)] || 0;
      }
      return currRates[Math.min(nextDur - 1 + i, 10)] || 0;
    });

    const offsetRenRates = Array(11).fill(0).map((_, i) => {
      if (alreadyRenewed) {
        return i === 0 ? 0 : (renRatesForOffset[Math.min(i - 1, 10)] || 0);
      }
      return renRatesForOffset[Math.min(i, 10)] || 0;
    });

    // Expose annualized prems for dashboard/outreach calcs
    return { ...p, curr_npv, ren_npv,
      _annualCurrPrem: annualCurrPrem,
      _annualCommPrem: annualCommPrem,
      _currRates: offsetCurrRates,
      _renRates: offsetRenRates };
  });
}

// ── PRIORITY OVERRIDES ────────────────────────────────────────
// Saves a manual priority override for a single policy.
// Sets priority to the new value and records it was manually overridden.
async function bvpSetPriorityOverride(policyId, newPriority, agentEmail) {
  const { error } = await bvp.from('policies').update({
    priority:             newPriority,
    priority_override:    newPriority,
    priority_override_by: agentEmail || 'agent',
  }).eq('id', policyId);
  if (error) { console.error('bvpSetPriorityOverride:', error); return false; }
  return true;
}

// Clears a manual override, restoring the calculated priority.
async function bvpClearPriorityOverride(policyId, calculatedPriority) {
  const { error } = await bvp.from('policies').update({
    priority:             calculatedPriority,
    priority_override:    null,
    priority_override_by: null,
  }).eq('id', policyId);
  if (error) { console.error('bvpClearPriorityOverride:', error); return false; }
  return true;
}

// After uploading a new book, reapply any manual overrides from the agent's
// previous books by matching on policy_idx. Call after bvpUploadBook completes.
async function bvpReapplyPriorityOverrides(agentId, newBookId) {
  // 1. Find all policies across ALL books for this agent that have an override
  const { data: overridden, error: e1 } = await bvp
    .from('policies')
    .select('policy_idx, priority_override, priority_override_by')
    .eq('agent_id', agentId)
    .not('priority_override', 'is', null)
    .neq('book_id', newBookId);
  if (e1) { console.error('bvpReapplyPriorityOverrides fetch:', e1); return 0; }
  if (!overridden || overridden.length === 0) return 0;

  // Build a lookup map: policy_idx → override
  const overrideMap = {};
  overridden.forEach(p => {
    // Last-write-wins if same policy_idx appears in multiple old books
    overrideMap[p.policy_idx] = {
      priority_override:    p.priority_override,
      priority_override_by: p.priority_override_by,
    };
  });

  // 2. Fetch new book's policies to find matching policy_idx values
  const { data: newPolicies, error: e2 } = await bvp
    .from('policies')
    .select('id, policy_idx')
    .eq('book_id', newBookId);
  if (e2) { console.error('bvpReapplyPriorityOverrides fetch new:', e2); return 0; }

  // 3. Apply overrides in chunks
  const toUpdate = newPolicies.filter(p => overrideMap[p.policy_idx]);
  let count = 0;
  for (const p of toUpdate) {
    const ov = overrideMap[p.policy_idx];
    const { error } = await bvp.from('policies').update({
      priority:             ov.priority_override,
      priority_override:    ov.priority_override,
      priority_override_by: ov.priority_override_by,
    }).eq('id', p.id);
    if (!error) count++;
  }
  console.log(`bvpReapplyPriorityOverrides: reapplied ${count} overrides to new book`);
  return count;
}
