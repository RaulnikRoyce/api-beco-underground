const path = require('path');
const bcrypt = require('bcryptjs');

async function seed({ env = process.env, db } = {}) {
  const email = String(env.SEED_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const senha = env.SEED_ADMIN_PASSWORD || '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || senha.length < 12 || senha.length > 128 || !senha.trim()) {
    throw new Error('Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD com uma senha de 12 a 128 caracteres.');
  }
  const pool = db || require('../src/database/db');
  const consultar = (sql, params) =>
    new Promise((resolve, reject) => {
      pool.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
  const existente = async () => {
    const rows = await consultar('SELECT id, perfil FROM usuarios WHERE email = ?', [email]);
    if (!rows.length) return null;
    if (rows[0].perfil !== 'admin')
      throw new Error('O e-mail já pertence a uma conta cadastrada. Use outro e-mail para criar o admin.');
    return { criado: false, id: rows[0].id };
  };
  const atual = await existente();
  if (atual) return atual;
  const hash = await bcrypt.hash(senha, 10);
  try {
    const result = await consultar('INSERT INTO usuarios (email, senha, perfil) VALUES (?, ?, ?)', [
      email,
      hash,
      'admin'
    ]);
    return { criado: true, id: result.insertId };
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') throw err;
    const concorrente = await existente();
    if (!concorrente) throw err;
    return concorrente;
  }
}

if (require.main === module) {
  const envDaSessao = Boolean(process.env.DB_HOST);

  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  require('dotenv').config({
    path: path.join(__dirname, '..', '.env.local'),
    override: !envDaSessao
  });

  seed()
    .then((resultado) => {
      console.log(
        resultado.criado ? 'Administrador criado.' : 'Administrador existente preservado, sem alterar senha ou perfil.'
      );
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => {
      const dbPath = require.resolve('../src/database/db');
      if (require.cache[dbPath]) require(dbPath).end();
    });
}

module.exports = { seed };
