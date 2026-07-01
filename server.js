// 1. Importando o garçom (Express) que instalamos
const express = require('express');

// Importando a conexão com o banco de dados que acabamos de criar
const db = require('./db');

const cors = require('cors'); // Importar a biblioteca
app.use(cors()); // Ativar o CORS para todas as rotas

// 2. Inicializando o aplicativo
const app = express();

// 3. Configurando para que a nossa API entenda dados no formato JSON
app.use(express.json());

// 4. Criando a nossa primeira rota de teste
// Quando alguém acessar a raiz ('/'), devolvemos essa mensagem
app.get('/', (req, res) => {
    res.json({ mensagem: 'A API de eventos está viva e rodando!' });
});

// Rota para listar todos os eventos (GET)
app.get('/eventos', (req, res) => {
    // 1. Escrevemos a instrução SQL para buscar tudo na tabela 'eventos'
    const query = 'SELECT * FROM eventos';
    
    // 2. Pedimos ao nosso 'db' para executar essa instrução no MySQL
    db.query(query, (err, resultados) => {
        if (err) {
            // Se o banco de dados der erro, registramos no terminal e avisamos o cliente
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao buscar os eventos no banco de dados' });
        }
        // Se der tudo certo, entregamos os resultados em formato JSON
        res.json(resultados);
    });
});

// --- MÓDULO DE BANDAS ---

// Rota GET: Listar todas as bandas
app.get('/bandas', (req, res) => {
    db.query('SELECT * FROM bandas', (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao buscar bandas' });
        res.json(resultados);
    });
});

// Rota POST: Criar nova banda
app.post('/bandas', (req, res) => {
    const { nome, genero, contato, cache_base } = req.body;
    const query = 'INSERT INTO bandas (nome, genero, contato, cache_base) VALUES (?, ?, ?, ?)';
    db.query(query, [nome, genero, contato, cache_base], (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao cadastrar banda' });
        res.json({ mensagem: 'Banda cadastrada!', id: resultados.insertId });
    });
});

// Rota para ADICIONAR uma banda ao line-up de um evento
app.post('/lineup', (req, res) => {
    const { evento_id, banda_id, horario } = req.body;
    
    // O comando SQL liga os IDs das duas tabelas diferentes
    const query = 'INSERT INTO lineup (evento_id, banda_id, horario) VALUES (?, ?, ?)';
    
    db.query(query, [evento_id, banda_id, horario], (err, resultados) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao criar o lineup' });
        }
        res.status(201).json({ mensagem: 'Banda adicionada ao line-up do evento!', id: resultados.insertId });
    });
});

// Rota para BUSCAR o line-up completo de um evento (JOIN)
app.get('/lineup/:evento_id', (req, res) => {
    const { evento_id } = req.params;

    // Usamos o INNER JOIN para combinar as tabelas
    // O 'b' e o 'l' são apelidos (aliases) para facilitar a leitura
    const query = `
        SELECT l.id, b.nome AS banda_nome, b.genero, l.horario
        FROM lineup l
        INNER JOIN bandas b ON l.banda_id = b.id
        WHERE l.evento_id = ?
    `;

    db.query(query, [evento_id], (err, resultados) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao buscar o line-up' });
        }
        res.json(resultados);
    });
});

// Rota PUT: Atualizar banda
app.put('/bandas/:id', (req, res) => {
    const { id } = req.params;
    const { nome, genero, contato, cache_base } = req.body;
    const query = 'UPDATE bandas SET nome = ?, genero = ?, contato = ?, cache_base = ? WHERE id = ?';
    db.query(query, [nome, genero, contato, cache_base, id], (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao atualizar banda' });
        res.json({ mensagem: 'Banda atualizada!' });
    });
});

// Rota DELETE: Remover banda
app.delete('/bandas/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM bandas WHERE id = ?', [id], (err, resultados) => {
        if (err) return res.status(500).json({ erro: 'Erro ao deletar banda' });
        res.json({ mensagem: 'Banda removida!' });
    });
});

// Rota para CRIAR um novo evento (POST)
app.post('/eventos', (req, res) => {
    // 1. Pegamos os dados que o usuário enviou no "corpo" (body) da requisição
    const { nome, data, local } = req.body;

    // 2. Montamos o comando SQL de inserção (Os '?' são uma medida de segurança contra hackers)
    const query = 'INSERT INTO eventos (nome, data, local) VALUES (?, ?, ?)';

    // 3. Executamos no banco de dados
    db.query(query, [nome, data, local], (err, resultados) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao criar o evento' });
        }
        // Se der certo, retornamos o status 201 (Created) e o ID gerado pelo MySQL
        res.status(201).json({ 
            mensagem: 'Evento do Beco Underground criado com sucesso!', 
            id: resultados.insertId 
        });
    });
});

// Rota para ATUALIZAR um evento existente (PUT)
app.put('/eventos/:id', (req, res) => {
    const { id } = req.params; // Pegamos o ID da URL
    const { nome, data, local, status } = req.body; // Pegamos os dados novos

    const query = 'UPDATE eventos SET nome = ?, data = ?, local = ?, status = ? WHERE id = ?';
    
    db.query(query, [nome, data, local, status, id], (err, resultados) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao atualizar o evento' });
        }
        res.json({ mensagem: 'Evento atualizado com sucesso!' });
    });
});

// Rota para APAGAR um evento (DELETE)
app.delete('/eventos/:id', (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM eventos WHERE id = ?';

    db.query(query, [id], (err, resultados) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ erro: 'Erro ao deletar o evento' });
        }
        res.json({ mensagem: 'Evento removido com sucesso!' });
    });
});

// 5. Definindo a porta do servidor e ligando a máquina
const PORTA = 3000;
app.listen(PORTA, () => {
    console.log(`Servidor rodando! Acesse: http://localhost:${PORTA}`);
});