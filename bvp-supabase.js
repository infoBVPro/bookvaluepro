// bvp-supabase.js — BookValuePro shared Supabase client v2
// Include via: <script src="bvp-supabase.js"></script>
// Requires: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const BVP_URL  = 'https://wspxgkbcdkvlripmvnjh.supabase.co';
const BVP_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcHhna2JjZGt2bHJpcG12bmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTY1MDYsImV4cCI6MjA5MzEzMjUwNn0.LwaD7RdXqS1-VrRGZHY2p0PzTXspvLUpt1XY2ldKhKk';

const bvp = window.supabase.createClient(BVP_URL, BVP_ANON);

// ── CONSTANTS ─────────────────────────────────────────────────
const BVP_ENROLLMENT_TYPES = [
  'OpenEnrollment', 'Underwritten',
  'FederalGuaranteedIssue', 'StateGuaranteedIssue', 'Disabled',
];

const BVP_GI_TYPES = [
  'FederalGuaranteedIssue', 'StateGuaranteedIssue', 'Disabled',
];

// ── ADMIN ACCESS ─────────────────────────────────────────────
// Single source of truth for who can see/use the admin tools.
// bookvaluepro-admin.html also enforces this server-side-of-the-UI
// (redirects away if the signed-in email isn't on this list).
const BVP_ADMIN_EMAILS = ['info@bookvaluepro.com', 'jasonyoo@cox.net'];

function bvpIsAdmin(email) {
  return !!email && BVP_ADMIN_EMAILS.includes(email);
}

// Shows the "Admin" link in the side nav only for whitelisted emails.
// Call once per page, right after the auth session is confirmed.
function bvpSetAdminNavVisible(email) {
  const el = document.getElementById('bvp-sidenav-admin');
  if (!el) return;
  el.style.display = bvpIsAdmin(email) ? 'flex' : 'none';
}

// Enrollment type display name map — populated at runtime from enrollment_types table.
// Keys are camelCase DB values; values are human-readable display names.
// Falls back to the key itself if not yet loaded.
const BVP_ENROLL_DISPLAY = {
  'OpenEnrollment':          'Open Enrollment',
  'Underwritten':            'Underwritten',
  'FederalGuaranteedIssue':  'Federal Guaranteed Issue',
  'StateGuaranteedIssue':    'State Guaranteed Issue',
  'Disabled':                'Disabled',
};

// Fetches enrollment_types from Supabase and updates BVP_ENROLL_DISPLAY with DB display_names.
// Call once at app init. Safe to call multiple times.
async function bvpLoadEnrollmentTypes() {
  const { data, error } = await bvp.from('enrollment_types').select('name, display_name');
  if (error) { console.warn('bvpLoadEnrollmentTypes:', error); return; }
  data.forEach(row => {
    if (row.display_name) BVP_ENROLL_DISPLAY[row.name] = row.display_name;
  });
}

// Returns the human-readable display name for an enrollment type key.
function bvpEnrollDisplay(key) {
  return BVP_ENROLL_DISPLAY[key] || key;
}

// Maps a policy's plan_type string to the commission_rates plan key.
// Keys match the plans table: 'A', 'F', 'G', 'HD F', 'HD G', 'N'
// Falls back to 'G' (most common) when plan_type is missing or unrecognized.
function bvpNormalizePlan(planType) {
  if (!planType) return 'G';
  const p = planType.trim().toUpperCase();
  if (p === 'A'    || p === 'PLAN A')                                                  return 'A';
  if (p === 'F'    || p === 'PLAN F')                                                  return 'F';
  if (p === 'G'    || p === 'PLAN G')                                                  return 'G';
  if (p === 'N'    || p === 'PLAN N')                                                  return 'N';
  if (p === 'HD F' || p === 'PLAN HD F' || p === 'HDF' || p === 'HIGH DEDUCTIBLE F')  return 'HD F';
  if (p === 'HD G' || p === 'PLAN HD G' || p === 'HDG' || p === 'HIGH DEDUCTIBLE G')  return 'HD G';
  return 'G';
}

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

