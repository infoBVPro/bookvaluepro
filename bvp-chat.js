// bvp-chat.js — BookValuePro AI Chat Bar v2
// Include AFTER bvp-supabase.js: <script src="bvp-chat.js"></script>

(function () {

  const BVP_CHAT_PROXY = 'https://wspxgkbcdkvlripmvnjh.supabase.co/functions/v1/bvp-chat';

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
    <span id="bvp-chat-bar-label">BVP Assistant</span>
    <input id="bvp-chat-bar-input" type="text" placeholder="Ask about your book, rate increases, regulations…" autocomplete="off" />
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

  const SUGGESTIONS = [
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
      addMessage('assistant', "Hi! I'm your BVP Assistant. Ask me anything about your Medicare Supplement book of business, carrier rate changes, or state regulations.");
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
      const agentId = session.user.id;
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
      <div class="bvp-msg-sender">${role === 'user' ? 'You' : 'BVP Assistant'}</div>
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
