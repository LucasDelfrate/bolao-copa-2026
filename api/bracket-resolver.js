/**
 * Resolve a chave do mata-mata da Copa 2026 a partir dos resultados dos grupos.
 *
 * Regras oficiais:
 * - 12 grupos × 4 times = 48 times
 * - Top 2 de cada grupo avançam (24 times)
 * - 8 melhores terceiros colocados avançam (8 times)
 * - Total de 32 times nas oitavas
 *
 * Os conjuntos de grupos que competem por cada vaga de 3º lugar são
 * pré-definidos pela FIFA/ESPN (extraídos diretamente do fixture ESPN).
 */

// Mapeamento de jogo → quais slots ocupa
// Extraído do fixture ESPN: cada oitava tem home/away como "Group X Winner" etc.
const ROUND_OF_32_SLOTS = [
  { eventId: '760486', home: 'A2', away: 'B2' },
  { eventId: '760487', home: 'C1', away: 'F2' },
  { eventId: '760489', home: 'E1', away: 'T:ABCDF' },   // terceiro de A/B/C/D/F
  { eventId: '760488', home: 'F1', away: 'C2' },
  { eventId: '760490', home: 'E2', away: 'I2' },
  { eventId: '760492', home: 'I1', away: 'T:CDFGH' },   // terceiro de C/D/F/G/H
  { eventId: '760491', home: 'A1', away: 'T:CEFHI' },   // terceiro de C/E/F/H/I
  { eventId: '760495', home: 'L1', away: 'T:EHIJK' },   // terceiro de E/H/I/J/K
  { eventId: '760493', home: 'G1', away: 'T:AEHIJ' },   // terceiro de A/E/H/I/J
  { eventId: '760494', home: 'D1', away: 'T:BEFIJ' },   // terceiro de B/E/F/I/J
  { eventId: '760497', home: 'H1', away: 'J2' },
  { eventId: '760496', home: 'K2', away: 'L2' },
  { eventId: '760498', home: 'B1', away: 'T:EFGIJ' },   // terceiro de E/F/G/I/J
  { eventId: '760499', home: 'D2', away: 'G2' },
  { eventId: '760500', home: 'J1', away: 'H2' },
  { eventId: '760501', home: 'K1', away: 'T:DEIJL' },   // terceiro de D/E/I/J/L
];

// Grupos que competem por cada vaga de 3º (chave do jogo → letras dos grupos)
const THIRD_PLACE_POOLS = {
  'T:ABCDF': ['A','B','C','D','F'],
  'T:CDFGH': ['C','D','F','G','H'],
  'T:CEFHI': ['C','E','F','H','I'],
  'T:EHIJK': ['E','H','I','J','K'],
  'T:AEHIJ': ['A','E','H','I','J'],
  'T:BEFIJ': ['B','E','F','I','J'],
  'T:EFGIJ': ['E','F','G','I','J'],
  'T:DEIJL': ['D','E','I','J','L'],
};

/**
 * Computa os standings de um grupo a partir dos jogos finalizados.
 * @param {string[]} teamIds
 * @param {Array} matches - jogos do grupo com homeTeamId, awayTeamId, homeScore, awayScore
 * @returns {Array} times ordenados por pos (1º, 2º, 3º, 4º)
 */
