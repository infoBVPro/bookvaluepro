// bvp-chat.js — BookValuePro AI Chat Bar v2
// Include AFTER bvp-supabase.js: <script src="bvp-chat.js"></script>

(function () {

  const BVP_CHAT_PROXY = 'https://wspxgkbcdkvlripmvnjh.supabase.co/functions/v1/bvp-chat';

  // 'uw' on the Underwriting Assistant page: the bar becomes the UW Assistant and
  // answers only from the underwriting data loaded in BookValuePro.
  // A page can force a mode with window.BVP_CHAT_MODE = 'uw' | 'book'.
  const CHAT_MODE = window.BVP_CHAT_MODE || (/uw-assistant/i.test(location.pathname) ? 'uw' : 'book');
  const IS_UW = CHAT_MODE === 'uw';
  const CHAT_NAME = IS_UW ? 'UW Assistant' : 'BVP Assistant';
  const CHAT_PLACEHOLDER = IS_UW
    ? 'Ask an underwriting question — e.g. "Does Aetna decline COPD in Texas?"'
    : 'Ask about your book, rate increases, regulations…';
  const CHAT_GREETING = IS_UW
    ? "Hi! I'm the UW Assistant. Ask me about a carrier's underwriting rules — conditions, medications, height/weight, lookback periods, where a carrier is offered, or state guaranteed-issue rights. I answer only from the applications and underwriting guides loaded into BookValuePro."
    : "Hi! I'm your BVP Assistant. Ask me anything about your Medicare Supplement book of business, carrier rate changes, or state regulations.";

  const style = document.createElement('style');
  style.textContent = `
    #bvp-chat-bar {
      background: #f0f7f3; border-bottom: 1px solid #c8e6d4;
      padding: 0 2rem; display: flex; align-items: center; gap: 12px;
      height: 52px; position: sticky; top: 64px; z-index: 99;
      font-family: 'DM Sans', sans-serif;
    }
    #bvp-chat-bar-icon {
      width: 28px; height: 28px; border-radius: 50%; background: #1a5c3e;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    #bvp-chat-bar-icon svg { width: 15px; height: 15px; fill: white; }
    #bvp-chat-bar-label { font-size: 12px; font-weight: 600; color: #1a5c3e; white-space: nowrap; flex-shrink: 0; }
    #bvp-chat-bar-input {
      flex: 1; border: 1.5px solid #c8e6d4; border-radius: 8px; padding: 7px 14px;
      font-size: 13.5px; font-family: 'DM Sans', sans-serif; outline: none;
      background: white; color: #0f1214; transition: border-color 0.15s, box-shadow 0.15s; min-width: 0;
    }
    #bvp-chat-bar-input:focus { border-color: #1a5c3e; box-shadow: 0 0 0 3px rgba(26,92,62,0.08); }
    #bvp-chat-bar-input::placeholder { color: #7a8290; }
    #bvp-chat-bar-send {
      background: #1a5c3e; border: none; border-radius: 8px; width: 34px; height: 34px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background 0.15s;
    }
    #bvp-chat-bar-send:hover { background: #2a8558; }
    #bvp-chat-bar-send:disabled { background: #b0c4b8; cursor: not-allowed; }
    #bvp-chat-bar-send svg { width: 15px; height: 15px; fill: white; }
    #bvp-chat-panel {
      position: fixed; top: 116px; left: 0; right: 0; z-index: 98;
      display: flex; justify-content: center; pointer-events: none;
    }
    #bvp-chat-panel-inner {
      background: white; border: 1px solid #c8e6d4; border-top: none;
      border-radius: 0 0 16px 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.12);
      width: 100%; max-width: 860px; max-height: 480px;
      display: flex; flex-direction: column; overflow: hidden;
      font-family: 'DM Sans', sans-serif; pointer-events: none;
      opacity: 0; transform: translateY(-8px); transition: opacity 0.2s, transform 0.2s;
    }
    #bvp-chat-panel-inner.open { opacity: 1; transform: translateY(0); pointer-events: all; }
    #bvp-chat-messages {
      flex: 1; overflow-y: auto; padding: 20px 24px;
      display: flex; flex-direction: column; gap: 14px; background: #f7f4ef;
    }
    .bvp-msg { display: flex; flex-direction: column; max-width: 80%; }
    .bvp-msg.user    { align-self: flex-end;   align-items: flex-end; }
    .bvp-msg.assistant { align-self: flex-start; align-items: flex-start; }
    .bvp-msg-bubble { padding: 10px 16px; border-radius: 12px; font-size: 13.5px; line-height: 1.6; }
    .bvp-msg.user .bvp-msg-bubble { background: #1a5c3e; color: white; border-bottom-right-radius: 4px; }
    .bvp-msg.assistant .bvp-msg-bubble { background: white; color: #0f1214; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .bvp-msg-sender { font-size: 11px; color: #7a8290; margin-bottom: 4px; font-family: 'DM Mono', monospace; }
    .bvp-typing {
      display: flex; align-items: center; gap: 4px; padding: 10px 14px;
      background: white; border-radius: 12px; border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07); align-self: flex-start;
    }
    .bvp-typing span { width: 7px; height: 7px; background: #3da272; border-radius: 50%; animation: bvp-bounce 1.2s infinite; }
    .bvp-typing span:nth-child(2) { animation-delay: 0.2s; }
    .bvp-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bvp-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
    #bvp-chat-suggestions {
      display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 24px;
      background: #f7f4ef; border-top: 1px solid #ede9e2;
    }
    .bvp-suggestion {
      background: white; border: 1.5px solid #c8e6d4; border-radius: 20px;
      padding: 5px 14px; font-size: 12px; color: #1a5c3e; cursor: pointer;
      font-family: 'DM Sans', sans-serif; transition: border-color 0.15s, background 0.15s; white-space: nowrap;
    }
    .bvp-suggestion:hover { border-color: #1a5c3e; background: #e8f5ee; }
    #bvp-chat-panel-footer {
      padding: 10px 24px; background: white; border-top: 1px solid #ede9e2;
      display: flex; align-items: center; justify-content: space-between;
    }
    #bvp-chat-clear, #bvp-chat-close-panel {
      font-size: 12px; color: #7a8290; background: none; border: none;
      cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 4px 0; transition: color 0.15s;
    }
    #bvp-chat-clear:hover { color: #c0392b; }
    #bvp-chat-close-panel:hover { color: #0f1214; }
    #bvp-chat-overlay {
      display: none; position: fixed; inset: 0; z-index: 97;
      background: rgba(7,22,13,0.25); cursor: pointer;
    }
    #bvp-chat-overlay.active { display: block; }
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'bvp-chat-bar';
  bar.innerHTML = `
    <div id="bvp-chat-bar-icon">
      <svg viewBox="0 0 24 24"><path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </div>
    <span id="bvp-chat-bar-label">${CHAT_NAME}</span>
    <input id="bvp-chat-bar-input" type="text" placeholder="${CHAT_PLACEHOLDER.replace(/"/g, '&quot;')}" autocomplete="off" />
    <button id="bvp-chat-bar-send" title="Send">
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  `;

  const panel = document.createElement('div');
  panel.id = 'bvp-chat-panel';
  panel.innerHTML = `
    <div id="bvp-chat-panel-inner">
      <div id="bvp-chat-messages"></div>
      <div id="bvp-chat-suggestions"></div>
      <div id="bvp-chat-panel-footer">
        <button id="bvp-chat-clear">Clear conversation</button>
        <button id="bvp-chat-close-panel">Close ✕</button>
      </div>
    </div>
  `;

  const overlay = document.createElement('div');
  overlay.id = 'bvp-chat-overlay';

  function mount() {
    const header = document.querySelector('.bvp-header') || document.querySelector('header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(bar, header.nextSibling);
    } else {
      document.body.insertBefore(bar, document.body.firstChild);
    }
    document.body.appendChild(panel);
    document.body.appendChild(overlay);
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  let isOpen = false, isLoading = false;
  const history = [];

  const SUGGESTIONS = IS_UW ? [
    'Which carriers accept atrial fibrillation?',
    'Does Mutual of Omaha decline COPD in Texas?',
    'What is the cancer lookback for each carrier?',
    'Is Eliquis a problem for Humana?',
    'What are the GI rights in California?',
  ] : [
    'Who are my Priority 1 clients?',
    'Any upcoming rate increases?',
    'Which clients renew next month?',
    'Show my top NPV policies',
    'Any state regulation updates?',
  ];

  function init() {
    const sugEl = document.getElementById('bvp-chat-suggestions');
    SUGGESTIONS.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'bvp-suggestion';
      btn.textContent = s;
      btn.onclick = () => { openPanel(); sendMessage(s); };
      sugEl.appendChild(btn);
    });
    const input = document.getElementById('bvp-chat-bar-input');
    input.addEventListener('focus', openPanel);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); triggerSend(); }
      if (e.key === 'Escape') closePanel();
    });
    document.getElementById('bvp-chat-bar-send').addEventListener('click', triggerSend);
    document.getElementById('bvp-chat-close-panel').addEventListener('click', closePanel);
    document.getElementById('bvp-chat-clear').addEventListener('click', clearConversation);
    document.getElementById('bvp-chat-overlay').addEventListener('click', closePanel);

    // Close panel when clicking outside the chat bar or panel (bubble phase, not capture)
    document.addEventListener('mousedown', function(e) {
      if (!isOpen) return;
      const barEl   = document.getElementById('bvp-chat-bar');
      const panelEl = document.getElementById('bvp-chat-panel-inner');
      if (barEl && barEl.contains(e.target)) return;
      if (panelEl && panelEl.contains(e.target)) return;
      closePanel();
    });
  }

  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    document.getElementById('bvp-chat-panel-inner').classList.add('open');
    document.getElementById('bvp-chat-overlay').classList.add('active');
    if (history.length === 0) {
      addMessage('assistant', CHAT_GREETING);
    }
  }

  function closePanel() {
    isOpen = false;
    document.getElementById('bvp-chat-panel-inner').classList.remove('open');
    document.getElementById('bvp-chat-overlay').classList.remove('active');
  }

  function clearConversation() {
    history.length = 0;
    document.getElementById('bvp-chat-messages').innerHTML = '';
    document.getElementById('bvp-chat-suggestions').style.display = 'flex';
    addMessage('assistant', 'Conversation cleared. What would you like to know?');
  }

  function triggerSend() {
    const input = document.getElementById('bvp-chat-bar-input');
    const text = input.value.trim();
    if (!text || isLoading) return;
    input.value = '';
    openPanel();
    sendMessage(text);
  }

  async function sendMessage(text) {
    if (isLoading) return;
    isLoading = true;
    document.getElementById('bvp-chat-bar-send').disabled = true;
    document.getElementById('bvp-chat-suggestions').style.display = 'none';

    addMessage('user', text);
    history.push({ role: 'user', content: text });
    showTyping();

    try {
      const { data: { session } } = await bvp.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      if (IS_UW) {
        const uwPrompt = await buildUWPrompt(text);
        const r = await fetch(BVP_CHAT_PROXY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ system: uwPrompt, messages: history }),
        });
        const d = await r.json();
        const uwReply = d.content?.[0]?.text || 'Sorry, I had trouble responding. Please try again.';
        hideTyping();
        addMessage('assistant', uwReply);
        history.push({ role: 'assistant', content: uwReply });
        isLoading = false;
        document.getElementById('bvp-chat-bar-send').disabled = false;
        return;
      }
      // When an agency owner is viewing an agent's book, answer about that book.
      const agentId = (typeof BVP_VIEW_AGENT_ID !== 'undefined' && BVP_VIEW_AGENT_ID) || session.user.id;
      const accessToken = session.access_token;

      const [book, knowledgeDocs] = await Promise.all([
        bvpGetActiveBook(agentId),
        bvpGetKnowledgeForBook(agentId),
      ]);

      let bookContext = 'No active book of business found.';
      if (book) {
        const policies = await bvpGetPolicies(book.id);
        const enriched = await bvpEnrichPolicies(agentId, policies);
        bookContext = buildBookContext(book, enriched) + '\n\n' + buildGIContext(enriched);
      }

      const systemPrompt = `You are BVP Assistant, a specialized AI for senior health insurance agents using BookValuePro.

