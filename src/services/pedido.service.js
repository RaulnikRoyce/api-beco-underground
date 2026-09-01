const crypto = require('crypto');
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

const MAX_POR_PEDIDO = Number(process.env.INGRESSOS_MAX_POR_PEDIDO) || 4;
const MAX_POR_EMAIL = Number(process.env.INGRESSOS_MAX_POR_EMAIL) || 4;
const RESERVA_MIN = Number(process.env.INGRESSOS_RESERVA_MIN) || 15;

const arredondar = (v) => Math.round(Number(v) * 100) / 100;

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

const emitirIngressosDoPedido = async (pedidoId, loteId, quantidade) => {
    const ingressos = [];
    for (let i = 0; i < quantidade; i += 1) {
        const codigo = crypto.randomBytes(12).toString('hex');
        const emitido = await ingressoRepository.criarIngressoEmitido({
            codigo,
            pedido_id: pedidoId,
            lote_id: loteId
        });
        ingressos.push(emitido);
    }
    return ingressos;
};

exports.confirmarPagamentoPedido = async (pedido, mpPaymentId) => {
    if (pedido.status === 'pago') return { jaPago: true };

    const itens = await pedidoRepository.buscarItensPedido(pedido.id);
    if (!itens.length) throw new AppError(500, 'Pedido sem itens');

    await db.comTransacao(async (exec) => {
        const marcado = await exec(
            `UPDATE pedidos_ingresso SET status = 'pago', mp_payment_id = ?
             WHERE id = ? AND status = 'pendente'`,
            [mpPaymentId, pedido.id]
        );
        if (!marcado.affectedRows) return;

        for (const item of itens) {
            await pedidoRepository.confirmarVendaLote(exec, item.lote_id, item.quantidade);
        }
    });

    const pedidoAtual = await pedidoRepository.buscarPorId(pedido.id);
    if (pedidoAtual?.status !== 'pago') return { jaPago: true };

    if (pedido.cupom_id) await cupomRepository.incrementarUso(pedido.cupom_id);

    const ingressos = [];
    for (const item of itens) {
        const emitidos = await emitirIngressosDoPedido(pedido.id, item.lote_id, item.quantidade);
        ingressos.push(...emitidos);
    }

    return { jaPago: false, ingressos };
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

    const subtotal = arredondar(Number(lote.preco) * qtd);
    let repassa = Number(evento.repassa_taxa_comprador) === 1;
    const cupomAplicado = await aplicarCupom(evento.id, cupom, subtotal);
    let total = cupomAplicado.total;
    const taxa = calcularTaxa(total, evento);
    if (repassa) total = arredondar(total + taxa);

    const codigoPublico = crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + RESERVA_MIN * 60 * 1000);
    const expiresSql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

    let pedidoId;
    try {
        pedidoId = await db.comTransacao(async (exec) => {
            await pedidoRepository.reservarLote(exec, lote.id, qtd);
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
                    cupomAplicado.cupom_id,
                    cupomAplicado.desconto
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
        throw err;
    }

    const lojaUrl = process.env.LOJA_INGRESSOS_URL || 'https://ingressosbeco.raulnikroyce.dev';
    const apiUrl = process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

    const mp = await mercadopagoService.criarPreferencia({
        titulo: `${evento.nome} · ${lote.nome}`,
        quantidade: qtd,
        precoUnitario: arredondar(total / qtd),
        codigoPedido: codigoPublico,
        email,
        lojaUrl,
        apiUrl
    });

    await pedidoRepository.atualizarMpPaymentId(pedidoId, mp.preference_id);

    return {
        codigo: codigoPublico,
        init_point: mp.init_point,
        expires_at: expiresSql,
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
    if (pedido.status === 'pago') {
        ingressos = await ingressoRepository.buscarIngressosPorPedido(pedido.id);
    }

    return { pedido, evento, itens, ingressos };
};

exports.processarWebhook = async (body) => {
    const paymentId = mercadopagoService.extrairPaymentId(body);
    if (!paymentId) return { ignorado: true };

    const pagamento = await mercadopagoService.obterPagamento(paymentId);
    const codigo = pagamento.external_reference;
    if (!codigo) return { ignorado: true };

    const pedido = await pedidoRepository.buscarPorCodigo(codigo);
    if (!pedido) return { ignorado: true };

    if (pedido.mp_payment_id === paymentId && pedido.status === 'pago') {
        return { jaProcessado: true };
    }

    if (pagamento.status === 'approved') {
        return exports.confirmarPagamentoPedido(pedido, paymentId);
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
            count += 1;
        });
    }

    return { expirados: count };
};

