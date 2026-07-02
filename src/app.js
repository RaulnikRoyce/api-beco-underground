// src/app.js
const express = require('express');
const cors = require('cors');
const bandaRoutes = require('./routes/banda.routes'); // O arquivo que criamos antes
const eventoRoutes = require('./routes/evento.routes');
const lineupRoutes = require('./routes/lineup.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

// Configurações (que antes ficavam no server.js)
app.use(express.json());
app.use(cors());

// Registro de rotas
app.use('/bandas', bandaRoutes);
app.use('/eventos', eventoRoutes);
app.use('/lineup', lineupRoutes);
app.use('/auth', authRoutes);

// Rota de teste
app.get('/', (req, res) => res.json({ mensagem: 'API operacional' }));

module.exports = app;