SCOPE — YOU ARE STRICTLY LIMITED TO:
- Medicare Supplement (Medigap) insurance
- Medicare Advantage (Part C) plans
- Supplemental health products for seniors (dental, vision, hearing, hospital indemnity, etc.)
- The agent's book of business data provided below
- Documents in the knowledge base provided below

IF ASKED ANYTHING OUTSIDE THIS SCOPE: Politely decline and say — "I'm only able to help with senior health insurance topics including Medicare Supplement, Medicare Advantage, and supplemental health products. Is there something in that area I can help you with?"

Do NOT answer questions about: general finance, investments, other insurance lines (auto, home, life), politics, technology, health topics unrelated to senior insurance products, or any other off-topic subject — even if the user insists or rephrases.

You have access to two sources of information:

--- AGENT'S BOOK OF BUSINESS ---
${bookContext}

TODAY'S DATE: ${new Date().toDateString()}

--- KNOWLEDGE BASE (regulations, rate increases, carrier updates) ---
${buildKnowledgeContext(knowledgeDocs)}

Response guidelines:
- Be concise and specific — agents are busy professionals
- Use dollar amounts, policy counts, and percentages when relevant
- Flag urgent items (Priority 1 clients, imminent rate increases, upcoming renewals, GI underwrite-by deadlines)
- State GI rights: once a client's GI window is open the carrier must write the switch as guaranteed issue (usually 0% commission) and cannot underwrite. To keep full commission the agent should get an underwritten app done by the "underwrite by" date (30 days before the window opens). If the client is declined, the GI window is the fallback.
- If a question is within scope but not answerable, say so clearly
- Format lists cleanly when comparing clients or policies
- Never mention, cite, or refer to your source materials, the knowledge base, the book of business data, or any internal context — just answer naturally as if you know the information`;

      const response = await fetch(BVP_CHAT_PROXY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: history,
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || 'Sorry, I had trouble responding. Please try again.';

      hideTyping();
      addMessage('assistant', reply);
      history.push({ role: 'assistant', content: reply });

    } catch (err) {
      console.error('BVP Chat error:', err);
      hideTyping();
      addMessage('assistant', 'Sorry, something went wrong. Please try again in a moment.');
    }

    isLoading = false;
    document.getElementById('bvp-chat-bar-send').disabled = false;
  }

  function addMessage(role, content) {
    const el = document.getElementById('bvp-chat-messages');
    const msg = document.createElement('div');
    msg.className = `bvp-msg ${role}`;
    msg.innerHTML = `
      <div class="bvp-msg-sender">${role === 'user' ? 'You' : CHAT_NAME}</div>
      <div class="bvp-msg-bubble">${escapeHtml(content)}</div>
    `;
    el.appendChild(msg);
    el.scrollTop = el.scrollHeight;
  }

  function showTyping() {
    const el = document.getElementById('bvp-chat-messages');
    const t = document.createElement('div');
    t.className = 'bvp-typing'; t.id = 'bvp-typing-indicator';
    t.innerHTML = '<span></span><span></span><span></span>';
    el.appendChild(t);
    el.scrollTop = el.scrollHeight;
  }

  function hideTyping() {
    const t = document.getElementById('bvp-typing-indicator');
    if (t) t.remove();
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  // ── UW ASSISTANT (Underwriting Assistant page) ─────────────────────────────
  // Builds the system prompt from the underwriting data loaded in BookValuePro:
  // finds the carriers, state, conditions, medications, age and height/weight in
  // the question (falling back to the previous question and the page's form),
  // runs the page's own underwriting check (bvpEvaluateUW) on them, and adds the
  // matching carrier rules, availability and state GI rules. The assistant is told
  // to answer only from this data.
  let _uwChatData = null;
  async function uwChatGetData() {
    if (typeof uwData !== 'undefined' && uwData) return uwData;
    if (!_uwChatData) _uwChatData = await bvpLoadUWData();
    return _uwChatData;
  }
  const _uwEsc = t => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const _uwStrip = t => String(t == null ? '' : t).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const _uwList = v => Array.isArray(v) ? v : (typeof v === 'string' && v.trim()
    ? (() => { try { const j = JSON.parse(v); return Array.isArray(j) ? j : [v]; } catch (e) { return v.split(/[,;|]/); } })()
    : []);
  const UW_CHAT_STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
    DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
    PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
    VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  };

  // Finds terms in text. Terms of 4 letters or fewer must appear in capitals
  // (COPD, CHF, MS, TIA, INA, UHC) so ordinary words don't match. Longer matches
  // win over shorter ones inside them ("heart failure" over "heart").
  function uwFindTerms(text, entries) {
    const hits = [];
    entries.forEach(({ term, key }) => {
      const t = String(term || '').trim();
      if (t.length < 2) return;
      const short = t.replace(/[^A-Za-z0-9]/g, '').length <= 4;
      const re = new RegExp('(^|[^A-Za-z0-9])(' + _uwEsc(t) + ')(?=$|[^A-Za-z0-9])', short ? 'g' : 'gi');
      let m;
      while ((m = re.exec(text))) {
        if (short && m[2] !== m[2].toUpperCase()) continue;
        const start = m.index + m[1].length;
        hits.push({ key, start, end: start + m[2].length });
      }
    });
    hits.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    const kept = [];
    hits.forEach(h => { if (!kept.some(k => h.start >= k.start && h.end <= k.end)) kept.push(h); });
    return [...new Set(kept.map(h => h.key))];
  }

  function uwCarrierTerms(carriers) {
    const extra = {
      unitedhealthcare: ['UHC', 'United Healthcare', 'UnitedHealthcare', 'AARP'], healthspring: ['HealthSpring', 'Cigna'],
      wellabe: ['Wellabe', 'Medico'], woodmen: ['WoodmenLife', 'Woodmen'], omaha: ['Mutual of Omaha', 'MOO', 'Omaha'],
      lumos: ['Lumos', 'Plateau'], chubb: ['INA', 'Chubb'], aetna: ['Aetna', 'CVS'], physicians: ['Physicians Mutual', 'PMIC'],
      nassau: ['Nassau'], lifeshield: ['LifeShield', 'Life Shield'], humana: ['Humana'], aflac: ['AFLAC', 'Aflac', 'Tier One'],
      bankers: ['Bankers Fidelity'],
    };
    const out = [];
    carriers.forEach(name => {
      const c = (typeof BVP_CARRIERS !== 'undefined' ? BVP_CARRIERS : []).find(r => r.name === name) || { name };
      const disp = c.display_name || name;
      const terms = [name, disp, ...(c.aliases || [])];
      disp.split(/[()\/]/).forEach(p => { if (p.trim().length > 2) terms.push(p.trim()); });
      const lc = (name + ' ' + disp).toLowerCase();
      Object.keys(extra).forEach(k => { if (lc.includes(k)) terms.push(...extra[k]); });
      [...new Set(terms)].forEach(t => out.push({ term: t, key: name }));
    });
    return out;
  }

  function uwParseProfile(text) {
    const p = {};
    const age = text.match(/\bage[d]?\s*(\d{2})\b/i) || text.match(/\b(\d{2})\s*(?:-|\s)?(?:years?[- ]old|yrs?\b|y\/o|yo\b)/i);
    if (age) p.age = +age[1];
    const ht = text.match(/\b([4-7])\s*(?:'|’|ft\.?|feet|foot)\s*(\d{1,2})?\s*(?:"|”|''|in\.?|inch(?:es)?)?/i);
    if (ht) p.heightIn = (+ht[1]) * 12 + (ht[2] ? +ht[2] : 0);
    const wt = text.match(/\b(\d{2,3})\s*(?:lbs?\.?|pounds?)\b/i);
    if (wt) p.weightLb = +wt[1];
    if (/\b(female|woman|women|she|her)\b/i.test(text)) p.gender = 'F';
    else if (/\b(male|man|men|he|his|him)\b/i.test(text)) p.gender = 'M';
    return p;
  }

  async function buildUWPrompt(question) {
    const data = await uwChatGetData();
    if (typeof bvpLoadCarriers === 'function') await bvpLoadCarriers();
    const allCarriers = bvpUWCarriers();
    const prevQ = [...history].reverse().filter(m => m.role === 'user').map(m => m.content)[1] || '';   // [0] is this question

    // Conditions and medications: names + aliases from the condition and medication lists.
    const condEntries = [];
    (data.conditionList || []).forEach(c => [c.name, ..._uwList(c.aliases)].forEach(t => condEntries.push({ term: t, key: c.name })));
    const drugEntries = [];
    (data.drugList || []).forEach(d => [d.name, d.generic_name, ..._uwList(d.aliases)]
      .filter(t => t && String(t).replace(/[^A-Za-z]/g, '').length >= 4).forEach(t => drugEntries.push({ term: t, key: d.name })));
    const stateEntries = [];
    Object.entries(UW_CHAT_STATES).forEach(([code, nm]) => { stateEntries.push({ term: nm, key: code }); stateEntries.push({ term: code, key: code }); });
    const carrierEntries = uwCarrierTerms(allCarriers);

    const find = (t) => ({
      carriers: uwFindTerms(t, carrierEntries), states: uwFindTerms(t, stateEntries),
      conds: uwFindTerms(t, condEntries), drugs: uwFindTerms(t, drugEntries), profile: uwParseProfile(t),
    });
    const now = find(question), prev = prevQ ? find(prevQ) : null;
    const pageCarriers = (typeof selectedCarriers !== 'undefined') ? [...selectedCarriers] : [];
    const pageState = (document.getElementById('uw-state') || {}).value || '';
    const refersToForm = /\b(this|the|my)\s+(applicant|client|case|person|form)\b|\bthese\b|\babove\b/i.test(question);

    // Follow-up ("what about Humana?", "and in Ohio?", "is it declined?") keeps the
    // previous question's details for anything this question doesn't name.
    const followUp = !!prev && /^\s*(?:(?:what|how)\s+about|and|also|same|ok(?:ay)?,?\s+(?:what|how)\s+about)\b|\b(?:it|that|those|them|this one)\b/i.test(question);
    const fromPrev = (k) => (followUp && prev[k].length ? prev[k] : []);
    let carriers = now.carriers.length ? now.carriers : fromPrev('carriers');
    let carrierBasis = carriers.length ? (now.carriers.length ? 'named in the question' : 'from the previous question') : '';
    if (!carriers.length && pageCarriers.length && refersToForm) { carriers = pageCarriers; carrierBasis = 'selected on the page'; }
    if (!carriers.length) { carriers = allCarriers; carrierBasis = 'all carriers (none named)'; }
    const state = now.states[0] || fromPrev('states')[0] || pageState || null;
    let conds = now.conds, drugs = now.drugs, condBasis = '';
    if (!conds.length && !drugs.length) { conds = fromPrev('conds'); drugs = fromPrev('drugs'); if (conds.length || drugs.length) condBasis = ' (from the previous question)'; }
    // Broad words ("cancer", "kidney", "heart") → every listed condition containing that word.
    if (!conds.length && !drugs.length) {
      const stop = new Set(['carrier', 'carriers', 'which', 'what', 'about', 'there', 'their', 'would', 'could', 'should', 'decline', 'declines',
        'declined', 'accept', 'accepts', 'review', 'rules', 'lookback', 'years', 'state', 'states', 'rights', 'other', 'every', 'these', 'those',
        'question', 'questions', 'application', 'applicant', 'client', 'medicare', 'supplement', 'underwriting', 'mutual', 'national', 'disease']);
      const words = [...new Set((question.toLowerCase().match(/[a-z]{5,}/g) || []).filter(w => !stop.has(w)
        && !carrierEntries.some(e => String(e.term).toLowerCase().includes(w)) && !Object.values(UW_CHAT_STATES).some(n => n.toLowerCase().includes(w))))];
      const kw = [];
      words.forEach(w => (data.conditionList || []).forEach(c => {
        if (new RegExp('\\b' + _uwEsc(w), 'i').test(c.name) && !kw.includes(c.name)) kw.push(c.name);
      }));
      if (kw.length) { conds = kw.slice(0, 15); condBasis = ` (listed conditions containing "${words.filter(w => kw.some(n => n.toLowerCase().includes(w))).join('", "')}")`; }
    }
    if (refersToForm) {
      if (typeof selectedConditions !== 'undefined') conds = [...new Set([...conds, ...selectedConditions])];
      if (typeof selectedDrugs !== 'undefined') drugs = [...new Set([...drugs, ...selectedDrugs])];
    }
    const prof = Object.assign({}, prev ? prev.profile : {}, now.profile);
    if (refersToForm) {
      const g = id => (document.getElementById(id) || {}).value;
      if (!prof.age && +g('uw-age')) prof.age = +g('uw-age');
      if (!prof.weightLb && +g('uw-weight')) prof.weightLb = +g('uw-weight');
      if (!prof.heightIn && g('uw-height-ft')) prof.heightIn = (+g('uw-height-ft')) * 12 + (+g('uw-height-in') || 0);
      if (!prof.gender && typeof selectedSex !== 'undefined') prof.gender = selectedSex;
    }
    const hasBuild = !!(prof.heightIn && prof.weightLb);
    const disp = c => bvpCarrierDisplay(c);
    const stName = state ? (UW_CHAT_STATES[state] || state) : null;
    const scoped = bvpScopeUWDataToState(data, state);
    const out = [];

    out.push(`QUESTION SCOPE
