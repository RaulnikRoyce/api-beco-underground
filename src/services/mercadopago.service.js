const { AppError } = require('../utils/erros');

const MP_API = 'https://api.mercadopago.com';

const token = () => {
    const t = process.env.MP_ACCESS_TOKEN;
    if (!t) throw new AppError(503, 'Pagamento indisponível. Configure MP_ACCESS_TOKEN.');
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
        throw new AppError(502, body.message || 'Erro na comunicação com Mercado Pago');
    }
    return body;
}

exports.criarPreferencia = async ({
    titulo,
    quantidade,
    precoUnitario,
    codigoPedido,
    email,
    lojaUrl,
    apiUrl
}) => {
    const backUrl = `${lojaUrl.replace(/\/$/, '')}/pedido/${codigoPedido}`;

    const preferencia = await mpFetch('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify({
            items: [{
                title: titulo,
                quantity: quantidade,
                unit_price: precoUnitario,
                currency_id: 'BRL'
            }],
            payer: { email },
            external_reference: codigoPedido,
            back_urls: {
                success: backUrl,
                failure: `${backUrl}?status=falha`,
                pending: backUrl
            },
            auto_return: 'approved',
            notification_url: `${apiUrl.replace(/\/$/, '')}/ingressos/webhook`,
            statement_descriptor: 'BECO UNDERGROUND'
        })
    });

    return {
        preference_id: preferencia.id,
        init_point: preferencia.init_point || preferencia.sandbox_init_point
    };
};

exports.obterPagamento = (paymentId) => mpFetch(`/v1/payments/${paymentId}`);

exports.extrairPaymentId = (body) => {
    if (body?.data?.id) return String(body.data.id);
    if (body?.id) return String(body.id);
    return null;
};