function computeGroupStandings(teamIds, matches) {
  const stats = {};
  for (const id of teamIds) {
    stats[id] = { id, pts: 0, gf: 0, ga: 0, gd: 0, w: 0, d: 0, l: 0, played: 0 };
  }

  for (const m of matches) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const h = stats[m.homeTeamId], a = stats[m.awayTeamId];
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore)      { h.pts += 3; h.w++; a.l++; }
    else if (m.homeScore < m.awayScore) { a.pts += 3; a.w++; h.l++; }
    else                                { h.pts++; h.d++; a.pts++; a.d++; }
  }

  return Object.values(stats)
    .map(s => ({ ...s, gd: s.gf - s.ga }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

/**
 * Resolve toda a chave a partir dos resultados dos grupos.
 *
 * @param {Object} groupsData  - { [letter]: { teamIds: string[], matches: Array } }
 * @param {Object} teamsById   - { [teamId]: { id, displayName, abbreviation, logos } }
 * @returns {Object} resolvedSlots - { 'A1': teamObj, 'A2': teamObj, 'A3': teamObj, ... }
 */
function resolveSlots(groupsData, teamsById) {
  const slots = {};
  const thirds = []; // { letter, team, pts, gd, gf }

  for (const [letter, { teamIds, matches }] of Object.entries(groupsData)) {
    const standings = computeGroupStandings(teamIds, matches);
    if (standings[0]) slots[`${letter}1`] = teamsById[standings[0].id];
    if (standings[1]) slots[`${letter}2`] = teamsById[standings[1].id];
    if (standings[2]) {
      const s = standings[2];
      thirds.push({ letter, teamId: s.id, team: teamsById[s.id], pts: s.pts, gd: s.gd, gf: s.gf });
    }
  }

  // Ordenar os 12 terceiros para selecionar os 8 melhores
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  const best8 = thirds.slice(0, 8);
  const best8Letters = new Set(best8.map(t => t.letter));

  // Para cada slot de terceiro lugar, escolher o melhor terceiro
  // do pool de grupos elegíveis que ainda não foi alocado
  const usedLetters = new Set();

  for (const slot of ROUND_OF_32_SLOTS) {
    for (const side of ['home', 'away']) {
      const slotKey = slot[side];
      if (!slotKey.startsWith('T:')) continue;
      const pool = THIRD_PLACE_POOLS[slotKey] ?? [];

      // Encontrar o melhor terceiro disponível neste pool
      const candidate = best8.find(t =>
        pool.includes(t.letter) &&
        best8Letters.has(t.letter) &&
        !usedLetters.has(t.letter)
      );
      if (candidate) {
        slots[slotKey] = candidate.team;
        usedLetters.add(candidate.letter);
      }
    }
  }

  return slots;
}

/**
 * Aplica os slots resolvidos aos eventos do mata-mata,
 * substituindo os placeholders pelos nomes reais dos times.
 *
 * @param {Array} events - eventos originais do fixture ESPN
 * @param {Object} slots - resultado de resolveSlots()
 * @param {Object} simState - estado da simulação { matches: { [id]: { homeScore, awayScore, status } } }
 * @returns {Array} eventos com times e placares preenchidos
 */
function applyBracket(events, slots, simState) {
  // Primeiro passo: mapear eventId → times resolvidos para round-of-32
  const resolvedTeams = {}; // eventId → { homeTeam, awayTeam }

  for (const slot of ROUND_OF_32_SLOTS) {
    resolvedTeams[slot.eventId] = {
      homeTeam: slots[slot.home],
      awayTeam: slots[slot.away],
    };
  }

  // Segundo passo: resolver round-of-16 a partir dos vencedores das oitavas
  // O fixture ESPN referencia "Round of 32 N Winner" — precisamos seguir a cadeia
  const roundOf32Results = {}; // eventId → { winner, loser }
  for (const slot of ROUND_OF_32_SLOTS) {
    const s = simState[slot.eventId];
    if (!s || s.status !== 'finished') continue;
    const rt = resolvedTeams[slot.eventId];
    if (!rt) continue;
    const homeWon = s.homeScore > s.awayScore;
    roundOf32Results[slot.eventId] = {
      winner: homeWon ? rt.homeTeam : rt.awayTeam,
      loser:  homeWon ? rt.awayTeam : rt.homeTeam,
    };
  }

  // Ordenar oitavas por data para numerar "Round of 32 1", "Round of 32 2" etc.
  const r32Events = events.filter(ev => ev.season?.slug === 'round-of-32')
    .sort((a, b) => a.date.localeCompare(b.date));
  const r32ByIndex = {}; // 1-based index → eventId
  r32Events.forEach((ev, i) => { r32ByIndex[i + 1] = ev.id; });

  // Round of 16 resolution
  const roundOf16Slots = [
    { eventId: '760502', home: 'R32:1', away: 'R32:3' },
    { eventId: '760503', home: 'R32:2', away: 'R32:5' },
    { eventId: '760504', home: 'R32:4', away: 'R32:6' },
    { eventId: '760505', home: 'R32:7', away: 'R32:8' },
    { eventId: '760506', home: 'R32:11', away: 'R32:12' },
    { eventId: '760507', home: 'R32:9', away: 'R32:10' },
    { eventId: '760509', home: 'R32:14', away: 'R32:16' },
    { eventId: '760508', home: 'R32:13', away: 'R32:15' },
  ];

  for (const slot of roundOf16Slots) {
    const hIdx = parseInt(slot.home.split(':')[1]);
    const aIdx = parseInt(slot.away.split(':')[1]);
    resolvedTeams[slot.eventId] = {
      homeTeam: roundOf32Results[r32ByIndex[hIdx]]?.winner,
      awayTeam: roundOf32Results[r32ByIndex[aIdx]]?.winner,
    };
  }

  // Quartas
  const r16Events = events.filter(ev => ev.season?.slug === 'round-of-16')
    .sort((a, b) => a.date.localeCompare(b.date));
  const r16Results = {};
  r16Events.forEach((ev) => {
    const s = simState[ev.id];
    if (!s || s.status !== 'finished') return;
    const rt = resolvedTeams[ev.id];
    if (!rt) return;
    const homeWon = s.homeScore > s.awayScore;
    r16Results[ev.id] = {
      winner: homeWon ? rt.homeTeam : rt.awayTeam,
      loser:  homeWon ? rt.awayTeam : rt.homeTeam,
    };
  });
  const r16ByIndex = {};
  r16Events.forEach((ev, i) => { r16ByIndex[i + 1] = ev.id; });

  const quarterSlots = [
    { eventId: '760510', home: 'R16:1', away: 'R16:2' },
    { eventId: '760511', home: 'R16:5', away: 'R16:6' },
    { eventId: '760512', home: 'R16:3', away: 'R16:4' },
    { eventId: '760513', home: 'R16:7', away: 'R16:8' },
  ];
  for (const slot of quarterSlots) {
    const hIdx = parseInt(slot.home.split(':')[1]);
    const aIdx = parseInt(slot.away.split(':')[1]);
    resolvedTeams[slot.eventId] = {
      homeTeam: r16Results[r16ByIndex[hIdx]]?.winner,
      awayTeam: r16Results[r16ByIndex[aIdx]]?.winner,
    };
  }

  // Semis
  const qfEvents = events.filter(ev => ev.season?.slug === 'quarterfinals')
    .sort((a, b) => a.date.localeCompare(b.date));
  const qfResults = {};
  qfEvents.forEach((ev) => {
    const s = simState[ev.id];
    if (!s || s.status !== 'finished') return;
    const rt = resolvedTeams[ev.id];
    if (!rt) return;
    const homeWon = s.homeScore > s.awayScore;
    qfResults[ev.id] = {
      winner: homeWon ? rt.homeTeam : rt.awayTeam,
      loser:  homeWon ? rt.awayTeam : rt.homeTeam,
    };
  });
  const qfByIndex = {};
  qfEvents.forEach((ev, i) => { qfByIndex[i + 1] = ev.id; });

  resolvedTeams['760514'] = {
    homeTeam: qfResults[qfByIndex[1]]?.winner,
    awayTeam: qfResults[qfByIndex[2]]?.winner,
  };
  resolvedTeams['760515'] = {
    homeTeam: qfResults[qfByIndex[3]]?.winner,
    awayTeam: qfResults[qfByIndex[4]]?.winner,
  };

  // 3º lugar e final
  const sfResults = {};
  ['760514','760515'].forEach((id) => {
    const s = simState[id];
    if (!s || s.status !== 'finished') return;
    const rt = resolvedTeams[id];
    if (!rt) return;
    const homeWon = s.homeScore > s.awayScore;
    sfResults[id] = {
      winner: homeWon ? rt.homeTeam : rt.awayTeam,
      loser:  homeWon ? rt.awayTeam : rt.homeTeam,
    };
  });
  resolvedTeams['760516'] = { homeTeam: sfResults['760514']?.loser, awayTeam: sfResults['760515']?.loser };
  resolvedTeams['760517'] = { homeTeam: sfResults['760514']?.winner, awayTeam: sfResults['760515']?.winner };

  // Aplicar nos eventos
  return events.map(ev => {
    const rt = resolvedTeams[ev.id];
    const s = simState[ev.id];
    if (!rt && !s) return ev;

    const clone = JSON.parse(JSON.stringify(ev));
    const comp = clone.competitions[0];
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');

    // Substituir times se resolvidos
    if (rt?.homeTeam && home) {
      home.team = { id: rt.homeTeam.id, displayName: rt.homeTeam.displayName, abbreviation: rt.homeTeam.abbreviation, logos: rt.homeTeam.logos };
      home.id = rt.homeTeam.id;
    }
    if (rt?.awayTeam && away) {
      away.team = { id: rt.awayTeam.id, displayName: rt.awayTeam.displayName, abbreviation: rt.awayTeam.abbreviation, logos: rt.awayTeam.logos };
      away.id = rt.awayTeam.id;
    }

    // Aplicar placar/status
    if (s?.status === 'finished') {
      clone.status.type.name = 'STATUS_FINAL';
      clone.status.type.state = 'post';
      clone.status.type.completed = true;
      clone.status.type.description = 'Final';
      clone.status.type.shortDetail = 'FT';
      if (home) home.score = String(s.homeScore ?? 0);
      if (away) away.score = String(s.awayScore ?? 0);
    } else if (s?.status === 'in-progress') {
      clone.status.type.name = 'STATUS_IN_PROGRESS';
      clone.status.type.state = 'in';
      clone.status.type.completed = false;
      if (home) home.score = String(s.homeScore ?? 0);
      if (away) away.score = String(s.awayScore ?? 0);
    }

    return clone;
  });
}

module.exports = { resolveSlots, applyBracket, computeGroupStandings, ROUND_OF_32_SLOTS };
