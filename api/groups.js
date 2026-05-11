const fetch = require('node-fetch');

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Rota: /api/groups          → lista de grupos
  // Rota: /api/groups?id=3     → detalhe do grupo
  // Rota: /api/groups?id=3&standings=1 → standings do grupo
  const { id, standings } = req.query;

  let url;
  if (!id) {
    url = `${ESPN_CORE}/seasons/2026/types/1/groups`;
  } else if (standings) {
    url = `${ESPN_CORE}/seasons/2026/types/1/groups/${id}/standings/0`;
  } else {
    url = `${ESPN_CORE}/seasons/2026/types/1/groups/${id}`;
  }

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
