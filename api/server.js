const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world';

// CORS aberto para qualquer localhost (Angular pode rodar em 4200, 4201, etc.)
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

async function espnGet(url, res) {
  try {
    console.log(`  → ESPN: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) {
      console.error(`  ← ESPN ${response.status} para ${url}`);
      return res.status(response.status).json({ error: `ESPN retornou ${response.status}` });
    }
    const data = await response.json();
    console.log(`  ← OK`);
    res.json(data);
  } catch (err) {
    console.error(`  ← ERRO: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/teams
app.get('/api/teams', (req, res) => {
  espnGet(`${ESPN_BASE}/teams`, res);
});

// GET /api/scoreboard?dates=20260611-20260627&limit=200
app.get('/api/scoreboard', (req, res) => {
  const { dates = '20260611-20260719', limit = 200 } = req.query;
  espnGet(`${ESPN_BASE}/scoreboard?limit=${limit}&dates=${dates}`, res);
});

// GET /api/groups
app.get('/api/groups', (req, res) => {
  espnGet(`${ESPN_CORE}/seasons/2026/types/1/groups`, res);
});

// GET /api/groups/:id  → detalhe do grupo
app.get('/api/groups/:id', (req, res) => {
  espnGet(`${ESPN_CORE}/seasons/2026/types/1/groups/${req.params.id}`, res);
});

// GET /api/groups/:id/standings  → times do grupo
app.get('/api/groups/:id/standings', (req, res) => {
  espnGet(`${ESPN_CORE}/seasons/2026/types/1/groups/${req.params.id}/standings/0`, res);
});

app.listen(PORT, () => {
  console.log(`\n✅ API proxy ESPN rodando em http://localhost:${PORT}`);
  console.log(`   Rotas disponíveis:`);
  console.log(`   GET /api/teams`);
  console.log(`   GET /api/scoreboard?dates=YYYYMMDD-YYYYMMDD`);
  console.log(`   GET /api/groups`);
  console.log(`   GET /api/groups/:id`);
  console.log(`   GET /api/groups/:id/standings\n`);
});
