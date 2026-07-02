// 1. IMPORTAÇÕES (TODAS NO TOPO)
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 2. CONFIGURAÇÕES INICIAIS
const app = express();
app.use(express.json()); // Entender JSON
app.use(cors());         // Permitir comunicação com o Frontend

// 3. CONEXÃO COM O BANCO DE DADOS
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) throw err;
    console.log('Banco de dados conectado com sucesso!');
});

// ==========================================
// ROTAS DE SISTEMA & AUTENTICAÇÃO
// ==========================================

// Rota de Teste (Raiz)
app.get('/', (req, res) => {
    res.json({ mensagem: 'A API de eventos está viva e rodando!' });
});

// Rota de Login 
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro no servidor' });
        if (resultados.length === 0) return res.status(401).json({ erro: 'Usuário não encontrado' });

        const usuario = resultados[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        
        if (!senhaValida) return res.status(401).json({ erro: 'Senha incorreta' });

        const token = jwt.sign({ id: usuario.id }, 'MINHA_CHAVE_SECRETA_MUITO_SEGURA', { expiresIn: '1h' });
        res.json({ mensagem: 'Login realizado com sucesso!', token });
    });
});

// ==========================================
// ROTAS DE EVENTOS
// ==========================================

app.get('/eventos', (req, res) => {
    db.query('SELECT * FROM eventos', (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao buscar eventos' });
        res.json(resultados);
    });
});

app.post('/eventos', (req, res) => {
    const { nome, data, local } = req.body;
    db.query('INSERT INTO eventos (nome, data, local) VALUES (?, ?, ?)', [nome, data, local], (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao criar evento' });
        res.status(201).json({ mensagem: 'Evento criado!', id: resultados.insertId });
    });
});

app.put('/eventos/:id', (req, res) => {
    const { id } = req.params;
    const { nome, data, local, status } = req.body;
    db.query('UPDATE eventos SET nome = ?, data = ?, local = ?, status = ? WHERE id = ?', [nome, data, local, status, id], (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao atualizar evento' });
        res.json({ mensagem: 'Evento atualizado!' });
    });
});

app.delete('/eventos/:id', (req, res) => {
    db.query('DELETE FROM eventos WHERE id = ?', [req.params.id], (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao deletar evento' });
        res.json({ mensagem: 'Evento removido!' });
    });
});

// ==========================================
// ROTAS DE BANDAS
// ==========================================

app.get('/bandas', (req, res) => {
    db.query('SELECT * FROM bandas', (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao buscar bandas' });
        res.json(resultados);
    });
});

app.post('/bandas', (req, res) => {
    const { nome, genero, contato, cache_base } = req.body;
    db.query('INSERT INTO bandas (nome, genero, contato, cache_base) VALUES (?, ?, ?, ?)', [nome, genero, contato, cache_base], (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao cadastrar banda' });
        res.status(201).json({ mensagem: 'Banda cadastrada com sucesso!', id: resultados.insertId });
    });
});

app.delete('/bandas/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM bandas WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.status(200).send({ message: 'Banda deletada com sucesso!' });
    });
});

// ==========================================
// ROTAS DE LINE-UP
// ==========================================

app.get('/lineup/:evento_id', (req, res) => {
    const { evento_id } = req.params;
    const sql = `
        SELECT l.id AS lineup_id, b.nome, b.genero, l.horario, 
               COALESCE(l.cache_negociado, b.cache_base) AS cache
        FROM lineup l
        JOIN bandas b ON l.banda_id = b.id
        WHERE l.evento_id = ?
        ORDER BY l.horario ASC
    `;
    db.query(sql, [evento_id], (err, results) => {
        if (err) return res.status(500).send(err);
        res.status(200).json(results);
    });
});

app.post('/lineup', (req, res) => {
    const { evento_id, banda_id, horario, cache_negociado } = req.body;
    const cacheFinal = cache_negociado ? cache_negociado : null; 
    
    const sql = 'INSERT INTO lineup (evento_id, banda_id, horario, cache_negociado) VALUES (?, ?, ?, ?)';
    db.query(sql, [evento_id, banda_id, horario, cacheFinal], (err, result) => {
        if (err) return res.status(500).send(err);
        res.status(201).send({ message: 'Artista adicionado ao line-up!', id: result.insertId });
    });
});

// ==========================================
// ROTA DO DASHBOARD (Custos do Evento)
// ==========================================

app.get('/dashboard/:evento_id', (req, res) => {
    const eventoId = req.params.evento_id;
    const sql = `
        SELECT 
            b.nome AS banda,
            l.horario,
            COALESCE(l.cache_negociado, b.cache_base) AS custo_banda
        FROM lineup l
        JOIN bandas b ON l.banda_id = b.id
        WHERE l.evento_id = ?
        ORDER BY l.horario ASC
    `;
    db.query(sql, [eventoId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao gerar dashboard' });
        }
        
        let custoTotal = 0;
        results.forEach(item => {
            custoTotal += parseFloat(item.custo_banda || 0);
        });

        res.json({
            evento_id: eventoId,
            total_bandas: results.length,
            custo_total_caches: custoTotal,
            atracoes: results
        });
    });
});

// 4. INICIAR O SERVIDOR (Mantendo o padrão exigido pelo Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});