- Carriers: ${carriers.map(disp).join(', ')} (${carrierBasis})
- State: ${stName ? `${stName} (${state})` : 'none given — national rules'}
- Conditions recognized: ${conds.length ? conds.join(', ') + condBasis : 'none'}
- Medications recognized: ${drugs.length ? drugs.join(', ') : 'none'}
- Age: ${prof.age || 'not given'} | Sex: ${prof.gender || 'not given'} | Height/weight: ${hasBuild ? `${Math.floor(prof.heightIn / 12)}'${prof.heightIn % 12}" ${prof.weightLb} lb` : 'not given'}`);

    // Guaranteed-issue states and availability
    if (state && typeof UW_GUARANTEED_ISSUE_STATES !== 'undefined' && UW_GUARANTEED_ISSUE_STATES.includes(state))
      out.push(`GUARANTEED ISSUE STATE: ${stName} is a guaranteed-issue state for Medicare Supplement — no medical underwriting applies there.`);
    const avail = carriers.map(c => {
      const rule = (typeof UW_NOT_OFFERED !== 'undefined' ? UW_NOT_OFFERED : []).find(r => r.match.test(c) || r.match.test(disp(c)));
      const where = !rule ? 'no availability list loaded' : rule.onlyIn ? `sold only in ${rule.onlyIn.join(', ')}` : `not sold in ${rule.states.join(', ')}`;
      const here = state && typeof uwNotOffered === 'function' ? (uwNotOffered(c, state) ? ` — NOT OFFERED in ${state}` : ` — offered in ${state}`) : '';
      return `- ${disp(c)}: ${where}${here}`;
    });
    out.push('WHERE EACH CARRIER IS SOLD\n' + avail.join('\n'));

    // Which rules apply in this state (state application vs national)
    const basisLines = carriers.map(c => {
      const hasState = state && (scoped.stateRulesFor || {})[c];
      const loaded = [...new Set((data.knockouts || []).filter(r => r.carrier === c && r.state).map(r => String(r.state).toUpperCase()))].sort();
      const any = (data.knockouts || []).some(r => r.carrier === c) || (data.declinableDrugs || []).some(r => r.carrier === c) || (data.buildCharts || []).some(r => r.carrier === c);
      if (!any) return `- ${disp(c)}: NO underwriting rules loaded`;
      const form = state && scoped.stateFormNumber && scoped.stateFormNumber[c] ? `, form ${scoped.stateFormNumber[c]}` : '';
      const uw = state && scoped.stateUnderwriter && scoped.stateUnderwriter[c] ? `, issued by ${scoped.stateUnderwriter[c]}` : '';
      return `- ${disp(c)}: ${hasState ? `${stName} state rules (${hasState.join(', ')}${form}${uw})` : 'national rules'}${loaded.length ? ` | states with their own application loaded: ${loaded.join(', ')}` : ''}`;
    });
    out.push('RULE SOURCE PER CARRIER\n' + basisLines.join('\n'));

    // Underwriting check results (the same check the page runs)
    const runEval = (gender) => bvpEvaluateUW({ gender, heightIn: hasBuild ? prof.heightIn : null, weightLb: hasBuild ? prof.weightLb : null, age: prof.age || null, state }, conds, drugs, carriers, data);
    if (conds.length || drugs.length || hasBuild) {
      const label = { accept: 'Likely Accept', review: 'Needs Review', decline: 'Likely Decline' };
      const sexes = hasBuild && !prof.gender ? ['M', 'F'] : [prof.gender || 'M'];
      sexes.forEach(sx => {
        const res = runEval(sx);
        const lines = res.map(r => {
          const notOff = state && typeof uwNotOffered === 'function' && uwNotOffered(r.carrier, state);
          if (notOff) return `- ${disp(r.carrier)}: NOT OFFERED in ${stName}`;
          const items = [...r.reasons.map(x => ['DECLINE', x]), ...r.flags.map(x => ['REVIEW', x]), ...(r.infos || []).map(x => ['INFO', x])]
            .map(([k, x]) => `    [${k}] ${_uwStrip(x.text)}${x.notes ? ` — ${_uwStrip(x.notes)}` : ''}`);
          return `- ${disp(r.carrier)}: ${label[r.status] || r.status}${items.length ? '\n' + items.join('\n') : ' (nothing entered matches its rules)'}`;
        });
        out.push(`UNDERWRITING CHECK RESULTS${sexes.length > 1 ? ` (if ${sx === 'M' ? 'male' : 'female'})` : ''}\n` + lines.join('\n'));
      });
    }

    // Matching rule rows for the recognized conditions / medications
    if (conds.length) {
      const rows = [];
      carriers.forEach(c => conds.forEach(cond => (scoped.knockouts || [])
        .filter(r => r.carrier === c && _bvpUwNamesMatch(r.condition_name, cond))
        .forEach(r => rows.push(`- ${disp(c)} | ${r.condition_name} | ${r.decision}${r.lookback_years ? ` | lookback ${r.lookback_years} yr` : ''}${r.min_age ? ` | age ${r.min_age}+` : ''} | ${_uwStrip(r.question_text).slice(0, 300)}${r.notes ? ` | note: ${_uwStrip(r.notes).slice(0, 300)}` : ''}`))));
      out.push('CONDITION RULES (exact matches)\n' + (rows.length ? rows.slice(0, 120).join('\n') : '- none of the selected carriers lists these conditions by name (see the check results for related rules)'));
    }
    if (drugs.length) {
      const rows = [];
      carriers.forEach(c => drugs.forEach(dn => {
        const keys = _bvpUwDrugKeys(dn, data.drugList);
        (scoped.declinableDrugs || []).filter(r => r.carrier === c && [..._bvpUwDrugKeys(r.drug_name, data.drugList)].some(k => keys.has(k)))
          .forEach(r => rows.push(`- ${disp(c)} | ${r.drug_name} | ${r.decision}${r.lookback_years ? ` | lookback ${r.lookback_years} yr` : ''}${r.min_age ? ` | age ${r.min_age}+` : ''}${r.only_for_conditions && r.only_for_conditions.length ? ` | only when taken for ${r.only_for_conditions.join(', ')}` : ''}${r.notes ? ` | note: ${_uwStrip(r.notes).slice(0, 300)}` : ''}`));
      }));
      out.push('MEDICATION RULES\n' + (rows.length ? rows.slice(0, 80).join('\n') : '- none of the selected carriers lists these medications'));
    }

    // No specific condition/medication/build: summarize each carrier's rules
    if (!conds.length && !drugs.length && !hasBuild && carriers.length <= 4) {
      carriers.forEach(c => {
        const ko = (scoped.knockouts || []).filter(r => r.carrier === c);
        const group = d => [...new Set(ko.filter(r => r.decision === d).map(r => `${r.condition_name}${r.lookback_years ? ` (${r.lookback_years} yr)` : ''}`))];
        const nd = (scoped.declinableDrugs || []).filter(r => r.carrier === c);
        const nb = (scoped.buildCharts || []).filter(r => r.carrier === c);
        out.push(`${disp(c).toUpperCase()} — RULE SUMMARY (${stName || 'national'})
