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
async function bvpRequireAuth() {
  const { data: { session } } = await bvp.auth.getSession();
  if (!session) { window.location.href = 'bookvaluepro-login.html'; return null; }
  return session;
}

async function bvpSignOut() {
  await bvp.auth.signOut();
  window.location.href = 'bookvaluepro-login.html';
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

// mode: 'append' adds to current active book
// mode: 'version' creates a new named version (new active book)
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
    // Deactivate existing books, create new version
    await bvp.from('books').update({ is_active: false }).eq('agent_id', agentId);
    const { data: book, error } = await bvp.from('books').insert({
      agent_id:     agentId,
      file_name:    fileName,
      version_name: versionName || fileName,
      is_active:    true,
      policy_count: policies.length,
    }).select().single();
    if (error) { console.error('bvpUploadBook insert book:', error); return null; }
    bookId = book.id;
  }

  // Bulk insert in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < policies.length; i += CHUNK) {
    const chunk = policies.slice(i, i + CHUNK).map(p => ({ ...p, book_id: bookId, agent_id: agentId }));
    const { error } = await bvp.from('policies').insert(chunk);
    if (error) { console.error('bvpUploadBook policies chunk:', error); return null; }
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

// Returns merged commission schedule — agent overrides win over system defaults
async function bvpGetCommissions(agentId, state = null, carrier = null) {
  let query = bvp.from('commissions').select('*')
    .or(`is_default.eq.true,agent_id.eq.${agentId}`)
    .order('issued_state').order('carrier').order('enrollment_type').order('duration_yr');
  if (state)   query = query.eq('issued_state', state);
  if (carrier) query = query.eq('carrier', carrier);
  const { data, error } = await query;
  if (error) { console.error('bvpGetCommissions:', error); return []; }

  // Agent overrides replace defaults for same key
  const map = new Map();
  data.filter(r => r.is_default).forEach(r => {
    map.set(`${r.issued_state}|${r.carrier}|${r.enrollment_type}|${r.duration_yr}`, r);
  });
  data.filter(r => !r.is_default && r.agent_id === agentId).forEach(r => {
    map.set(`${r.issued_state}|${r.carrier}|${r.enrollment_type}|${r.duration_yr}`, r);
  });
  return Array.from(map.values())
    .sort((a,b) => `${a.issued_state}${a.carrier}${a.enrollment_type}${a.duration_yr}`
      .localeCompare(`${b.issued_state}${b.carrier}${b.enrollment_type}${b.duration_yr}`));
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
    const durIdx = Math.min(currentDurationYr - 1 + i, 10); // 0-indexed, cap at 10
    const rate = commRates[durIdx] || 0;
    npv += (commPrem * rate) / Math.pow(1 + r, i + 1);
  }
  return npv * 12; // monthly → annual
}

function bvpCalcRenewalNPV(currPrem, savingsPct, commRates, discountPct = 10) {
  const r = discountPct / 100;
  const newPrem = currPrem * (1 - savingsPct / 100);
  let npv = 0;
  for (let i = 0; i < 11; i++) {
    const rate = commRates[i] || 0; // always restarts at duration 1
    npv += (newPrem * rate) / Math.pow(1 + r, i + 1);
  }
  return npv * 12;
}
