const crypto = require('crypto');
const cancelamentoRepository = require('../repositories/cancelamento.repository');
const db = require('../database/db');
const ingressoRepository = require('../repositories/ingresso.repository');
const pedidoRepository = require('../repositories/pedido.repository');
const cupomRepository = require('../repositories/cupom.repository');
const listaEsperaRepository = require('../repositories/lista-espera.repository');
const mercadopagoService = require('../services/mercadopago.service');
const eventoRepository = require('../repositories/evento.repository');
const { AppError } = require('../utils/erros');
const { podeEditarEvento } = require('../utils/evento.regras');
const { obterLoteVigente, restamDoLote } = require('../utils/lote.regras');
const logger = require('../utils/logger');

const MAX_POR_PEDIDO = Number(process.env.INGRESSOS_MAX_POR_PEDIDO) || 4;
const MAX_POR_EMAIL = Number(process.env.INGRESSOS_MAX_POR_EMAIL) || 4;
const RESERVA_MIN = Number(process.env.INGRESSOS_RESERVA_MIN) || 15;

const arredondar = (v) => Math.round(Number(v) * 100) / 100;
const emCentavos = (valor) => Math.round(Number(valor) * 100);

const escaparHtml = (valor) => String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const celulaCsv = (valor) => {
    let texto = String(valor ?? '').replace(/[\r\n]+/g, ' ');
    if (/^[=+\-@\t]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
};

const calcularTaxa = (total, config) => {
    const pct = Number(config?.taxa_mp_percentual) || 0;
    return arredondar(total * pct / 100);
};

const aplicarCupom = async (eventoId, codigoCupom, subtotal) => {
    if (!codigoCupom) return { total: subtotal, desconto: 0, cupom_id: null };

    const cupom = await cupomRepository.buscarPorCodigo(eventoId, codigoCupom.trim().toUpperCase());
    if (!cupom) throw new AppError(400, 'Cupom inválido');
    if (cupom.uso_max != null && cupom.uso_atual >= cupom.uso_max) {
        throw new AppError(400, 'Cupom esgotado');
    }

    const desconto = arredondar(subtotal * Number(cupom.desconto_percentual) / 100);
    return {
        total: arredondar(subtotal - desconto),
        desconto,
        cupom_id: cupom.id
    };
};

const calcularPrecoPedido = async (evento, lote, qtd, codigoCupom) => {
    const subtotal = arredondar(Number(lote.preco) * qtd);
    const cupomAplicado = await aplicarCupom(evento.id, codigoCupom, subtotal);
    const repassa = Number(evento.repassa_taxa_comprador) === 1;
    const taxa = calcularTaxa(cupomAplicado.total, evento);
    const total = repassa ? arredondar(cupomAplicado.total + taxa) : cupomAplicado.total;

    return {
        subtotal,
        desconto: cupomAplicado.desconto,
        cupom_id: cupomAplicado.cupom_id,
        repassa,
        taxa,
        total
    };
};

const emitirIngressosDoPedidoTx = async (exec, pedidoId, loteId, quantidade) => {
    const ingressos = [];
    for (let i = 0; i < quantidade; i += 1) {
        const codigo = crypto.randomBytes(12).toString('hex');
        ingressos.push(await ingressoRepository.criarIngressoEmitidoTx(exec, {
            codigo,
            pedido_id: pedidoId,
            lote_id: loteId
        }));
    }
    return ingressos;
};

async function repararIngressos(pedidoId) {
    return db.comTransacao(async (exec) => {
        const rows = await exec('SELECT status FROM pedidos_ingresso WHERE id = ? FOR UPDATE', [pedidoId]);
        if (rows[0]?.status !== 'pago') throw new AppError(409, 'Pedido não está pago para reparar ingressos.');
        const cancelamentos = await exec("SELECT pedido_id FROM cancelamentos_ingresso WHERE pedido_id = ? AND status = 'pendente'", [pedidoId]);
        if (cancelamentos.length) throw new AppError(409, 'Cancelamento em processamento.');
        const itens = await exec('SELECT lote_id, quantidade FROM itens_pedido WHERE pedido_id = ?', [pedidoId]);
        if (!itens.length) throw new AppError(500, 'Pedido sem itens');
        const existentes = await exec('SELECT id, codigo, lote_id, status FROM ingressos_emitidos WHERE pedido_id = ? ORDER BY id FOR UPDATE', [pedidoId]);
        const quantidades = new Map();
        for (const item of itens) quantidades.set(item.lote_id, (quantidades.get(item.lote_id) || 0) + Number(item.quantidade));
        for (const ingresso of existentes) {
            if (!quantidades.has(ingresso.lote_id) || ingresso.status === 'cancelado') throw new AppError(409, 'Emissão inconsistente; revisão manual necessária.');
            quantidades.set(ingresso.lote_id, quantidades.get(ingresso.lote_id) - 1);
        }
        const novos = [];
        for (const [loteId, faltam] of quantidades) {
            if (faltam < 0) throw new AppError(409, 'Emissão excedente; revisão manual necessária.');
            novos.push(...await emitirIngressosDoPedidoTx(exec, pedidoId, loteId, faltam));
        }
        return novos.length ? { jaPago: true, ingressos: novos } : { jaPago: true };
    });
}

exports.confirmarPagamentoPedido = async (pedido, mpPaymentId) => {
    if (pedido.status === 'pago') return repararIngressos(pedido.id);

    const itens = await pedidoRepository.buscarItensPedido(pedido.id);
    if (!itens.length) throw new AppError(500, 'Pedido sem itens');

    let ingressosEmitidos = [];
    const pagamentoConfirmadoAgora = await db.comTransacao(async (exec) => {
        const marcado = await exec(
            `UPDATE pedidos_ingresso SET status = 'pago', mp_payment_id = ?, pagamento_recusado_em = NULL
             WHERE id = ? AND status = 'pendente'`,
            [mpPaymentId, pedido.id]
        );
        if (!marcado.affectedRows) return false;

        for (const item of itens) {
            await pedidoRepository.confirmarVendaLote(exec, item.lote_id, item.quantidade);
        }
        for (const item of itens) {
            ingressosEmitidos.push(...await emitirIngressosDoPedidoTx(exec, pedido.id, item.lote_id, item.quantidade));
        }
        return true;
    });

    if (pagamentoConfirmadoAgora) {
        return { jaPago: false, ingressos: ingressosEmitidos };
    }

    const atual = await pedidoRepository.buscarPorId(pedido.id);

    if (atual?.status === 'pago') return { jaPago: true };

    if (atual?.status !== 'expirado') {
        logger.error('Pagamento aprovado para pedido que não pode mais ser confirmado', {
            pedido_id: pedido.id,
            codigo_publico: pedido.codigo_publico,
            status_atual: atual?.status,
            payment_id: mpPaymentId
        });
        return { jaPago: true, precisaReconciliacao: true };
    }

    let ingressosResgatados = [];
    const resgatado = await db.comTransacao(async (exec) => {
        const marcado = await exec(
            `UPDATE pedidos_ingresso SET status = 'pago', mp_payment_id = ?
             WHERE id = ? AND status = 'expirado'`,
            [mpPaymentId, pedido.id]
        );
        if (!marcado.affectedRows) return false;

        for (const item of itens) {
            await pedidoRepository.reservarLote(exec, item.lote_id, item.quantidade);
            await pedidoRepository.confirmarVendaLote(exec, item.lote_id, item.quantidade);
        }
        if (pedido.cupom_id) {
            try {
                await cupomRepository.reservarUso(exec, pedido.cupom_id);
            } catch (err) {
                if (err.message !== 'CUPOM_ESGOTADO') throw err;
            }
        }
        for (const item of itens) {
            ingressosResgatados.push(...await emitirIngressosDoPedidoTx(exec, pedido.id, item.lote_id, item.quantidade));
        }
        return true;
    }).catch((err) => {
        if (err.message === 'ESTOQUE_INSUFICIENTE') return false;
        throw err;
    });

    if (!resgatado) {
        logger.error('Pagamento aprovado após expiração e sem estoque para resgatar — reconciliação manual necessária', {
            pedido_id: pedido.id,
            codigo_publico: pedido.codigo_publico,
            payment_id: mpPaymentId
        });
        return { jaPago: true, precisaReconciliacao: true };
    }

    logger.warn('Pagamento aprovado após expiração — pedido resgatado com sucesso', {
        pedido_id: pedido.id,
        codigo_publico: pedido.codigo_publico,
        payment_id: mpPaymentId
    });

    return { jaPago: false, ingressos: ingressosResgatados, resgatado: true };
};

exports.criarPedido = async (dados) => {
    const { lote_id, quantidade, nome, email, cupom } = dados;
    const qtd = Number(quantidade);

    if (!Number.isInteger(qtd) || qtd <= 0 || qtd > MAX_POR_PEDIDO) {
        throw new AppError(400, `Quantidade entre 1 e ${MAX_POR_PEDIDO}`);
    }

    let evento = null;
    if (dados.evento_id) {
        evento = await ingressoRepository.buscarConfigEvento(dados.evento_id);
    } else if (dados.slug) {
        evento = await ingressoRepository.buscarEventoPorSlug(dados.slug);
    }

    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!evento.venda_publicada) throw new AppError(400, 'Venda não publicada');

    const lote = await ingressoRepository.buscarLotePorId(lote_id, evento.id);
    if (!lote || !lote.ativo) throw new AppError(400, 'Lote indisponível');

    const lotes = await ingressoRepository.buscarLotes(evento.id);
    const vigente = obterLoteVigente(lotes.map((l) => ({ ...l, restam: restamDoLote(l) })));
    if (!vigente || Number(vigente.id) !== Number(lote_id)) {
        throw new AppError(400, 'Este lote não está à venda agora. Atualize a página e escolha o lote vigente.');
    }

    const restam = restamDoLote(lote);
    if (restam < qtd) throw new AppError(400, 'Estoque insuficiente');

    const jaComprou = await pedidoRepository.contarIngressosPorEmail(evento.id, email);
    if (jaComprou + qtd > MAX_POR_EMAIL) {
        throw new AppError(400, `Limite de ${MAX_POR_EMAIL} ingressos por e-mail neste evento`);
    }

    const { desconto, cupom_id, taxa, total } = await calcularPrecoPedido(evento, lote, qtd, cupom);

    const codigoPublico = crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + RESERVA_MIN * 60 * 1000);
    const expiresSql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

    let pedidoId;
    try {
        pedidoId = await db.comTransacao(async (exec) => {
            await pedidoRepository.reservarLote(exec, lote.id, qtd);

            const jaComprouNaTransacao = await pedidoRepository.contarIngressosPorEmailTx(exec, evento.id, email);
            if (jaComprouNaTransacao + qtd > MAX_POR_EMAIL) {
                throw new AppError(400, `Limite de ${MAX_POR_EMAIL} ingressos por e-mail neste evento`);
            }

            if (cupom_id) await cupomRepository.reservarUso(exec, cupom_id);
            const result = await exec(
                `INSERT INTO pedidos_ingresso
                 (evento_id, codigo_publico, nome, email, status, canal, total, taxa_estimada, expires_at, cupom_id, desconto_aplicado)
                 VALUES (?, ?, ?, ?, 'pendente', 'site', ?, ?, ?, ?, ?)`,
                [
                    evento.id,
                    codigoPublico,
                    nome,
                    email,
                    total,
                    taxa,
                    expiresSql,
                    cupom_id,
                    desconto
                ]
            );
            const id = result.insertId;
            await exec(
                'INSERT INTO itens_pedido (pedido_id, lote_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
                [id, lote.id, qtd, lote.preco]
            );
            return id;
        });
    } catch (err) {
        if (err.message === 'ESTOQUE_INSUFICIENTE') {
            throw new AppError(400, 'Estoque insuficiente');
        }
        if (err.message === 'CUPOM_ESGOTADO') {
            throw new AppError(400, 'Cupom esgotado');
        }
        throw err;
    }

    const lojaUrl = process.env.LOJA_INGRESSOS_URL || 'https://ingressosbeco.raulnikroyce.dev';
    const apiUrl = process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

    const mp = await mercadopagoService.criarPreferencia({
        titulo: `${evento.nome} · ${lote.nome}`,
        quantidade: qtd,
        total,
        codigoPedido: codigoPublico,
        email,
        lojaUrl,
        apiUrl
    });

    await pedidoRepository.salvarPreferenciaCriada(pedidoId, {
        preferenceId: mp.preference_id,
        initPoint: mp.init_point
    });

    return {
        codigo: codigoPublico,
        init_point: mp.init_point,
        expires_at: expiresSql,
        total
    };
};