async function bvpUploadBook(agentId, fileName, policies, mode = 'version', versionName = null, agentEmail = null) {
  let bookId;
  let isNewBook = false;
  let previousCount = 0;

  if (mode === 'append') {
    const active = await bvpGetActiveBook(agentId);
    if (!active) { console.error('bvpUploadBook: no active book to append to'); return null; }
    bookId = active.id;
    previousCount = active.policy_count || 0;
    // NOTE: policy_count is finalized below, only after every row is confirmed inserted.
  } else {
    await bvp.from('books').update({ is_active: false }).eq('agent_id', agentId);
    const { data: book, error } = await bvp.from('books').insert({
      agent_id:     agentId,
      agent_email:  agentEmail || null,
      file_name:    fileName,
      version_name: versionName || fileName,
      is_active:    true,
      policy_count: 0, // placeholder — set to the real inserted count once the loop below succeeds
    }).select().single();
    if (error) { console.error('bvpUploadBook insert book error:', error); throw new Error('Book insert failed: ' + (error.message || JSON.stringify(error))); }
    bookId = book.id;
    isNewBook = true;

    // Fresh replace — clear any stale rows before inserting the new set
    await bvp.from('policies').delete().eq('book_id', bookId);
  }

  // Insert in chunks, tracking exactly which rows land (by id) so a failed
  // chunk can be rolled back precisely instead of leaving a partial book.
  const CHUNK = 100;
  const insertedIds = [];
  for (let i = 0; i < policies.length; i += CHUNK) {
    const chunk = policies.slice(i, i + CHUNK).map(p => ({ ...p, book_id: bookId, agent_id: agentId }));
    const { data, error } = await bvp.from('policies').insert(chunk).select('id');
    if (error) {
      console.error(`bvpUploadBook: chunk at rows ${i}-${i + chunk.length - 1} failed —`, error);

      // Roll back only the rows THIS call inserted — never touch pre-existing data.
      if (insertedIds.length > 0) {
        await bvp.from('policies').delete().in('id', insertedIds);
      }
      if (isNewBook) {
        // The book has no valid data at all — remove the orphaned row entirely
        // rather than leaving a book stuck at policy_count: 0 with no policies.
        await bvp.from('books').delete().eq('id', bookId);
      }
      // (append mode: existing book/count is left untouched since nothing was added)

      return null;
    }
    (data || []).forEach(r => insertedIds.push(r.id));
  }

  // Every row is confirmed committed — now it's safe to record the real count.
  if (mode === 'append') {
    await bvp.from('books').update({
      policy_count: previousCount + insertedIds.length,
      uploaded_at:  new Date().toISOString(),
      ...(agentEmail ? { agent_email: agentEmail } : {}),
    }).eq('id', bookId);
  } else {
    await bvp.from('books').update({ policy_count: insertedIds.length }).eq('id', bookId);
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

// ── COMMISSION RATES ──────────────────────────────────────────

// Returns commission rates from commission_rates table.
// Fetches system defaults (agent_id IS NULL) + agent overrides for the given agentId.
// Optionally scoped to specific states and/or carriers for performance.
async function bvpGetCommissionRates(agentId, states = null, carriers = null) {
  async function fetchAll(baseQuery) {
    const PAGE = 1000;
    let allRows = [], from = 0;
    while (true) {
      const { data, error } = await baseQuery.range(from, from + PAGE - 1);
      if (error) { console.error('bvpGetCommissionRates fetchAll:', error); break; }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return allRows;
  }

  // System defaults: agent_id IS NULL
  // When scoping by state, we use an OR filter so that Generic carrier rows
  // (which provide universal fallback rates) are always included alongside
  // state-specific rows, regardless of which states are requested.
  let defaultQ = bvp.from('commission_rates').select('*')
    .is('agent_id', null)
    .order('carrier').order('issued_state').order('plan').order('enrollment_type').order('duration_yr');
  if (states && states.length) {
    // Fetch rows where issued_state is in the book's states OR carrier is Generic
    defaultQ = defaultQ.or(`issued_state.in.(${states.join(',')}),carrier.eq.Generic`);
  }
  if (carriers && carriers.length) {
    defaultQ = defaultQ.in('carrier', [...carriers, 'Generic']);
  }

  // Agent overrides: rows belonging to this agent
  let overrideQ = bvp.from('commission_rates').select('*')
    .eq('agent_id', agentId)
    .order('carrier').order('issued_state').order('plan').order('enrollment_type').order('duration_yr');
  if (states && states.length) {
    overrideQ = overrideQ.or(`issued_state.in.(${states.join(',')}),carrier.eq.Generic`);
  }
  if (carriers && carriers.length) {
    overrideQ = overrideQ.in('carrier', [...carriers, 'Generic']);
  }

  const [defaults, overrides] = await Promise.all([fetchAll(defaultQ), fetchAll(overrideQ)]);
  const combined = [...defaults, ...overrides];

  if (combined.length === 0) {
    console.warn('bvpGetCommissionRates: no data returned — check RLS on commission_rates table');
  }
  return combined;
}

// Save an agent override rate into commission_rates
async function bvpSetCommissionRate(agentId, carrier, state, plan, enrollmentType, durationYr, rate) {
  const { error } = await bvp.from('commission_rates').upsert({
    agent_id:        agentId,
    carrier:         carrier,
    carrier_code:    0,
    issued_state:    state,
    gi_state:        false,
    plan:            plan,
    enrollment_type: enrollmentType,
    duration_yr:     durationYr,
    rate:            rate,
  }, { onConflict: 'carrier,issued_state,plan,enrollment_type,duration_yr,agent_id' });
  if (error) { console.error('bvpSetCommissionRate:', error); return false; }
  return true;
}

// Delete agent overrides — falls back to system defaults automatically.
// Pass durationYr=null to reset ALL durations for the carrier/state/plan/enrollmentType.
async function bvpResetCommissionRate(agentId, carrier, state, plan, enrollmentType, durationYr = null) {
  let q = bvp.from('commission_rates').delete()
    .eq('agent_id', agentId).eq('carrier', carrier).eq('issued_state', state)
    .eq('plan', plan).eq('enrollment_type', enrollmentType);
  if (durationYr !== null) q = q.eq('duration_yr', durationYr);
  const { error } = await q;
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
  // Collect unique states + carriers from the book for a scoped fetch
  const states   = [...new Set(policies.map(p => p.issued_state).filter(Boolean))];
  const carriers = [...new Set(policies.map(p => p.company).filter(Boolean))];

  const comms = await bvpGetCommissionRates(agentId, states, carriers);

  // Rate lookup: carrier + state + plan + enrollment_type → 11-element rate array
  // Fallback chain: exact carrier+state → carrier+any state → Generic+state → Generic+any
  // NPV calculations use only years 1-11 (indices 0-10); data goes to 20 but we cap at 11.
  function getRates(carrier, state, plan, enrollmentType) {
    const attempts = [
      r => r.carrier === carrier  && r.issued_state === state && r.plan === plan && r.enrollment_type === enrollmentType,
      r => r.carrier === carrier  && r.issued_state === state && r.plan === plan,
      r => r.carrier === carrier  && r.plan === plan          && r.enrollment_type === enrollmentType,
      r => r.carrier === carrier  && r.plan === plan,
      r => r.carrier === 'Generic' && r.issued_state === state && r.plan === plan && r.enrollment_type === enrollmentType,
      r => r.carrier === 'Generic' && r.plan === plan          && r.enrollment_type === enrollmentType,
      r => r.carrier === 'Generic' && r.plan === plan,
    ];
    for (const match of attempts) {
      const rows = comms.filter(match);
      if (rows.length > 0) {
        // Build 11-slot array (NPV window). Data has 20 yrs; we only need 1-11.
        const rates = Array(11).fill(0);
        rows.forEach(r => {
          const idx = (r.duration_yr || 1) - 1;
          if (idx >= 0 && idx < 11) rates[idx] = parseFloat(r.rate) || 0;
        });
        if (rates.some(r => r > 0)) return rates;
      }
    }
    console.warn('bvpEnrichPolicies: no rates found for', carrier, state, plan, enrollmentType);
    return Array(11).fill(0);
  }

  const VALUATION_MONTH = new Date().getMonth() + 1;

  return policies.map(p => {
    const carrier      = p.company      || 'Generic';
    const state        = p.issued_state || null;
    const durYr        = p.duration_yr  || 1;
    const effMonth     = p.eff_month    || null;
    const commPrem     = p.comm_prem    || 0;
    const currPrem     = p.curr_prem    || 0;
    const plan         = bvpNormalizePlan(p.plan_type);
    const enrollType   = 'OpenEnrollment'; // enrollment type stored on policy; default to OE

    const premMulti      = p.prem_mode === 'monthly' ? 12 : p.prem_mode === 'quarterly' ? 4 : 1;
    const annualCurrPrem = currPrem * premMulti;
    const annualCommPrem = commPrem * premMulti;

    const currRates = getRates(carrier, state, plan, enrollType);

    const curr_npv = bvpCalcCurrentNPV(annualCommPrem, durYr, effMonth, currRates, discountPct);

    // Renewal NPV: agent-entered renewal carrier/prem takes priority over savings % estimate.
    // Renewal restarts at duration 1 rates, same plan and enrollment type.
    let ren_npv;
    if (p.ren_carrier && p.ren_prem != null) {
      const renRates      = getRates(p.ren_carrier, state, plan, enrollType);
      const alreadyRenewed = effMonth !== null && effMonth <= VALUATION_MONTH;
      const r = discountPct / 100;
      let npv = 0;
      for (let i = 0; i < 11; i++) {
        const rate = alreadyRenewed
          ? (i === 0 ? 0 : (renRates[Math.min(i - 1, 10)] || 0))
          : (renRates[Math.min(i, 10)] || 0);
        npv += (p.ren_prem * rate) / Math.pow(1 + r, i + 1);
      }
      ren_npv = npv * 12;
    } else {
      const renRates = getRates(carrier, state, plan, enrollType);
      ren_npv = bvpCalcRenewalNPV(annualCurrPrem, savingsPct, effMonth, renRates, discountPct);
    }

    // Build offset arrays for dashboard engine
    const alreadyRenewed = effMonth !== null && effMonth <= VALUATION_MONTH;
    const nextDur        = durYr + 1;

    // renRatesForOffset: use agent-set renewal carrier if available, else current carrier
    const renRatesForOffset = (p.ren_carrier && p.ren_prem != null)
      ? getRates(p.ren_carrier, state, plan, enrollType)
      : getRates(carrier, state, plan, enrollType);

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

// ── KNOWLEDGE BASE ────────────────────────────────────────────
// Fetches relevant knowledge documents for the AI agent.
// Optionally filter by state and/or carrier to narrow results.
// Returns up to `limit` most recent documents.

async function bvpGetKnowledge(options = {}) {
  const { state = null, carrier = null, category = null, limit = 10 } = options;

  let query = bvp
    .from('knowledge_documents')
    .select('id, title, category, state, carrier, effective_date, summary, file_name')
    .order('effective_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (state)    query = query.or(`state.eq.${state},state.is.null`);
  if (carrier)  query = query.eq('carrier', carrier);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) { console.error('bvpGetKnowledge:', error); return []; }
  return data || [];
}

// Fetches all knowledge docs relevant to an agent's book —
// matches states and carriers present in their policies.
async function bvpGetKnowledgeForBook(agentId) {
  const book = await bvpGetActiveBook(agentId);
  if (!book) return [];

  const policies = await bvpGetPolicies(book.id);

  // Collect unique states and carriers from the book
  const states   = [...new Set(policies.map(p => p.issued_state).filter(Boolean))];
  const carriers = [...new Set(policies.map(p => p.company).filter(Boolean))];

  // Fetch knowledge docs — national docs (state IS NULL) always included
  let query = bvp
    .from('knowledge_documents')
    .select('id, title, category, state, carrier, effective_date, summary, file_name')
    .order('effective_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(20);

  // Filter: state matches agent's states OR is null (national)
  if (states.length > 0) {
    query = query.or(`state.in.(${states.join(',')}),state.is.null`);
  }

  const { data, error } = await query;
  if (error) { console.error('bvpGetKnowledgeForBook:', error); return []; }

  // Further filter by carrier relevance in JS (Supabase OR across two columns is tricky)
  return (data || []).filter(doc =>
    !doc.carrier || carriers.includes(doc.carrier)
  );
}

// ── KNOWLEDGE BASE ────────────────────────────────────────────
// Fetches relevant knowledge documents for the AI agent.
// Optionally filter by state and/or carrier to narrow results.
// Returns up to `limit` most recent documents.

async function bvpGetKnowledge(options = {}) {
  const { state = null, carrier = null, category = null, limit = 10 } = options;

  let query = bvp
    .from('knowledge_documents')
    .select('id, title, category, state, carrier, effective_date, summary, file_name')
    .order('effective_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (state)    query = query.or(`state.eq.${state},state.is.null`);
  if (carrier)  query = query.eq('carrier', carrier);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) { console.error('bvpGetKnowledge:', error); return []; }
  return data || [];
}

// Fetches all knowledge docs relevant to an agent's book —
// matches states and carriers present in their policies.
async function bvpGetKnowledgeForBook(agentId) {
  const book = await bvpGetActiveBook(agentId);
  if (!book) return [];

  const policies = await bvpGetPolicies(book.id);

  // Collect unique states and carriers from the book
  const states   = [...new Set(policies.map(p => p.issued_state).filter(Boolean))];
  const carriers = [...new Set(policies.map(p => p.company).filter(Boolean))];

  // Fetch knowledge docs — national docs (state IS NULL) always included
  let query = bvp
    .from('knowledge_documents')
    .select('id, title, category, state, carrier, effective_date, summary, file_name')
    .order('effective_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(20);

  // Filter: state matches agent's states OR is null (national)
  if (states.length > 0) {
    query = query.or(`state.in.(${states.join(',')}),state.is.null`);
  }

  const { data, error } = await query;
  if (error) { console.error('bvpGetKnowledgeForBook:', error); return []; }

  // Further filter by carrier relevance in JS (Supabase OR across two columns is tricky)
  return (data || []).filter(doc =>
    !doc.carrier || carriers.includes(doc.carrier)
  );
}

// ── LEADS / PROSPECTS ─────────────────────────────────────────────────
// Fully separate from `policies`/`books` — leads are agent-entered prospects
// that have not (yet) become a client. See bvp_leads_schema.sql.

const BVP_LEAD_STAGES = ['new', 'contacted', 'quoted', 'won', 'lost'];

const BVP_LEAD_STAGE_LABELS = {
  new:       'New',
  contacted: 'Contacted',
  quoted:    'Quoted',
  won:       'Won',
  lost:      'Lost',
};

const BVP_LEAD_SOURCES = [
  'Referral', 'Cold Call', 'Web Form', 'Event', 'Purchased List', 'Other',
];

// Fetches all leads for an agent, newest first.
async function bvpGetLeads(agentId) {
  const { data, error } = await bvp
    .from('leads')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  if (error) { console.error('bvpGetLeads:', error); return []; }
  return data || [];
}

// Fetches only open (non-terminal) leads — used by the Outreach page.
async function bvpGetOpenLeads(agentId) {
  const { data, error } = await bvp
    .from('leads')
    .select('*')
    .eq('agent_id', agentId)
    .not('stage', 'in', '(won,lost)')
    .order('next_follow_up', { ascending: true, nullsFirst: false });
  if (error) { console.error('bvpGetOpenLeads:', error); return []; }
  return data || [];
}

async function bvpGetLead(leadId) {
  const { data, error } = await bvp.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (error) { console.error('bvpGetLead:', error); return null; }
  return data;
}

// Creates a new lead. `fields` may include any column from the leads table.
async function bvpCreateLead(agentId, agentEmail, fields) {
  const { data, error } = await bvp.from('leads').insert({
    agent_id:    agentId,
    agent_email: agentEmail || null,
    stage:       'new',
    ...fields,
  }).select().single();
  if (error) { console.error('bvpCreateLead:', error); return null; }
  return data;
}

// Updates arbitrary fields on a lead (e.g. contact info, notes, next_follow_up).
async function bvpUpdateLead(leadId, fields) {
  const { data, error } = await bvp.from('leads').update(fields).eq('id', leadId).select().single();
  if (error) { console.error('bvpUpdateLead:', error); return null; }
  return data;
}

async function bvpDeleteLead(leadId) {
  const { error } = await bvp.from('leads').delete().eq('id', leadId);
  if (error) { console.error('bvpDeleteLead:', error); return false; }
  return true;
}

// Moves a lead to a new pipeline stage, stamps last_contacted_at when moving
// out of "new", and logs the transition to lead_activity.
async function bvpAdvanceLeadStage(leadId, fromStage, toStage, agentEmail, note = null) {
  const updates = { stage: toStage };
  if (toStage !== 'new') updates.last_contacted_at = new Date().toISOString();
  if (toStage === 'won')  updates.converted_at = new Date().toISOString();

  const { data, error } = await bvp.from('leads').update(updates).eq('id', leadId).select().single();
  if (error) { console.error('bvpAdvanceLeadStage:', error); return null; }

  await bvpLogLeadActivity(leadId, agentEmail, 'stage_change', { fromStage, toStage, note });
  return data;
}

// Logs a touch (call/email/note) against a lead without changing its stage,
// and bumps last_contacted_at so staleness sorting on Outreach stays accurate.
async function bvpLogLeadContact(leadId, agentEmail, activityType, note = null) {
  await bvp.from('leads').update({ last_contacted_at: new Date().toISOString() }).eq('id', leadId);
  return bvpLogLeadActivity(leadId, agentEmail, activityType, { note });
}

async function bvpLogLeadActivity(leadId, agentEmail, activityType, { fromStage = null, toStage = null, note = null } = {}) {
  const { error } = await bvp.from('lead_activity').insert({
    lead_id:       leadId,
    agent_email:   agentEmail || null,
    activity_type: activityType,
    from_stage:    fromStage,
    to_stage:      toStage,
    note,
  });
  if (error) console.error('bvpLogLeadActivity:', error);
}

async function bvpGetLeadActivity(leadId) {
  const { data, error } = await bvp
    .from('lead_activity')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) { console.error('bvpGetLeadActivity:', error); return []; }
  return data || [];
}

// Days since the lead was last contacted (falls back to created_at for
// leads that have never been touched). Used to sort/flag stale leads.
function bvpLeadStaleDays(lead) {
  const ref = lead.last_contacted_at || lead.created_at;
  if (!ref) return null;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
}