- Declines: ${group('decline').join('; ') || 'none listed'}
- Needs review / case by case: ${group('case_by_case').join('; ') || 'none listed'}
- Accepted at a higher rate class: ${group('accept_with_rating').join('; ') || 'none listed'}
- Informational: ${group('info').join('; ') || 'none'}
- Medication list: ${nd.length ? `${nd.length} medications (${nd.filter(r => r.decision === 'decline').length} decline) — ask about a specific drug` : 'none loaded'}
- Height/weight build chart: ${nb.length ? `loaded (${nb.length} rows) — give a height, weight and sex to check` : 'none loaded'}`);
      });
    } else if (!conds.length && !drugs.length && !hasBuild) {
      out.push('NOTE: No condition, medication or height/weight was recognized and more than 4 carriers are in scope. If the question needs specifics, ask the agent which condition, medication or carrier they mean.');
    }

    // State GI rights
    if (state && typeof uwLoadGIRules === 'function') {
      try {
        const gi = (await uwLoadGIRules()).filter(r => r.state === state);
        if (gi.length) out.push(`${stName.toUpperCase()} STATE GUARANTEED-ISSUE RIGHTS (state_gi_rules)\n` + gi.map(r => '- ' + JSON.stringify(Object.fromEntries(Object.entries(r)
          .filter(([k, v]) => v != null && v !== '' && !['id', 'created_at', 'updated_at', 'is_active', 'needs_review', 'source_document', 'source_page'].includes(k))))).join('\n'));
        else out.push(`${stName.toUpperCase()} STATE GUARANTEED-ISSUE RIGHTS: none loaded for this state.`);
      } catch (e) { /* GI rules unavailable */ }
    }

    let ctx = out.join('\n\n');
    if (ctx.length > 90000) ctx = ctx.slice(0, 90000) + '\n…(trimmed)';

    return `You are UW Assistant, the underwriting helper inside BookValuePro's Underwriting Assistant page, used by Medicare Supplement agents.

