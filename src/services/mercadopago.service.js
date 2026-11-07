const crypto = require('crypto');
const { AppError } = require('../utils/erros');
const logger = require('../utils/logger');

const MP_API = 'https://api.mercadopago.com';

const token = () => {
    const t = process.env.MP_ACCESS_TOKEN;
    if (!t) {
        throw new AppError(503, 'Pagamento temporariamente indisponível. Tente mais tarde ou fale com a produção do evento.');
    }
    return t;
};

async function mpFetch(path, options = {}) {
    const res = await fetch(`${MP_API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token()}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        logger.error('Erro na comunicação com Mercado Pago', {
            path,
            status: res.status,
            detalhe: body.message || body.error || JSON.stringify(body).slice(0, 500)
        });
        throw new AppError(502, 'Não foi possível falar com o Mercado Pago agora. Tente de novo em instantes.');
    }
    return body;
}

const urlPublicaHttps = (valor) => {
    try {
        const url = new URL(valor);
        if (url.protocol !== 'https:') return false;
        const host = url.hostname.toLowerCase();
        return host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.local');
    } catch {
        return false;
    }
};

exports.montarCorpoPreferencia = ({
    titulo,
    quantidade,
    total,
    codigoPedido,
    email,
    lojaUrl,
    apiUrl
}) => {
    const backUrl = `${String(lojaUrl || '').replace(/\/$/, '')}/pedido/${codigoPedido}`;
    const notificationUrl = `${String(apiUrl || '').replace(/\/$/, '')}/ingressos/webhook`;

    const corpo = {
        items: [{
            title: quantidade > 1 ? `${titulo} (${quantidade}x)` : titulo,
            quantity: 1,
            unit_price: total,
            currency_id: 'BRL'
        }],
        payer: { email },
        external_reference: codigoPedido,
        statement_descriptor: 'BECO UNDERGROUND'
    };

    const emProducao = process.env.NODE_ENV === 'production';

    if (emProducao && urlPublicaHttps(backUrl)) {
        corpo.back_urls = {
            success: backUrl,
            failure: `${backUrl}?status=falha`,
            pending: backUrl
        };
        corpo.auto_return = 'approved';
    }

    if (emProducao && urlPublicaHttps(notificationUrl)) {
        corpo.notification_url = notificationUrl;
    }

    return corpo;
};

exports.urlPublicaHttps = urlPublicaHttps;

exports.criarPreferencia = async (dados) => {
    const preferencia = await mpFetch('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify(exports.montarCorpoPreferencia(dados))
    });

    return {
        preference_id: preferencia.id,
        init_point: preferencia.init_point || preferencia.sandbox_init_point
    };
};

exports.obterPagamento = (paymentId) => mpFetch(`/v1/payments/${paymentId}`);

exports.estornarPagamento = async (paymentId, chave) => {
    if (!chave) throw new Error('Estorno exige chave de idempotência persistida.');
    const resposta = await mpFetch(`/v1/payments/${paymentId}/refunds`, {
        method: 'POST',
        headers: { 'X-Idempotency-Key': chave },
        signal: AbortSignal.timeout(15000)
    });
    if (resposta.status !== 'approved' || String(resposta.payment_id) !== String(paymentId)) throw new AppError(502, 'O estorno ainda não foi confirmado para este pagamento.');
    return resposta;
};

exports.extrairPaymentId = (body) => {
    const id = body?.data?.id ?? body?.id;
    const normalizado = String(id || '').trim();
    return /^\d{1,32}$/.test(normalizado) ? normalizado : null;
};

function decompoerAssinatura(headerXSignature) {
    const partes = {};
    String(headerXSignature || '').split(',').forEach((par) => {
        const [chave, valor] = par.split('=').map((s) => (s || '').trim());
        if (chave && valor) partes[chave] = valor;
    });
    return { ts: partes.ts, v1: partes.v1 };
}

exports.validarAssinaturaWebhook = ({ xSignature, xRequestId, dataId, secret }) => {
    const { ts, v1 } = decompoerAssinatura(xSignature);
    if (!ts || !v1 || !xRequestId || !dataId || !secret) return false;

    const manifest = `id:${String(dataId).toLowerCase()};request-id:${xRequestId};ts:${ts};`;
    const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    const bufferEsperado = Buffer.from(esperado, 'hex');
    const bufferRecebido = Buffer.from(v1, 'hex');
    if (bufferEsperado.length !== bufferRecebido.length) return false;

    return crypto.timingSafeEqual(bufferEsperado, bufferRecebido);
};