exports.previsualizarPedido = async (dados) => {
    const { lote_id, quantidade, cupom } = dados;
    const qtd = Number(quantidade);

    if (!Number.isInteger(qtd) || qtd <= 0 || qtd > MAX_POR_PEDIDO) {
        throw new AppError(400, `Quantidade entre 1 e ${MAX_POR_PEDIDO}`);
    }

    let evento = null;
    if (dados.evento_id) {
        evento = await ingressoRepository.buscarConfigEvento(dados.evento_id);
    } else if (dados.slug) {
        evento = await ingressoRepository.buscarEventoPorSlug(dados.slug);
    }

    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!evento.venda_publicada) throw new AppError(400, 'Venda não publicada');

    const lote = await ingressoRepository.buscarLotePorId(lote_id, evento.id);
    if (!lote || !lote.ativo) throw new AppError(400, 'Lote indisponível');

    const { subtotal, desconto, repassa, taxa, total, cupom_id } =
        await calcularPrecoPedido(evento, lote, qtd, cupom);

    return {
        subtotal,
        desconto,
        cupom_aplicado: Boolean(cupom_id),
        repassa_taxa_comprador: repassa,
        taxa,
        total
    };
};

exports.obterPedidoPublico = async (codigo) => {
    const pedido = await pedidoRepository.buscarPorCodigo(codigo);
    if (!pedido) throw new AppError(404, 'Pedido não encontrado');

    const [evento, itens] = await Promise.all([
        ingressoRepository.buscarConfigEvento(pedido.evento_id),
        pedidoRepository.buscarItensPedido(pedido.id)
    ]);

    let ingressos = [];
    if (pedido.status === 'pago' && !pedido.cancelamento_pendente) {
        ingressos = await ingressoRepository.buscarIngressosPorPedido(pedido.id);
    }

    return { pedido, evento, itens, ingressos };
};