ANSWER ONLY FROM THE UNDERWRITING DATA BELOW. It comes from the carriers' applications and underwriting guides loaded into BookValuePro (knockout questions, medication lists, build charts, where each carrier is sold, and state guaranteed-issue rights). Do not use outside knowledge about any carrier's underwriting, and never guess a rule, percentage or lookback. If the data doesn't answer the question, say it isn't loaded in BookValuePro yet (and which carrier/state is missing) and suggest checking with the carrier.

Scope: Medicare Supplement underwriting only — conditions, medications, height/weight, lookback periods, rate classes, carrier availability, guaranteed-issue rights. If asked about the agent's book of business, rate increases, commissions or anything else, say that this assistant answers underwriting questions and the BVP Assistant on the other pages can help with that.

How to read the data:
- decline = Likely Decline. case_by_case = Needs Review (depends on details). accept_with_rating = accepted at a higher rate class (e.g. UnitedHealthcare's Level 2 rate), not declined. info = informational only.
- lookback = how many years back the question asks. "only when taken for" = the medication matters only for those conditions.
- "UNDERWRITING CHECK RESULTS" is the same check the page runs; trust it over your own reading of the rows.
- A carrier with no rules loaded, or NOT OFFERED in the state, must be reported that way — never as a likely accept.
- State rules come from that state's application; otherwise the carrier's national rules apply.

How to answer:
- Short and direct; lead with the answer per carrier. Name the state (or "national rules").
- Briefly cite where it comes from when useful (e.g. "Aetna's Texas application asks…", "Humana's underwriting guide…").
- Plain text only — no markdown symbols like ** or #. Use short lines starting with "- " for lists.
- End with a brief reminder that the carrier makes the final decision only when you give a likely-accept or review answer.
- If the question is unclear (no carrier, condition or medication you can identify), ask one short clarifying question.

TODAY'S DATE: ${new Date().toDateString()}

--- UNDERWRITING DATA ---
${ctx}`;
  }


  function buildBookContext(book, policies) {
    if (!policies || policies.length === 0) return 'Book loaded but no policies found.';
    const totalNPV     = policies.reduce((s, p) => s + (p.curr_npv || 0), 0);
    const p1           = policies.filter(p => p.priority === 1);
    const p2           = policies.filter(p => p.priority === 2);
    const p3           = policies.filter(p => p.priority === 3);
    const nextMonth    = new Date().getMonth() + 1 === 12 ? 1 : new Date().getMonth() + 2;
    const renewingNext = policies.filter(p => p.eff_month === nextMonth);
    const byCarrier    = {};
    policies.forEach(p => {
      const c = p.company || 'Unknown';
      if (!byCarrier[c]) byCarrier[c] = { count: 0, npv: 0 };
      byCarrier[c].count++;
      byCarrier[c].npv += p.curr_npv || 0;
    });
    const carrierLines = Object.entries(byCarrier)
      .sort((a, b) => b[1].npv - a[1].npv)
      .map(([c, v]) => `  - ${c}: ${v.count} policies, $${Math.round(v.npv).toLocaleString()} NPV`)
      .join('\n');
    const top10 = p1.slice(0, 10).map(p =>
      `  - ${p.first_name || ''} ${p.last_name || ''} | ${p.company} | $${Math.round(p.curr_npv || 0).toLocaleString()} NPV | ${p.issued_state || 'N/A'} | Renews month ${p.eff_month || 'N/A'}`
    ).join('\n');
    return `Book: ${book.file_name} (${book.policy_count} policies)
Total Book NPV: $${Math.round(totalNPV).toLocaleString()}
Priority 1: ${p1.length} | Priority 2: ${p2.length} | Priority 3: ${p3.length}
Renewing next month (month ${nextMonth}): ${renewingNext.length} policies
Carrier Breakdown:\n${carrierLines}
Top Priority 1 Clients (up to 10):\n${top10 || '  None'}`;
  }

  // State GI rights summary — only states present in the agent's book.
  // p.gi is attached by bvpEnrichPolicies (see bvpGIStatus in bvp-supabase.js).
  function buildGIContext(policies) {
    const withRight = (policies || []).filter(p => p.gi && p.gi.hasRight);
    if (!withRight.length) return 'STATE GI RIGHTS: No clients in a state with a state guaranteed-issue right.';
    const byState = {};
    withRight.forEach(p => {
      const s = p.gi.state;
      if (!byState[s]) byState[s] = { gi: p.gi, count: 0, gi_npv: 0, ren_npv: 0 };
      byState[s].count++;
      byState[s].ren_npv += p.ren_npv || 0;
      byState[s].gi_npv  += p.gi_ren_npv || 0;
    });
    const stateLines = Object.entries(byState).sort((a, b) => b[1].count - a[1].count).map(([s, v]) => {
      const r = v.gi.rule || {};
      const extra = [v.gi.planNote, v.gi.scopeNote].concat(v.gi.requirements || []).join('; ');
      return `  - ${s}: ${v.count} clients | ${v.gi.ruleName} | ${extra}${r.notes ? ' | ' + r.notes : ''} | Renewal LTV $${Math.round(v.ren_npv).toLocaleString()} underwritten vs $${Math.round(v.gi_npv).toLocaleString()} if written as GI`;
    }).join('\n');
    const name = p => [p.first_name, p.last_name].filter(Boolean).join(' ') || ('Policy #' + p.policy_idx);
    const fmt  = d => d ? d.toDateString().slice(4) : 'N/A';
    const upcoming = withRight
      .filter(p => p.gi.windowOpen && !p.gi.yearRound && p.gi.daysUntilOpen <= 120 && p.gi.status !== 'open')
      .sort((a, b) => a.gi.daysUntilOpen - b.gi.daysUntilOpen).slice(0, 25)
      .map(p => `  - ${name(p)} | ${p.issued_state} | ${p.company} | window ${fmt(p.gi.windowOpen)} – ${fmt(p.gi.windowClose)} | underwrite by ${fmt(p.gi.underwriteBy)}${p.gi.status === 'uw_passed' ? ' (PASSED)' : ''}`)
      .join('\n');
    const openNow = withRight.filter(p => p.gi.status === 'open')
      .map(p => `  - ${name(p)} | ${p.issued_state} | closes ${fmt(p.gi.windowClose)}`).slice(0, 25).join('\n');
    return `STATE GI RIGHTS (${withRight.length} clients):
${stateLines}
GI windows opening in the next 120 days (soonest first):
${upcoming || '  None'}
GI windows open now (switch must be written as GI):
${openNow || '  None'}`;
  }

  function buildKnowledgeContext(docs) {
    if (!docs || docs.length === 0) return 'No knowledge documents found.';
    return docs.map(d =>
      `[${(d.category || 'GENERAL').toUpperCase()}] ${d.title}${d.state ? ` (${d.state})` : ''}${d.carrier ? ` — ${d.carrier}` : ''}${d.effective_date ? ` | Effective: ${d.effective_date}` : ''}\n  ${d.summary || 'No summary available.'}`
    ).join('\n\n');
  }

})();
