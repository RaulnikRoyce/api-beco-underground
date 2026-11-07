const pedidoService = require('../services/pedido.service');
const logger = require('../utils/logger');

const INTERVALO_PADRAO_MS = 5 * 60 * 1000;

let intervalo = null;

async function rodar() {
    try {
        const resultado = await pedidoService.expirarReservas();
        if (resultado.expirados) {
            logger.info('Reservas expiradas liberadas', { quantidade: resultado.expirados });
        }
    } catch (err) {
        logger.error('Falha ao rodar expiração de reservas', { detalhe: err.message });
    }
    try {
        await pedidoService.retomarCancelamentos();
    } catch (err) {
        logger.error('Falha ao retomar cancelamentos', { detalhe: err.message });
    }

}

function iniciar({ intervaloMs = Number(process.env.INGRESSOS_EXPIRACAO_INTERVALO_MS) || INTERVALO_PADRAO_MS } = {}) {
    if (intervalo) return intervalo;

    rodar();
    intervalo = setInterval(rodar, intervaloMs);
    intervalo.unref();
    return intervalo;
}

function parar() {
    if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
    }
}

module.exports = { iniciar, parar };