exports.processarWebhook = async (body, idValidado) => {
    const paymentId = idValidado === undefined ? mercadopagoService.extrairPaymentId(body) : idValidado;
    if (!paymentId) return { ignorado: true };

    const pagamento = await mercadopagoService.obterPagamento(paymentId);
    const codigo = pagamento.external_reference;
    if (!codigo) return { ignorado: true };

    const pedido = await pedidoRepository.buscarPorCodigo(codigo);
    if (!pedido) return { ignorado: true };

    const pagamentoCorresponde = String(pagamento.external_reference) === String(pedido.codigo_publico)
        && pagamento.currency_id === 'BRL'
        && emCentavos(pagamento.transaction_amount) === emCentavos(pedido.total);

    if (!pagamentoCorresponde) {
        logger.warn('Pagamento rejeitado por divergência', {
            pedido_id: pedido.id,
            payment_id: paymentId
        });
        throw new AppError(400, 'Pagamento não corresponde ao pedido');
    }


    if (pagamento.status === 'approved') {
        return exports.confirmarPagamentoPedido(pedido, paymentId);
    }

    if (['rejected', 'cancelled'].includes(pagamento.status) && pedido.status === 'pendente') {
        await pedidoRepository.marcarPagamentoRecusado(pedido.id);
    }

    return { status: pagamento.status };
};

