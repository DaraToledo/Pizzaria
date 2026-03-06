import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Garante que a tabela existe
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS pizzaria_config (
      id      INTEGER PRIMARY KEY DEFAULT 1,
      data    JSONB   NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async function handler(req, res) {
  // CORS — necessário para o admin acessar a API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  await ensureTable();

  // ── GET /api/config → leitura pública (cardápio) ──────────────────
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    const rows = await sql`SELECT data FROM pizzaria_config WHERE id = 1`;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Configuração ainda não salva.' });
    }
    return res.status(200).json(rows[0].data);
  }

  // ── PUT /api/config → escrita protegida (admin) ───────────────────
  if (req.method === 'PUT') {
    const secret = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Corpo inválido.' });
    }

    await sql`
      INSERT INTO pizzaria_config (id, data, updated_at)
      VALUES (1, ${JSON.stringify(body)}, NOW())
      ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data,
            updated_at = NOW()
    `;

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
