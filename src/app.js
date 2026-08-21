const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const bandaRoutes = require('./routes/banda.routes');
const eventoRoutes = require('./routes/evento.routes');
const lineupRoutes = require('./routes/lineup.routes');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const { manipularErros, rotaNaoEncontrada } = require('./middlewares/erros');
const logger = require('./utils/logger');
const openapi = require('./docs/openapi.json');

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
    if (req.path === '/health' || req.path === '/openapi.json') return next();
    const inicio = Date.now();
    res.on('finish', () => {
        logger.info('http', {
            metodo: req.method,
            rota: req.originalUrl,
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
    skip: (req) => req.path === '/health'
}));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/openapi.json', (_req, res) => res.json(openapi));

app.use('/auth', authRoutes);
app.use('/bandas', bandaRoutes);
app.use('/eventos', eventoRoutes);
app.use('/lineup', lineupRoutes);
app.use('/dashboard', dashboardRoutes);

app.get('/', (_req, res) => res.json({
    mensagem: 'API Beco Underground operacional',
    docs: '/openapi.json',
    health: '/health'
}));

app.use(rotaNaoEncontrada);
app.use(manipularErros);

module.exports = app;