exports.obterIngressoPublico = async (codigo) => {
    const ingresso = await pedidoRepository.buscarIngressoPorCodigo(codigo);
    if (!ingresso) throw new AppError(404, 'Ingresso não encontrado');
    if (ingresso.pedido_status !== 'pago') throw new AppError(400, 'Pedido não pago');
    return ingresso;
};

exports.checkin = async (codigo, usuario) => {
    if (usuario.perfil !== 'admin') throw new AppError(403, 'Só admin faz check-in');

    const ingresso = await pedidoRepository.buscarIngressoPorCodigo(codigo);
    if (!ingresso) throw new AppError(404, 'Ingresso inválido');
    if (ingresso.pedido_status !== 'pago') throw new AppError(400, 'Pedido não pago');

    if (ingresso.status === 'usado') {
        return { valido: false, motivo: 'ja_usado', ingresso };
    }
    if (ingresso.status === 'cancelado') {
        return { valido: false, motivo: 'cancelado', ingresso };
    }

    await pedidoRepository.marcarIngressoUsado(codigo, usuario.id);
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
            `"${String(row.nome).replace(/"/g, '""')}"`,
            row.email,
            row.status,
            row.canal,
            `"${String(row.lote_nome).replace(/"/g, '""')}"`,
            row.quantidade,
            row.total,
            row.criado_em
        ].join(','));
    });
    return linhas.join('\n');
};

exports.listaPortaHtml = async (eventoId, usuario) => {
    const evento = await eventoRepository.buscarPorId(eventoId);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) throw new AppError(403, 'Sem permissão');

    const compradores = await pedidoRepository.listarCompradores(eventoId, { status: 'pago' });
    const rows = compradores.map((c) =>
        `<tr><td>${c.nome}</td><td>${c.email}</td><td>${c.lote_nome}</td><td>${c.quantidade}</td></tr>`
    ).join('');

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Lista porta · ${evento.nome}</title>
<style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:left}</style>
</head><body><h1>${evento.nome}</h1><p>${evento.data} · ${evento.local}</p>
<table><thead><tr><th>Nome</th><th>E-mail</th><th>Lote</th><th>Qtd</th></tr></thead><tbody>${rows}</tbody></table>
<script>window.print()</script></body></html>`;
};

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

exports.cancelarPedido = async (eventoId, codigo, usuario) => {
    if (usuario.perfil !== 'admin') throw new AppError(403, 'Só admin pode cancelar pedidos');

    const evento = await eventoRepository.buscarPorId(eventoId);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) throw new AppError(403, 'Sem permissão');

    const pedido = await pedidoRepository.buscarPorCodigoEEvento(codigo, eventoId);
    if (!pedido) throw new AppError(404, 'Pedido não encontrado');
    if (pedido.status === 'cancelado') throw new AppError(400, 'Pedido já está cancelado');
    if (pedido.status === 'expirado') throw new AppError(400, 'Pedido expirado não precisa cancelar');
    if (!['pendente', 'pago'].includes(pedido.status)) {
        throw new AppError(400, 'Status do pedido não permite cancelamento');
    }

    const itens = await pedidoRepository.buscarItensPedido(pedido.id);
    const statusAnterior = pedido.status;

    const ok = await pedidoRepository.marcarCancelado(pedido.id);
    if (!ok) throw new AppError(409, 'Não foi possível cancelar o pedido');

    await pedidoRepository.cancelarIngressosDoPedido(pedido.id);

    for (const item of itens) {
        if (statusAnterior === 'pago') {
            await pedidoRepository.devolverVendaLote(item.lote_id, item.quantidade);
        } else if (statusAnterior === 'pendente') {
            await new Promise((resolve, reject) => {
                db.query(
                    `UPDATE lotes_ingresso
                     SET quantidade_reservada = GREATEST(0, quantidade_reservada - ?)
                     WHERE id = ?`,
                    [item.quantidade, item.lote_id],
                    (err) => (err ? reject(err) : resolve())
                );
            });
        }
    }

    return {
        codigo_publico: pedido.codigo_publico,
        status: 'cancelado',
        status_anterior: statusAnterior
    };
};
