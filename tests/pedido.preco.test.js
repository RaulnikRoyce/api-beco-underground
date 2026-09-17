const test = require('node:test');
const assert = require('node:assert/strict');

const pedidoService = require('../src/services/pedido.service');
const ingressoRepository = require('../src/repositories/ingresso.repository');
const cupomRepository = require('../src/repositories/cupom.repository');
const mercadopagoService = require('../src/services/mercadopago.service');
const pedidoRepository = require('../src/repositories/pedido.repository');
const db = require('../src/database/db');

function mockar(objeto, metodo, implementacao) {
    const original = objeto[metodo];
    objeto[metodo] = implementacao;
    return () => { objeto[metodo] = original; };
}

test('previsualizarPedido soma subtotal e taxa repassada com a mesma fórmula da criação do pedido', async () => {
    const restaurar = [
        mockar(ingressoRepository, 'buscarConfigEvento', async () => ({
            id: 1,
            venda_publicada: 1,
            repassa_taxa_comprador: 1,
            taxa_mp_percentual: 4.99
        })),
        mockar(ingressoRepository, 'buscarLotePorId', async () => ({
            id: 10,
            evento_id: 1,
            preco: 50,
            ativo: 1,
            quantidade_total: 100,
            quantidade_vendida: 0,
            quantidade_reservada: 0
        }))
    ];

    try {
        const resultado = await pedidoService.previsualizarPedido({
            evento_id: 1,
            lote_id: 10,
            quantidade: 3
        });

        assert.equal(resultado.subtotal, 150);
        assert.equal(resultado.taxa, 7.49);
        assert.equal(resultado.total, 157.49);
        assert.equal(resultado.cupom_aplicado, false);
        assert.equal(resultado.repassa_taxa_comprador, true);
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('previsualizarPedido não repassa taxa quando o evento não pede isso', async () => {
    const restaurar = [
        mockar(ingressoRepository, 'buscarConfigEvento', async () => ({
            id: 1,
            venda_publicada: 1,
            repassa_taxa_comprador: 0,
            taxa_mp_percentual: 4.99
        })),
        mockar(ingressoRepository, 'buscarLotePorId', async () => ({
            id: 10,
            evento_id: 1,
            preco: 50,
            ativo: 1,
            quantidade_total: 100,
            quantidade_vendida: 0,
            quantidade_reservada: 0
        }))
    ];

    try {
        const resultado = await pedidoService.previsualizarPedido({
            evento_id: 1,
            lote_id: 10,
            quantidade: 3
        });

        assert.equal(resultado.subtotal, 150);
        assert.equal(resultado.total, 150);
        assert.equal(resultado.repassa_taxa_comprador, false);
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('previsualizarPedido aplica desconto de cupom antes da taxa', async () => {
    const restaurar = [
        mockar(ingressoRepository, 'buscarConfigEvento', async () => ({
            id: 1,
            venda_publicada: 1,
            repassa_taxa_comprador: 0,
            taxa_mp_percentual: 4.99
        })),
        mockar(ingressoRepository, 'buscarLotePorId', async () => ({
            id: 10,
            evento_id: 1,
            preco: 100,
            ativo: 1,
            quantidade_total: 100,
            quantidade_vendida: 0,
            quantidade_reservada: 0
        })),
        mockar(cupomRepository, 'buscarPorCodigo', async () => ({
            id: 5,
            desconto_percentual: 20,
            uso_max: null,
            uso_atual: 0
        }))
    ];

    try {
        const resultado = await pedidoService.previsualizarPedido({
            evento_id: 1,
            lote_id: 10,
            quantidade: 1,
            cupom: 'promo'
        });

        assert.equal(resultado.subtotal, 100);
        assert.equal(resultado.desconto, 20);
        assert.equal(resultado.total, 80);
        assert.equal(resultado.cupom_aplicado, true);
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('previsualizarPedido recusa cupom esgotado, sem estourar', async () => {
    const restaurar = [
        mockar(ingressoRepository, 'buscarConfigEvento', async () => ({
            id: 1,
            venda_publicada: 1,
            repassa_taxa_comprador: 0,
            taxa_mp_percentual: 4.99
        })),
        mockar(ingressoRepository, 'buscarLotePorId', async () => ({
            id: 10,
            evento_id: 1,
            preco: 100,
            ativo: 1,
            quantidade_total: 100,
            quantidade_vendida: 0,
            quantidade_reservada: 0
        })),
        mockar(cupomRepository, 'buscarPorCodigo', async () => ({
            id: 5,
            desconto_percentual: 20,
            uso_max: 1,
            uso_atual: 1
        }))
    ];

    try {
        await assert.rejects(
            pedidoService.previsualizarPedido({ evento_id: 1, lote_id: 10, quantidade: 1, cupom: 'promo' }),
            /Cupom esgotado/
        );
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('previsualizarPedido recusa evento não publicado e lote inativo', async () => {
    const restaurarEvento = mockar(ingressoRepository, 'buscarConfigEvento', async () => ({
        id: 1,
        venda_publicada: 0,
        repassa_taxa_comprador: 0,
        taxa_mp_percentual: 4.99
    }));

    try {
        await assert.rejects(
            pedidoService.previsualizarPedido({ evento_id: 1, lote_id: 10, quantidade: 1 }),
            /Venda não publicada/
        );
    } finally {
        restaurarEvento();
    }

    const restaurar = [
        mockar(ingressoRepository, 'buscarConfigEvento', async () => ({
            id: 1,
            venda_publicada: 1,
            repassa_taxa_comprador: 0,
            taxa_mp_percentual: 4.99
        })),
        mockar(ingressoRepository, 'buscarLotePorId', async () => ({ id: 10, evento_id: 1, preco: 100, ativo: 0 }))
    ];

    try {
        await assert.rejects(
            pedidoService.previsualizarPedido({ evento_id: 1, lote_id: 10, quantidade: 1 }),
            /Lote indisponível/
        );
    } finally {
        restaurar.forEach((fn) => fn());
    }
});

test('cupomRepository.reservarUso trava exatamente no uso_max, mesmo chamado em sequência', async () => {
    let usoAtual = 0;
    const usoMax = 1;
    const execFalso = async () => {
        if (usoAtual < usoMax) {
            usoAtual += 1;
            return { affectedRows: 1 };
        }
        return { affectedRows: 0 };
    };

    await cupomRepository.reservarUso(execFalso, 1);
    assert.equal(usoAtual, 1);
    await assert.rejects(cupomRepository.reservarUso(execFalso, 1), /CUPOM_ESGOTADO/);
    assert.equal(usoAtual, 1, 'segunda reserva não pode incrementar além do uso_max');
});

test('criarPedido recusa o segundo pedido quando o cupom só tem uma vaga, na mesma transação do estoque', async () => {
    let usoAtual = 0;
    const usoMax = 1;
    let proximoId = 1;

    const originais = {
        buscarConfigEvento: ingressoRepository.buscarConfigEvento,
        buscarLotePorId: ingressoRepository.buscarLotePorId,
        buscarLotes: ingressoRepository.buscarLotes,
        buscarPorCodigo: cupomRepository.buscarPorCodigo,
        contarIngressosPorEmail: pedidoRepository.contarIngressosPorEmail,
        salvarPreferenciaCriada: pedidoRepository.salvarPreferenciaCriada,
        comTransacao: db.comTransacao,
        criarPreferencia: mercadopagoService.criarPreferencia
    };

    const lote = {
        id: 10, evento_id: 1, nome: 'Pista', preco: 100, ordem: 1,
        quantidade_total: 100, quantidade_vendida: 0, quantidade_reservada: 0,
        inicio_venda: null, fim_venda: null, ativo: 1
    };

    ingressoRepository.buscarConfigEvento = async () => ({
        id: 1, nome: 'Show', venda_publicada: 1, repassa_taxa_comprador: 0, taxa_mp_percentual: 0
    });
    ingressoRepository.buscarLotePorId = async () => ({ ...lote });
    ingressoRepository.buscarLotes = async () => [{ ...lote }];
    cupomRepository.buscarPorCodigo = async () => ({ id: 1, desconto_percentual: 10, uso_max: usoMax, uso_atual: usoAtual });
    let preferenciaSalva = null;
    pedidoRepository.contarIngressosPorEmail = async () => 0;
    pedidoRepository.salvarPreferenciaCriada = async (pedidoId, dados) => { preferenciaSalva = { pedidoId, ...dados }; return true; };
    mercadopagoService.criarPreferencia = async () => ({ preference_id: 'pref', init_point: 'https://mp.test/pref' });

    db.comTransacao = async (trabalho) => trabalho(async (sql) => {
        if (sql.includes('UPDATE lotes_ingresso') && sql.includes('quantidade_reservada = quantidade_reservada')) {
            return { affectedRows: 1 };
        }
        if (sql.includes('UPDATE cupons SET uso_atual = uso_atual + 1')) {
            if (usoAtual < usoMax) {
                usoAtual += 1;
                return { affectedRows: 1 };
            }
            return { affectedRows: 0 };
        }
        if (sql.includes('INSERT INTO pedidos_ingresso')) {
            return { insertId: proximoId++ };
        }
        return { affectedRows: 1 };
    });

    try {
        const payload = { evento_id: 1, lote_id: 10, quantidade: 1, nome: 'Ana', email: 'ana@teste.com', cupom: 'promo' };

        const primeiro = await pedidoService.criarPedido(payload);
        assert.ok(primeiro.codigo);
        assert.equal(usoAtual, 1);
        assert.equal(preferenciaSalva.initPoint, 'https://mp.test/pref');
        assert.equal(preferenciaSalva.preferenceId, 'pref');

        await assert.rejects(
            pedidoService.criarPedido({ ...payload, nome: 'Bia', email: 'bia@teste.com' }),
            /Cupom esgotado/
        );
        assert.equal(usoAtual, 1, 'o segundo pedido não pode ter reservado o cupom');
    } finally {
        Object.assign(ingressoRepository, {
            buscarConfigEvento: originais.buscarConfigEvento,
            buscarLotePorId: originais.buscarLotePorId,
            buscarLotes: originais.buscarLotes
        });
        cupomRepository.buscarPorCodigo = originais.buscarPorCodigo;
        pedidoRepository.contarIngressosPorEmail = originais.contarIngressosPorEmail;
        pedidoRepository.salvarPreferenciaCriada = originais.salvarPreferenciaCriada;
        db.comTransacao = originais.comTransacao;
        mercadopagoService.criarPreferencia = originais.criarPreferencia;
    }
});

test('obterPedidoPublico devolve o link de pagamento salvo, pra retomar um pedido pendente', async () => {
    const originais = {
        buscarPorCodigo: pedidoRepository.buscarPorCodigo,
        buscarConfigEvento: ingressoRepository.buscarConfigEvento,
        buscarItensPedido: pedidoRepository.buscarItensPedido
    };

    pedidoRepository.buscarPorCodigo = async () => ({
        id: 1, status: 'pendente', codigo_publico: 'abc', mp_init_point: 'https://mp.test/retomar'
    });
    ingressoRepository.buscarConfigEvento = async () => ({ id: 1, nome: 'Show' });
    pedidoRepository.buscarItensPedido = async () => [];

    try {
        const resultado = await pedidoService.obterPedidoPublico('abc');
        assert.equal(resultado.pedido.mp_init_point, 'https://mp.test/retomar');
    } finally {
        pedidoRepository.buscarPorCodigo = originais.buscarPorCodigo;
        ingressoRepository.buscarConfigEvento = originais.buscarConfigEvento;
        pedidoRepository.buscarItensPedido = originais.buscarItensPedido;
    }
});

test('criarPedido recusa estourar o limite por e-mail mesmo se a checagem rápida (fora da transação) estiver desatualizada (achado B1)', async () => {
    let totalConfirmado = 0;
    let proximoId = 1;
    const MAX_POR_EMAIL_PADRAO = 4;

    const lote = {
        id: 10, evento_id: 1, nome: 'Pista', preco: 50, ordem: 1,
        quantidade_total: 100, quantidade_vendida: 0, quantidade_reservada: 0,
        inicio_venda: null, fim_venda: null, ativo: 1
    };

    const originais = {
        buscarConfigEvento: ingressoRepository.buscarConfigEvento,
        buscarLotePorId: ingressoRepository.buscarLotePorId,
        buscarLotes: ingressoRepository.buscarLotes,
        contarIngressosPorEmail: pedidoRepository.contarIngressosPorEmail,
        salvarPreferenciaCriada: pedidoRepository.salvarPreferenciaCriada,
        comTransacao: db.comTransacao,
        criarPreferencia: mercadopagoService.criarPreferencia
    };

    ingressoRepository.buscarConfigEvento = async () => ({
        id: 1, nome: 'Show', venda_publicada: 1, repassa_taxa_comprador: 0, taxa_mp_percentual: 0
    });
    ingressoRepository.buscarLotePorId = async () => ({ ...lote });
    ingressoRepository.buscarLotes = async () => [{ ...lote }];
    pedidoRepository.contarIngressosPorEmail = async () => 0;
    pedidoRepository.salvarPreferenciaCriada = async () => true;
    mercadopagoService.criarPreferencia = async () => ({ preference_id: 'pref', init_point: 'https://mp.test/pref' });

    db.comTransacao = async (trabalho) => trabalho(async (sql) => {
        if (sql.includes('UPDATE lotes_ingresso') && sql.includes('quantidade_reservada = quantidade_reservada')) {
            return { affectedRows: 1 };
        }
        if (sql.includes('FOR UPDATE')) {
            return [{ total: totalConfirmado }];
        }
        if (sql.includes('INSERT INTO pedidos_ingresso')) {
            return { insertId: proximoId++ };
        }
        return { affectedRows: 1 };
    });

    try {
        const payload = { evento_id: 1, lote_id: 10, quantidade: 3, nome: 'Ana', email: 'mesmo@teste.com' };

        const primeiro = await pedidoService.criarPedido(payload);
        assert.ok(primeiro.codigo);
        totalConfirmado += 3;

        await assert.rejects(
            pedidoService.criarPedido({ ...payload, nome: 'Bia', quantidade: 2 }),
            new RegExp(`Limite de ${MAX_POR_EMAIL_PADRAO} ingressos por e-mail`)
        );
    } finally {
        Object.assign(ingressoRepository, {
            buscarConfigEvento: originais.buscarConfigEvento,
            buscarLotePorId: originais.buscarLotePorId,
            buscarLotes: originais.buscarLotes
        });
        pedidoRepository.contarIngressosPorEmail = originais.contarIngressosPorEmail;
        pedidoRepository.salvarPreferenciaCriada = originais.salvarPreferenciaCriada;
        db.comTransacao = originais.comTransacao;
        mercadopagoService.criarPreferencia = originais.criarPreferencia;
    }
});