exports.expirarReservas = async () => {
    const expirados = await pedidoRepository.listarPedidosExpirados();
    let count = 0;

    for (const pedido of expirados) {
        const itens = await pedidoRepository.buscarItensPedido(pedido.id);
        await db.comTransacao(async (exec) => {
            const ok = await exec(
                `UPDATE pedidos_ingresso SET status = 'expirado'
                 WHERE id = ? AND status = 'pendente'`,
                [pedido.id]
            );
            if (!ok.affectedRows) return;
            for (const item of itens) {
                await pedidoRepository.liberarReservaLote(exec, item.lote_id, item.quantidade);
            }
            if (pedido.cupom_id) await cupomRepository.liberarUso(exec, pedido.cupom_id);
            count += 1;
        });
    }

    return { expirados: count };
};

exports.obterIngressoPublico = async (codigo) => {
    const ingresso = await pedidoRepository.buscarIngressoPorCodigo(codigo);
    if (!ingresso) throw new AppError(404, 'Ingresso não encontrado');
    if (ingresso.pedido_status !== 'pago') throw new AppError(400, 'Pedido não pago');
    if (ingresso.cancelamento_pendente) throw new AppError(409, 'Cancelamento em processamento. Ingresso suspenso.');
    return ingresso;
};

exports.checkin = async (codigo, usuario) => {
    if (usuario.perfil !== 'admin') throw new AppError(403, 'Só admin faz check-in');

    const ingresso = await pedidoRepository.buscarIngressoPorCodigo(codigo);
    if (!ingresso) throw new AppError(404, 'Ingresso inválido');
    if (ingresso.pedido_status !== 'pago') throw new AppError(400, 'Pedido não pago');
    if (ingresso.cancelamento_pendente) throw new AppError(409, 'Cancelamento em processamento. Ingresso suspenso.');

    if (ingresso.status === 'usado') {
        return { valido: false, motivo: 'ja_usado', ingresso };
    }
    if (ingresso.status === 'cancelado') {
        return { valido: false, motivo: 'cancelado', ingresso };
    }

    const marcado = await pedidoRepository.marcarIngressoUsado(codigo, usuario.id);
    if (!marcado) {
        const ingressoAtual = await pedidoRepository.buscarIngressoPorCodigo(codigo);
        return { valido: false, motivo: 'ja_usado', ingresso: ingressoAtual };
    }
    return { valido: true, ingresso: { ...ingresso, status: 'usado' } };
};

