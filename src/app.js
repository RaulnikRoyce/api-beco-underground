const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const bandaRoutes = require('./routes/banda.routes');
const eventoRoutes = require('./routes/evento.routes');
const lineupRoutes = require('./routes/lineup.routes');
const authRoutes = require('./routes/auth.routes');
const publicoRoutes = require('./routes/publico.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const pedidoRoutes = require('./routes/pedido.routes');
const { manipularErros, rotaNaoEncontrada } = require('./middlewares/erros');
const logger = require('./utils/logger');
const openapi = require('./docs/openapi.json');
const db = require('./database/db');
const { responderHealth } = require('./utils/saude');

const app = express();
const emProducao = process.env.NODE_ENV === 'production';

if (emProducao) {
    app.set('trust proxy', 1);
}

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const local = !emProducao && (
            origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
        );
        if (local || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: true
}));

app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/openapi.json' || req.path === '/logo-beco.png') return next();
    const inicio = Date.now();
    res.on('finish', () => {
        logger.info('http', {
            metodo: req.method,
            rota: req.path,
            status: res.statusCode,
            ms: Date.now() - inicio
        });
    });
    next();
});

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
    skip: (req) => req.path === '/health' || req.path === '/logo-beco.png'
}));

app.get('/health', responderHealth(db));
app.get('/openapi.json', (_req, res) => res.json(openapi));
app.get('/logo-beco.png', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'logo-beco.png'));
});

app.use('/auth', authRoutes);
app.use('/publico', publicoRoutes);
app.use('/bandas', bandaRoutes);
app.use('/eventos', eventoRoutes);
app.use('/lineup', lineupRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/ingressos', pedidoRoutes);

app.get('/', (_req, res) => res.json({
    mensagem: 'API Beco Underground operacional',
    docs: '/openapi.json',
    health: '/health',
    logo: '/logo-beco.png'
}));

app.use(rotaNaoEncontrada);
app.use(manipularErros);

module.exports = app;
