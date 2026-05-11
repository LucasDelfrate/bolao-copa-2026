/**
 * Servidor mock para simulação da Copa 2026.
 * Serve os mesmos endpoints que server.js, mas com dados locais.
 * Painel de controle: http://localhost:3001/sim
 *
 * Uso: node api/mock-server.js
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { resolveSlots, applyBracket, computeGroupStandings } = require('./bracket-resolver');

const app = express();
const PORT = 3001;
const STATE_FILE = path.join(__dirname, 'mock-state.json');

app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────

const teamsRaw     = require('./fixture-teams.json');
const groupsRaw    = require('./fixture-scoreboard-groups.json');
const knockoutRaw  = require('./fixture-scoreboard-knockout.json');
const groupsList   = require('./fixture-groups-list.json');
const groupsDetail = require('./fixture-groups-detail.json');

// Mapa teamId → team object (com logos)
const teamsById = {};
for (const entry of teamsRaw?.sports?.[0]?.leagues?.[0]?.teams ?? []) {
  const t = entry.team;
  teamsById[String(t.id)] = {
    id: String(t.id),
    displayName: t.displayName,
    abbreviation: t.abbreviation,
    logos: t.logos,
  };
}

// Mapa groupLetter → { teamIds, groupId }
const groupsByLetter = {};
for (const [gid, g] of Object.entries(groupsDetail)) {
  const abbr = g.detail?.abbreviation ?? '';
  const letter = abbr.replace(/^Group\s+/i, '').trim() || gid;
  const standings = g.standings?.standings ?? [];
  const teamIds = standings
    .map(s => s?.team?.$ref?.match(/teams\/(\d+)/)?.[1])
    .filter(Boolean)
    .map(String);
  groupsByLetter[letter] = { teamIds, groupId: gid };
}

// ─── Estado ───────────────────────────────────────────────────────────────

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
  }
  const state = { matches: {} };
  for (const ev of [...(groupsRaw.events || []), ...(knockoutRaw.events || [])]) {
    state.matches[ev.id] = { id: ev.id, homeScore: null, awayScore: null, status: 'scheduled' };
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

let SIM = loadState();

// ─── Resolução da chave ───────────────────────────────────────────────────

function buildGroupsData() {
  const groupsData = {};
  const allGroupEvents = groupsRaw.events || [];

  for (const [letter, { teamIds }] of Object.entries(groupsByLetter)) {
    const matches = allGroupEvents
      .filter(ev => {
        const comp = ev.competitions?.[0] ?? {};
        const ids = comp.competitors?.map(c => String(c.team?.id)) ?? [];
        return ids.some(id => teamIds.includes(id));
      })
      .map(ev => {
        const s = SIM.matches[ev.id] ?? {};
        const comp = ev.competitions?.[0] ?? {};
        const home = comp.competitors?.find(c => c.homeAway === 'home');
        const away = comp.competitors?.find(c => c.homeAway === 'away');
        return {
          homeTeamId: String(home?.team?.id ?? ''),
          awayTeamId: String(away?.team?.id ?? ''),
          homeScore: s.status === 'finished' ? (s.homeScore ?? null) : null,
          awayScore: s.status === 'finished' ? (s.awayScore ?? null) : null,
        };
      });
    groupsData[letter] = { teamIds, matches };
  }
  return groupsData;
}

function applyGroupState(ev) {
  const s = SIM.matches[ev.id];
  if (!s) return ev;
  const clone = JSON.parse(JSON.stringify(ev));
  const comp = clone.competitions[0];
  const home = comp.competitors.find(c => c.homeAway === 'home');
  const away = comp.competitors.find(c => c.homeAway === 'away');

  if (s.status === 'finished') {
    clone.status.type = { name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final', detail: 'Final', shortDetail: 'FT' };
    if (home) home.score = String(s.homeScore ?? 0);
    if (away) away.score = String(s.awayScore ?? 0);
    if (s.penaltyWinnerId) clone.penaltyWinnerId = s.penaltyWinnerId;
  } else if (s.status === 'in-progress') {
    clone.status.type = { name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress', shortDetail: "45'" };
    if (home) home.score = String(s.homeScore ?? 0);
    if (away) away.score = String(s.awayScore ?? 0);
  } else {
    clone.status.type = { name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled', shortDetail: 'Scheduled' };
    if (home) home.score = '0';
    if (away) away.score = '0';
  }
  return clone;
}

// ─── Endpoints ESPN ───────────────────────────────────────────────────────

app.get('/api/teams', (req, res) => res.json(teamsRaw));

app.get('/api/scoreboard', (req, res) => {
  const groupEvents = (groupsRaw.events || []).map(applyGroupState);

  const groupsData = buildGroupsData();
  const slots = resolveSlots(groupsData, teamsById);
  const knockoutEvents = applyBracket(knockoutRaw.events || [], slots, SIM.matches);

  res.json({ ...groupsRaw, events: [...groupEvents, ...knockoutEvents] });
});

app.get('/api/groups', (req, res) => res.json(groupsList));

app.get('/api/groups/:id', (req, res) => {
  const data = groupsDetail[req.params.id];
  if (!data) return res.status(404).json({ error: 'Group not found' });
  res.json(data.detail);
});

app.get('/api/groups/:id/standings', (req, res) => {
  const data = groupsDetail[req.params.id];
  if (!data) return res.status(404).json({ error: 'Group not found' });
  res.json(data.standings);
});

// ─── Endpoints de simulação ───────────────────────────────────────────────

app.post('/api/sim/match', (req, res) => {
  const { id, homeScore, awayScore, status, penaltyWinnerId } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const entry = { id, homeScore, awayScore, status };
  if (penaltyWinnerId) entry.penaltyWinnerId = penaltyWinnerId;
  SIM.matches[id] = entry;
  saveState(SIM);
  res.json({ ok: true });
});

app.post('/api/sim/reset', (req, res) => {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  SIM = loadState();
  res.json({ ok: true });
});

app.post('/api/sim/reset-phase', (req, res) => {
  const { phase } = req.body;
  const events = phase === 'knockout' ? knockoutRaw.events : groupsRaw.events;
  for (const ev of events) {
    SIM.matches[ev.id] = { id: ev.id, homeScore: null, awayScore: null, status: 'scheduled' };
  }
  saveState(SIM);
  res.json({ ok: true });
});

// Estado enriquecido para o painel (inclui times resolvidos no mata-mata)
app.get('/api/sim/state', (req, res) => {
  const groupsData = buildGroupsData();
  const slots = resolveSlots(groupsData, teamsById);

  const groupEvents = (groupsRaw.events || []).map(ev => {
    const s = SIM.matches[ev.id] || { status: 'scheduled', homeScore: null, awayScore: null };
    const comp = ev.competitions?.[0] ?? {};
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    return {
      id: ev.id, date: ev.date,
      phase: ev.season?.slug ?? 'group-stage',
      venue: comp.venue?.fullName ?? '',
      homeName: home?.team?.displayName ?? '?',
      homeLogo: home?.team?.logos?.[0]?.href ?? '',
      awayName: away?.team?.displayName ?? '?',
      awayLogo: away?.team?.logos?.[0]?.href ?? '',
      ...s,
    };
  });

  // Para o mata-mata, resolver os times via bracket
  const { ROUND_OF_32_SLOTS } = require('./bracket-resolver');
  const knockoutEvents = applyBracket(knockoutRaw.events || [], slots, SIM.matches);

  const knockoutMapped = knockoutEvents.map(ev => {
    const s = SIM.matches[ev.id] || { status: 'scheduled', homeScore: null, awayScore: null };
    const comp = ev.competitions?.[0] ?? {};
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    return {
      id: ev.id, date: ev.date,
      phase: ev.season?.slug ?? 'round-of-32',
      venue: comp.venue?.fullName ?? '',
      homeName: home?.team?.displayName ?? '?',
      homeLogo: home?.team?.logos?.[0]?.href ?? '',
      awayName: away?.team?.displayName ?? '?',
      awayLogo: away?.team?.logos?.[0]?.href ?? '',
      ...s,
    };
  });

  res.json([...groupEvents, ...knockoutMapped]);
});

// ─── Painel HTML ──────────────────────────────────────────────────────────

app.get('/sim', (req, res) => res.send(PANEL_HTML));

app.listen(PORT, () => {
  console.log(`\n🧪 MOCK SERVER rodando em http://localhost:${PORT}`);
  console.log(`   Painel: http://localhost:${PORT}/sim\n`);
});

// ─── Painel HTML ──────────────────────────────────────────────────────────

const PANEL_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>🧪 Simulador Copa 2026</title>
<style>
  :root {
    --bg:#0d1117;--bg2:#161b22;--bg3:#21262d;
    --border:#30363d;--text:#e6edf3;--muted:#7d8590;
    --green:#238636;--green-light:#3fb950;
    --gold:#e3b341;--red:#da3633;--blue:#388bfd;--orange:#f0883e;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px}
  header{background:var(--bg2);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;gap:12px;flex-wrap:wrap}
  header h1{font-size:17px;white-space:nowrap}
  .actions{display:flex;gap:6px;flex-wrap:wrap}
  .btn{padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text);cursor:pointer;font-size:12px;transition:background .15s}
  .btn:hover{background:#2d333b}
  .btn-danger{background:rgba(218,54,51,.15);border-color:rgba(218,54,51,.4);color:#ff7b72}
  .btn-danger:hover{background:rgba(218,54,51,.3)}
  .tabs{display:flex;border-bottom:1px solid var(--border);background:var(--bg2);padding:0 20px}
  .tab{padding:9px 16px;cursor:pointer;border-bottom:2px solid transparent;font-size:13px;color:var(--muted);transition:color .15s}
  .tab.active{color:var(--text);border-bottom-color:var(--blue)}
  main{padding:16px 20px;max-width:1100px;margin:0 auto}
  .stats-bar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
  .stat{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 14px;min-width:80px}
  .stat-val{font-size:20px;font-weight:700}
  .stat-val.g{color:var(--green-light)}.stat-val.gold{color:var(--gold)}.stat-val.r{color:#ff7b72}
  .stat-label{font-size:11px;color:var(--muted);margin-top:2px}
  .quick-bar{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
  .quick-bar span{font-size:12px;color:var(--muted)}
  .group-header{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 0 5px;border-bottom:1px solid var(--border);margin-bottom:7px;display:flex;align-items:center;justify-content:space-between}
  .phase-pill{font-size:10px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:1px 6px;color:var(--muted);text-transform:none;letter-spacing:0}
  .match-list{display:grid;gap:7px;margin-bottom:20px}
  .match-card{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}
  .match-card.finished{border-color:var(--green)}
  .match-card.in-progress{border-color:var(--orange)}
  .match-card.tbd{opacity:.55}
  .team{display:flex;align-items:center;gap:7px;min-width:0}
  .team.away{justify-content:flex-end;flex-direction:row-reverse}
  .team img{width:22px;height:22px;object-fit:contain;flex-shrink:0}
  .team-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .team-name.tbd{color:var(--muted);font-style:italic;font-size:11px}
  .match-center{display:flex;flex-direction:column;align-items:center;gap:5px}
  .score-row{display:flex;align-items:center;gap:5px}
  .score-input{width:42px;height:34px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:17px;font-weight:700;text-align:center}
  .score-input:focus{outline:none;border-color:var(--blue)}
  .score-sep{font-size:15px;font-weight:700;color:var(--muted)}
  .status-row{display:flex;gap:3px}
  .status-btn{padding:2px 7px;border-radius:4px;border:1px solid var(--border);background:var(--bg3);color:var(--muted);cursor:pointer;font-size:10px;transition:all .15s}
  .status-btn.s-scheduled.active{color:var(--text);border-color:var(--text);background:var(--bg3)}
  .status-btn.s-in-progress.active{color:var(--orange);border-color:var(--orange);background:rgba(240,136,62,.15)}
  .status-btn.s-finished.active{color:var(--green-light);border-color:var(--green);background:rgba(35,134,54,.15)}
  .match-date{font-size:10px;color:var(--muted)}
  .toast{position:fixed;bottom:20px;right:20px;background:var(--green);color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;z-index:999;opacity:0;transition:opacity .3s;pointer-events:none}
  .toast.show{opacity:1}
  .bracket-note{background:rgba(56,139,253,.08);border:1px solid rgba(56,139,253,.25);border-radius:8px;padding:10px 14px;font-size:12px;color:#79c0ff;margin-bottom:14px}
</style>
</head>
<body>
<header>
  <h1>🧪 Simulador Copa 2026</h1>
  <div class="actions">
    <button class="btn" onclick="finishAll('groups')">✅ Finalizar grupos</button>
    <button class="btn" onclick="finishAll('knockout')">✅ Finalizar mata-mata</button>
    <button class="btn" onclick="randomizeVisible()">🎲 Aleatorizar</button>
    <button class="btn btn-danger" onclick="resetPhase('groups')">↺ Reset grupos</button>
    <button class="btn btn-danger" onclick="resetPhase('knockout')">↺ Reset mata-mata</button>
    <button class="btn btn-danger" onclick="resetAll()">↺ Reset total</button>
  </div>
</header>

<div class="tabs">
  <div class="tab active" onclick="switchTab('groups',this)">⚽ Fase de Grupos (72)</div>
  <div class="tab" onclick="switchTab('knockout',this)">🏟️ Mata-mata (32)</div>
</div>

<main>
  <div class="stats-bar" id="stats"></div>
  <div id="bracket-note" style="display:none" class="bracket-note">
    ℹ️ A chave do mata-mata é resolvida automaticamente com base nos resultados dos grupos. Times marcados como <em>A definir</em> ainda dependem de jogos não finalizados.
  </div>
  <div id="matches-container"></div>
</main>

<div class="toast" id="toast">Salvo!</div>

<script>
let allMatches = [];
let currentTab = 'groups';
const KNOCKOUT_PHASES = ['round-of-32','round-of-16','quarterfinals','semifinals','3rd-place-match','final'];
const PHASE_LABELS = {
  'group-stage':'Fase de Grupos','round-of-32':'Oitavas de Final',
  'round-of-16':'Oitavas','quarterfinals':'Quartas de Final',
  'semifinals':'Semifinal','3rd-place-match':'3º Lugar','final':'Final'
};

async function load() {
  const res = await fetch('/api/sim/state');
  allMatches = await res.json();
  renderStats();
  renderMatches();
}

function renderStats() {
  const fin = allMatches.filter(m=>m.status==='finished').length;
  const live = allMatches.filter(m=>m.status==='in-progress').length;
  const sched = allMatches.filter(m=>m.status==='scheduled').length;
  document.getElementById('stats').innerHTML =
    \`<div class="stat"><div class="stat-val g">\${fin}</div><div class="stat-label">Finalizados</div></div>
    <div class="stat"><div class="stat-val gold">\${live}</div><div class="stat-label">Ao vivo</div></div>
    <div class="stat"><div class="stat-val">\${sched}</div><div class="stat-label">Agendados</div></div>
    <div class="stat"><div class="stat-val">\${allMatches.length}</div><div class="stat-label">Total</div></div>\`;
}

function renderMatches() {
  const isGroups = currentTab === 'groups';
  document.getElementById('bracket-note').style.display = isGroups ? 'none' : 'block';

  const matches = allMatches.filter(m =>
    isGroups ? m.phase === 'group-stage' : KNOCKOUT_PHASES.includes(m.phase)
  );

  const grouped = {};
  for (const m of matches) {
    const key = isGroups ? m.date.slice(0,10) : m.phase;
    if (!grouped[key]) grouped[key] = { label: isGroups ? formatDate(m.date) : PHASE_LABELS[m.phase], items: [] };
    grouped[key].items.push(m);
  }

  const container = document.getElementById('matches-container');
  container.innerHTML = '';
  for (const [,group] of Object.entries(grouped)) {
    const h = document.createElement('div');
    h.className = 'group-header';
    h.innerHTML = \`<span>\${group.label}</span><span class="phase-pill">\${group.items.length} jogos</span>\`;
    container.appendChild(h);
    const list = document.createElement('div');
    list.className = 'match-list';
    group.items.forEach(m => list.appendChild(buildCard(m)));
    container.appendChild(list);
  }
}

function isTbd(name) {
  return !name || name.includes('Winner') || name.includes('Place') || name.includes('Loser') || name === '?';
}

function buildCard(m) {
  const card = document.createElement('div');
  const homeIsTbd = isTbd(m.homeName);
  const awayIsTbd = isTbd(m.awayName);
  card.className = 'match-card ' + (m.status !== 'scheduled' ? m.status : '') + (homeIsTbd || awayIsTbd ? ' tbd' : '');
  card.id = 'card-' + m.id;

  const hScore = m.homeScore ?? 0;
  const aScore = m.awayScore ?? 0;

  const homeLogo = m.homeLogo ? \`<img src="\${m.homeLogo}" onerror="this.style.display='none'" />\` : '';
  const awayLogo = m.awayLogo ? \`<img src="\${m.awayLogo}" onerror="this.style.display='none'" />\` : '';
  const homeNameClass = homeIsTbd ? 'team-name tbd' : 'team-name';
  const awayNameClass = awayIsTbd ? 'team-name tbd' : 'team-name';

  card.innerHTML = \`
    <div class="team">\${homeLogo}<span class="\${homeNameClass}">\${m.homeName}</span></div>
    <div class="match-center">
      <div class="score-row">
        <input class="score-input" type="number" min="0" max="20" value="\${hScore}" id="h-\${m.id}" \${homeIsTbd?'disabled':''} />
        <span class="score-sep">×</span>
        <input class="score-input" type="number" min="0" max="20" value="\${aScore}" id="a-\${m.id}" \${awayIsTbd?'disabled':''} />
      </div>
      <div class="status-row">
        <button class="status-btn s-scheduled \${m.status==='scheduled'?'active':''}" onclick="setStatus('\${m.id}','scheduled')">Agendado</button>
        <button class="status-btn s-in-progress \${m.status==='in-progress'?'active':''}" onclick="setStatus('\${m.id}','in-progress')">Ao vivo</button>
        <button class="status-btn s-finished \${m.status==='finished'?'active':''}" onclick="setStatus('\${m.id}','finished')">Finalizado</button>
      </div>
      <div class="match-date">\${formatDate(m.date)}</div>
    </div>
    <div class="team away"><span class="\${awayNameClass}">\${m.awayName}</span>\${awayLogo}</div>
  \`;

  card.querySelectorAll('.score-input').forEach(inp => {
    inp.addEventListener('change', () => saveMatch(m.id));
  });
  return card;
}

async function setStatus(id, status) {
  const m = allMatches.find(x => x.id === id);
  if (!m) return;
  m.status = status;
  if (status === 'finished' && m.homeScore === null) m.homeScore = 0;
  if (status === 'finished' && m.awayScore === null) m.awayScore = 0;
  await persist(id, m.homeScore, m.awayScore, status);
  await load();
}

async function saveMatch(id) {
  const m = allMatches.find(x => x.id === id);
  if (!m) return;
  const h = parseInt(document.getElementById('h-'+id)?.value) || 0;
  const a = parseInt(document.getElementById('a-'+id)?.value) || 0;
  m.homeScore = h; m.awayScore = a;
  await persist(id, h, a, m.status);
  showToast();
}

async function persist(id, homeScore, awayScore, status) {
  await fetch('/api/sim/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, homeScore, awayScore, status }),
  });
  showToast();
}

async function finishAll(phase) {
  const matches = allMatches.filter(m =>
    phase === 'groups' ? m.phase === 'group-stage' : KNOCKOUT_PHASES.includes(m.phase)
  );
  for (const m of matches) {
    if (m.status !== 'finished') {
      m.status = 'finished';
      m.homeScore = m.homeScore ?? 0;
      m.awayScore = m.awayScore ?? 0;
      await persist(m.id, m.homeScore, m.awayScore, 'finished');
    }
  }
  await load();
  showToast('Todos finalizados!');
}

async function randomizeVisible() {
  const matches = allMatches.filter(m =>
    currentTab === 'groups' ? m.phase === 'group-stage' : KNOCKOUT_PHASES.includes(m.phase)
  );
  for (const m of matches) {
    const h = Math.floor(Math.random() * 5);
    const a = Math.floor(Math.random() * 5);
    m.homeScore = h; m.awayScore = a; m.status = 'finished';
    await persist(m.id, h, a, 'finished');
  }
  await load();
  showToast('Resultados aleatórios!');
}

async function resetPhase(phase) {
  if (!confirm('Resetar jogos de ' + phase + '?')) return;
  await fetch('/api/sim/reset-phase', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({phase}) });
  await load();
  showToast('Resetado!');
}

async function resetAll() {
  if (!confirm('Resetar tudo?')) return;
  await fetch('/api/sim/reset', { method:'POST' });
  await load();
  showToast('Reset total!');
}

function switchTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderMatches();
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}) + ' ' +
    dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

let toastTimer;
function showToast(msg='Salvo!') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

load();
</script>
</body>
</html>`;
