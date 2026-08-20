const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const bandaRoutes = require('./routes/banda.routes');
const eventoRoutes = require('./routes/evento.routes');
const lineupRoutes = require('./routes/lineup.routes');
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições. Tente novamente mais tarde.' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas de autenticação. Tente novamente mais tarde.' },
});

app.use(limiter);
app.use('/auth', authLimiter, authRoutes);
app.use('/bandas', bandaRoutes);
app.use('/eventos', eventoRoutes);
app.use('/lineup', lineupRoutes);
app.use('/dashboard', dashboardRoutes);

app.get('/health', (req, res) => {
    return res.status(200).json({ status: 'ok' });
});

app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);

    if (res.headersSent) {
        return next(err);
    }

    return res.status(500).json({ erro: 'Erro interno do servidor.' });
});

module.exports = app;
