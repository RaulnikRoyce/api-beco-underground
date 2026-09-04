const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');

const AUDIENCIA = 'loja-ingressos-preview';
const EMISSOR = 'api-beco-underground';

exports.gerarTokenPreview = (eventoId) => jwt.sign(
    { evento_id: Number(eventoId), escopo: 'preview_ingressos' },
    getJwtSecret(),
    { expiresIn: '5m', audience: AUDIENCIA, issuer: EMISSOR }
);

exports.validarTokenPreview = (token, eventoId) => {
    try {
        const payload = jwt.verify(token, getJwtSecret(), {
            audience: AUDIENCIA,
            issuer: EMISSOR
        });
        return payload.escopo === 'preview_ingressos'
            && Number(payload.evento_id) === Number(eventoId);
    } catch {
        return false;
    }
};
