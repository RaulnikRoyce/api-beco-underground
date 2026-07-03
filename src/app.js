// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // <-- Armadura 1
const rateLimit = require('express-rate-limit'); // <-- Armadura 2

const bandaRoutes = require('./routes/banda.routes');
const eventoRoutes = require('./routes/evento.routes');
const lineupRoutes = require('./routes/lineup.routes');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

// --- ÁREA DE SEGURANÇA (Sempre no topo) ---

// 1. Helmet: Esconde do mundo externo quais tecnologias a API usa
app.use(helmet());

// 2. CORS: Permite o acesso do frontend (podemos restringir isso no futuro)
app.use(cors());

// 3. Rate Limiter: Bloqueia ataques de força bruta (ex: 100 tentativas em 15 min)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de requisições por IP
    message: { erro: "Muitas requisições detectadas deste IP. Por favor, tente novamente mais tarde." }
});
app.use(limiter);

// --- CONFIGURAÇÕES BÁSICAS ---
app.use(express.json());

// --- REGISTRO DE ROTAS ---
app.use('/bandas', bandaRoutes);
app.use('/eventos', eventoRoutes);
app.use('/lineup', lineupRoutes);
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);

// Rota de teste
app.get('/', (req, res) => res.json({ mensagem: 'API operacional' }));

module.exports = app;