exports.listarCompradores = async (eventoId, usuario, filtros) => {
    const evento = await eventoRepository.buscarPorId(eventoId);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) {
        throw new AppError(403, 'Sem permissão');
    }
    return pedidoRepository.listarCompradores(eventoId, filtros);
};

exports.compradoresCsv = async (eventoId, usuario, filtros) => {
    const lista = await exports.listarCompradores(eventoId, usuario, filtros);
    const linhas = ['nome,email,status,canal,lote,quantidade,total,criado_em'];
    lista.forEach((row) => {
        linhas.push([
            row.nome,
            row.email,
            row.status,
            row.canal,
            row.lote_nome,
            row.quantidade,
            row.total,
            row.criado_em
        ].map(celulaCsv).join(','));
    });
    return linhas.join('\n');
};

exports.listarCupons = async (eventoId, usuario) => {
    const evento = await eventoRepository.buscarPorId(eventoId);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) throw new AppError(403, 'Sem permissão');
    return cupomRepository.listarPorEvento(eventoId);
};

exports.criarCupom = async (eventoId, usuario, dados) => {
    const evento = await eventoRepository.buscarPorId(eventoId);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) throw new AppError(403, 'Sem permissão');
    return cupomRepository.criar({ ...dados, evento_id: eventoId });
};

