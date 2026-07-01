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
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'beco_underground',
  port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) throw err;
    console.log('Banco de dados conectado!');
});

// --- ROTAS DO SISTEMA ---

// Rota de Teste
app.get('/', (req, res) => {
    res.json({ mensagem: 'A API de eventos está viva e rodando!' });
});

// Rota de Login (Autenticação)
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

// Rota para deletar evento
app.delete('/eventos/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM eventos WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.status(200).send({ message: 'Evento deletado com sucesso!' });
    });
});

// ==========================================
// ROTAS PARA GERENCIAMENTO DE BANDAS
// ==========================================

// Listar todas as bandas
app.get('/bandas', (req, res) => {
    const sql = 'SELECT * FROM bandas';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        res.status(200).json(results);
    });
});

// Cadastrar uma nova banda
app.post('/bandas', (req, res) => {
    // Usando as colunas exatas do seu phpMyAdmin
    const { nome, genero, contato, cache_base } = req.body; 
    const sql = 'INSERT INTO bandas (nome, genero, contato, cache_base) VALUES (?, ?, ?, ?)';
    
    db.query(sql, [nome, genero, contato, cache_base], (err, result) => {
        if (err) return res.status(500).send(err);
        res.status(201).send({ message: 'Banda cadastrada com sucesso!', id: result.insertId });
    });
});

// Deletar uma banda
app.delete('/bandas/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM bandas WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.status(200).send({ message: 'Banda deletada com sucesso!' });
    });
});

// --- MÓDULO DE EVENTOS ---
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

// --- MÓDULO DE BANDAS ---
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
        res.json({ mensagem: 'Banda cadastrada!', id: resultados.insertId });
    });
});

// --- MÓDULO DE LINEUP ---
app.post('/lineup', (req, res) => {
    const { evento_id, banda_id, horario } = req.body;
    db.query('INSERT INTO lineup (evento_id, banda_id, horario) VALUES (?, ?, ?)', [evento_id, banda_id, horario], (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao criar o lineup' });
        res.status(201).json({ mensagem: 'Banda adicionada ao line-up!', id: resultados.insertId });
    });
});

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

// ==========================================
// ROTAS PARA GERENCIAMENTO DE LINE-UP
// ==========================================

// Listar o line-up de um evento específico (A mágica do JOIN)
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

// Adicionar banda ao line-up
app.post('/lineup', (req, res) => {
    const { evento_id, banda_id, horario, cache_negociado } = req.body;
    // Se o cache_negociado vier vazio, inserimos como nulo para o banco usar o cache_base depois
    const cacheFinal = cache_negociado ? cache_negociado : null; 
    
    const sql = 'INSERT INTO lineup (evento_id, banda_id, horario, cache_negociado) VALUES (?, ?, ?, ?)';
    db.query(sql, [evento_id, banda_id, horario, cacheFinal], (err, result) => {
        if (err) return res.status(500).send(err);
        res.status(201).send({ message: 'Artista adicionado ao line-up!', id: result.insertId });
    });
});

// 4. INICIAR O SERVIDOR
const PORTA = 3000;
app.listen(PORTA, () => {
    console.log(`Servidor rodando! Acesse: http://localhost:${PORTA}`);
});