exports.listaPortaHtml = async (eventoId, usuario) => {
    const evento = await eventoRepository.buscarPorId(eventoId);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) throw new AppError(403, 'Sem permissão');

    const compradores = await pedidoRepository.listarCompradores(eventoId, { status: 'pago' });
    const rows = compradores.map((c) =>
        `<tr><td>${escaparHtml(c.nome)}</td><td>${escaparHtml(c.email)}</td><td>${escaparHtml(c.lote_nome)}</td><td>${escaparHtml(c.quantidade)}</td></tr>`
    ).join('');

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lista porta · ${escaparHtml(evento.nome)}</title>
<style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style>
</head><body><h1>${escaparHtml(evento.nome)}</h1><p>${escaparHtml(evento.data)} · ${escaparHtml(evento.local)}</p>
<table><thead><tr><th>Nome</th><th>E-mail</th><th>Lote</th><th>Qtd</th></tr></thead><tbody>${rows}</tbody></table>
<script>window.print()</script></body></html>`;
};

exports._seguranca = { escaparHtml, celulaCsv, emCentavos };

exports.inscreverListaEspera = async (eventoId, email) => {
    const evento = await ingressoRepository.buscarConfigEvento(eventoId);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    return listaEsperaRepository.inscrever(eventoId, email);
};

exports.recuperarIngresso = async ({ email, codigo_pedido }) => {
    const pedido = await pedidoRepository.buscarPorCodigo(codigo_pedido);
    if (!pedido) throw new AppError(404, 'Pedido não encontrado');
    if (pedido.email.toLowerCase() !== email.toLowerCase()) {
        throw new AppError(403, 'E-mail não confere com o pedido');
    }
    if (pedido.status !== 'pago') throw new AppError(400, 'Pedido ainda não pago');
    if (pedido.cancelamento_pendente) throw new AppError(409, 'Cancelamento em processamento. Ingressos suspensos.');

    const ingressos = await ingressoRepository.buscarIngressosPorPedido(pedido.id);
    return { pedido: { codigo: pedido.codigo_publico, nome: pedido.nome }, ingressos };
};

exports.obterFinanceiroDashboard = async (usuario) => {
    if (usuario.perfil !== 'admin') throw new AppError(403, 'Só admin');

    const eventos = await eventoRepository.buscarTodos({});
    let receitaTotal = 0;
    let custoTotal = 0;

    for (const evento of eventos) {
        const [receita, custoCaches, custoProducao] = await Promise.all([
            ingressoRepository.receitaIngressos(evento.id),
            ingressoRepository.obterCustoCaches(evento.id),
            ingressoRepository.somaCustosProducao(evento.id)
        ]);
        receitaTotal += receita;
        custoTotal += custoCaches + custoProducao;
    }

    return {
        receita_ingressos: arredondar(receitaTotal),
        custo_total: arredondar(custoTotal),
        resultado: arredondar(receitaTotal - custoTotal)
    };
};

async function concluirCancelamento(pedido, statusAnterior, itens, tarefa) {
    return db.comTransacao(async (exec) => {
        if (tarefa) {
            await exec('SELECT id FROM pedidos_ingresso WHERE id = ? FOR UPDATE', [pedido.id]);
            const lease = await exec("SELECT lease_token FROM cancelamentos_ingresso WHERE pedido_id = ? AND status = 'pendente' FOR UPDATE", [pedido.id]);
            if (lease[0]?.lease_token !== tarefa.lease_token) throw new AppError(409, 'Outra execução assumiu o cancelamento.');
        }
        const cancelado = await pedidoRepository.marcarCancelado(exec, pedido.id, statusAnterior);
        if (!cancelado) throw new AppError(409, 'O pedido mudou. Atualize antes de cancelar.');
        await pedidoRepository.cancelarIngressosDoPedido(exec, pedido.id);
        for (const item of itens) {
            if (statusAnterior === 'pago') await pedidoRepository.devolverVendaLote(exec, item.lote_id, item.quantidade);
            else await pedidoRepository.liberarReservaLote(exec, item.lote_id, item.quantidade);
        }
        if (pedido.cupom_id) await cupomRepository.liberarUso(exec, pedido.cupom_id);
        if (tarefa) await cancelamentoRepository.concluir(exec, tarefa);
    });
}

async function processarCancelamentoPago(pedidoId) {
    const tarefa = await cancelamentoRepository.assumir(pedidoId);
    try {
        const pedido = await pedidoRepository.buscarParaCancelamento(pedidoId);
        if (!pedido || pedido.status !== 'pago' || String(pedido.mp_payment_id) !== tarefa.payment_id) {
            throw new AppError(409, 'Pedido não corresponde ao cancelamento pendente.');
        }
        const itens = await pedidoRepository.buscarItensPedido(pedido.id);
        try {
            await mercadopagoService.estornarPagamento(tarefa.payment_id, tarefa.chave);
        } catch (err) {
            logger.error('Falha ao estornar pagamento', { pedido_id: pedidoId, detalhe: err.message });
            throw new AppError(502, 'Não foi possível estornar o pagamento agora. Cancelamento aguardando nova tentativa; ingressos suspensos.');
        }
        await concluirCancelamento(pedido, 'pago', itens, tarefa);
    } catch (err) {
        await cancelamentoRepository.liberar(tarefa, err).catch((falha) => logger.error('Falha ao liberar retomada do cancelamento', { pedido_id: pedidoId, detalhe: falha.message }));
        throw err;
    }
}

exports.cancelarPedido = async (eventoId, codigo, usuario) => {
    if (usuario.perfil !== 'admin') throw new AppError(403, 'Só admin pode cancelar pedidos');
    const evento = await eventoRepository.buscarPorId(eventoId);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) throw new AppError(403, 'Sem permissão');
    const pedido = await pedidoRepository.buscarPorCodigoEEvento(codigo, eventoId);
    if (!pedido) throw new AppError(404, 'Pedido não encontrado');
    if (!['pendente', 'pago'].includes(pedido.status)) throw new AppError(400, 'Status do pedido não permite cancelamento');
    const itens = await pedidoRepository.buscarItensPedido(pedido.id);
    if (pedido.status === 'pago') {
        if (!pedido.mp_payment_id) throw new AppError(409, 'Pedido pago sem identificador de pagamento; estorno manual necessário');
        await cancelamentoRepository.preparar(pedido);
        await processarCancelamentoPago(pedido.id);
    } else {
        await concluirCancelamento(pedido, 'pendente', itens);
    }
    return { codigo_publico: pedido.codigo_publico, status: 'cancelado', status_anterior: pedido.status };
};

exports.retomarCancelamentos = async () => {
    const tarefas = await cancelamentoRepository.pendentes();
    let concluidos = 0;
    for (const tarefa of tarefas) {
        try {
            await processarCancelamentoPago(tarefa.pedido_id);
            concluidos += 1;
        } catch (err) {
            logger.error('Cancelamento aguardando retomada', { pedido_id: tarefa.pedido_id, detalhe: err.message });
        }
    }
    return { concluidos };
};
