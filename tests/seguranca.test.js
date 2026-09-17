const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const pedidoService = require('../src/services/pedido.service');
const mercadopagoService = require('../src/services/mercadopago.service');
const ingressoRepository = require('../src/repositories/ingresso.repository');
const eventoRepository = require('../src/repositories/evento.repository');
const db = require('../src/database/db');
const eventoService = require('../src/services/evento.service');
const bandaRepository = require('../src/repositories/banda.repository');
const bandaService = require('../src/services/banda.service');
const { gerarTokenPreview, validarTokenPreview } = require('../src/utils/preview.token');
const { registrarSchema, trocarPropriaSenhaSchema } = require('../src/schemas/auth.schema');

test('token de preview é curto, restrito ao evento e rejeita adulteração', () => {
    process.env.JWT_SECRET = 'segredo-de-teste-comprido-para-preview';
    const token = gerarTokenPreview(42);
    const payload = jwt.decode(token);

    assert.equal(payload.evento_id, 42);
    assert.equal(payload.escopo, 'preview_ingressos');
    assert.equal(payload.exp - payload.iat, 300);
    assert.equal(validarTokenPreview(token, 42), true);
    assert.equal(validarTokenPreview(token, 43), false);
    assert.equal(validarTokenPreview(`${token}x`, 42), false);
});

test('exportações neutralizam HTML e fórmulas de planilha', () => {
    const { escaparHtml, celulaCsv } = pedidoService._seguranca;
    assert.equal(escaparHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(celulaCsv('=HYPERLINK("https://example.test")'), '"\'=HYPERLINK(""https://example.test"")"');
    assert.equal(celulaCsv('nome\r\ninjetado'), '"nome injetado"');
});

test('validarAssinaturaWebhook aceita a assinatura correta e recusa qualquer adulteração', () => {
    const crypto = require('crypto');
    const secret = 'segredo-do-webhook';
    const dataId = '123456789';
    const xRequestId = 'req-abc';
    const ts = '1700000000';
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    const xSignature = `ts=${ts},v1=${v1}`;

    assert.equal(
        mercadopagoService.validarAssinaturaWebhook({ xSignature, xRequestId, dataId, secret }),
        true
    );
    assert.equal(
        mercadopagoService.validarAssinaturaWebhook({ xSignature, xRequestId, dataId: '999999999', secret }),
        false,
        'data.id diferente do assinado deve recusar'
    );
    assert.equal(
        mercadopagoService.validarAssinaturaWebhook({ xSignature, xRequestId: 'outro-id', dataId, secret }),
        false,
        'request-id diferente do assinado deve recusar'
    );
    assert.equal(
        mercadopagoService.validarAssinaturaWebhook({ xSignature, xRequestId, dataId, secret: 'segredo-errado' }),
        false,
        'secret errado deve recusar'
    );
    assert.equal(
        mercadopagoService.validarAssinaturaWebhook({ xSignature: '', xRequestId, dataId, secret }),
        false,
        'sem header de assinatura deve recusar'
    );
});

test('webhook aceita somente identificador numérico de pagamento', () => {
    assert.equal(mercadopagoService.extrairPaymentId({ data: { id: 12345 } }), '12345');
    assert.equal(mercadopagoService.extrairPaymentId({ data: { id: '../preferences' } }), null);
    assert.equal(mercadopagoService.extrairPaymentId({ data: { id: '1?x=2' } }), null);
});

test('preferência local omite auto_return porque o Mercado Pago recusa localhost', () => {
    const envAntes = process.env.NODE_ENV;
    try {
        process.env.NODE_ENV = 'development';
        const local = mercadopagoService.montarCorpoPreferencia({
            titulo: 'Show',
            quantidade: 1,
            total: 10,
            codigoPedido: 'abc123',
            email: 'teste@teste.com',
            lojaUrl: 'https://ingressosbeco.raulnikroyce.dev',
            apiUrl: 'https://api-beco-underground.onrender.com'
        });
        assert.equal(local.auto_return, undefined);
        assert.equal(local.back_urls, undefined);
        assert.equal(local.notification_url, undefined);
        assert.equal(local.external_reference, 'abc123');

        process.env.NODE_ENV = 'production';
        const prod = mercadopagoService.montarCorpoPreferencia({
            titulo: 'Show',
            quantidade: 1,
            total: 10,
            codigoPedido: 'abc123',
            email: 'teste@teste.com',
            lojaUrl: 'https://ingressosbeco.raulnikroyce.dev',
            apiUrl: 'https://api-beco-underground.onrender.com'
        });
        assert.equal(prod.auto_return, 'approved');
        assert.equal(prod.back_urls.success, 'https://ingressosbeco.raulnikroyce.dev/pedido/abc123');
        assert.equal(prod.notification_url, 'https://api-beco-underground.onrender.com/ingressos/webhook');
    } finally {
        process.env.NODE_ENV = envAntes;
    }
});

test('preferência do Mercado Pago cobra exatamente o total do pedido, nunca dividido pela quantidade', () => {
    const corpo = mercadopagoService.montarCorpoPreferencia({
        titulo: 'Show · Pista',
        quantidade: 3,
        total: 157.49,
        codigoPedido: 'abc123',
        email: 'teste@teste.com',
        lojaUrl: 'https://ingressosbeco.raulnikroyce.dev',
        apiUrl: 'https://api-beco-underground.onrender.com'
    });

    assert.equal(corpo.items.length, 1);
    assert.equal(corpo.items[0].quantity, 1);
    assert.equal(corpo.items[0].unit_price, 157.49);
    assert.equal(corpo.items[0].quantity * corpo.items[0].unit_price, 157.49);
    assert.match(corpo.items[0].title, /3x/);
});

test('webhook rejeita pagamento com valor ou moeda divergente do pedido', async () => {
    const pedidoRepository = require('../src/repositories/pedido.repository');
    const originais = {
        obterPagamento: mercadopagoService.obterPagamento,
        buscarPorCodigo: pedidoRepository.buscarPorCodigo
    };
    mercadopagoService.obterPagamento = async () => ({
        external_reference: 'abcdef0123456789',
        status: 'approved',
        currency_id: 'USD',
        transaction_amount: 1
    });
    pedidoRepository.buscarPorCodigo = async () => ({
        id: 5,
        codigo_publico: 'abcdef0123456789',
        status: 'pendente',
        total: 100
    });

    try {
        await assert.rejects(
            pedidoService.processarWebhook({ data: { id: '123' } }),
            /Pagamento não corresponde ao pedido/
        );
    } finally {
        mercadopagoService.obterPagamento = originais.obterPagamento;
        pedidoRepository.buscarPorCodigo = originais.buscarPorCodigo;
    }
});

test('webhook de pagamento recusado marca o pedido sem mudar o status nem emitir ingresso', async () => {
    const pedidoRepository = require('../src/repositories/pedido.repository');
    const originais = {
        obterPagamento: mercadopagoService.obterPagamento,
        buscarPorCodigo: pedidoRepository.buscarPorCodigo,
        marcarPagamentoRecusado: pedidoRepository.marcarPagamentoRecusado
    };

    let marcado = null;
    mercadopagoService.obterPagamento = async () => ({
        external_reference: 'abcdef0123456789',
        status: 'rejected',
        currency_id: 'BRL',
        transaction_amount: 100
    });
    pedidoRepository.buscarPorCodigo = async () => ({
        id: 5,
        codigo_publico: 'abcdef0123456789',
        status: 'pendente',
        total: 100
    });
    pedidoRepository.marcarPagamentoRecusado = async (pedidoId) => { marcado = pedidoId; return true; };

    try {
        const resultado = await pedidoService.processarWebhook({ data: { id: '123' } });
        assert.deepEqual(resultado, { status: 'rejected' });
        assert.equal(marcado, 5);
    } finally {
        mercadopagoService.obterPagamento = originais.obterPagamento;
        pedidoRepository.buscarPorCodigo = originais.buscarPorCodigo;
        pedidoRepository.marcarPagamentoRecusado = originais.marcarPagamentoRecusado;
    }
});

test('pedido pago sem nenhum ingresso é reparado numa nova entrega do webhook', async () => {
    const pedidoRepository = require('../src/repositories/pedido.repository');
    const originais = {
        buscarIngressosPorPedido: ingressoRepository.buscarIngressosPorPedido,
        buscarItensPedido: pedidoRepository.buscarItensPedido,
        criarIngressoEmitido: ingressoRepository.criarIngressoEmitido
    };
    let emissoes = 0;

    ingressoRepository.buscarIngressosPorPedido = async () => [];
    pedidoRepository.buscarItensPedido = async () => [{ lote_id: 1, quantidade: 2 }];
    ingressoRepository.criarIngressoEmitido = async () => { emissoes += 1; return { id: emissoes, codigo: 'x'.repeat(24) }; };

    try {
        const resultado = await pedidoService.confirmarPagamentoPedido(
            { id: 42, status: 'pago', codigo_publico: 'abc' },
            '99'
        );
        assert.equal(resultado.jaPago, true);
        assert.equal(resultado.ingressos.length, 2);
        assert.equal(emissoes, 2);
    } finally {
        ingressoRepository.buscarIngressosPorPedido = originais.buscarIngressosPorPedido;
        pedidoRepository.buscarItensPedido = originais.buscarItensPedido;
        ingressoRepository.criarIngressoEmitido = originais.criarIngressoEmitido;
    }
});

test('pedido pago que já tem ingresso não reemite em reentrega do webhook', async () => {
    const originais = {
        buscarIngressosPorPedido: ingressoRepository.buscarIngressosPorPedido,
        criarIngressoEmitido: ingressoRepository.criarIngressoEmitido
    };
    let emissoes = 0;

    ingressoRepository.buscarIngressosPorPedido = async () => [{ id: 1, codigo: 'x'.repeat(24) }];
    ingressoRepository.criarIngressoEmitido = async () => { emissoes += 1; return {}; };

    try {
        const resultado = await pedidoService.confirmarPagamentoPedido({ id: 42, status: 'pago' }, '99');
        assert.deepEqual(resultado, { jaPago: true });
        assert.equal(emissoes, 0);
    } finally {
        ingressoRepository.buscarIngressosPorPedido = originais.buscarIngressosPorPedido;
        ingressoRepository.criarIngressoEmitido = originais.criarIngressoEmitido;
    }
});

test('pagamento confirmado emite ingresso dentro da mesma transação — falha na emissão desfaz tudo', async () => {
    const pedidoRepository = require('../src/repositories/pedido.repository');
    const originais = {
        buscarItensPedido: pedidoRepository.buscarItensPedido,
        confirmarVendaLote: pedidoRepository.confirmarVendaLote,
        comTransacao: db.comTransacao
    };

    pedidoRepository.buscarItensPedido = async () => [{ lote_id: 1, quantidade: 1 }];
    pedidoRepository.confirmarVendaLote = async () => ({ affectedRows: 1 });
    db.comTransacao = async (trabalho) => trabalho(async (sql) => {
        if (sql.includes('INSERT INTO ingressos_emitidos')) throw new Error('falha simulada na emissão');
        return { affectedRows: 1 };
    });

    try {
        await assert.rejects(
            pedidoService.confirmarPagamentoPedido({ id: 7, status: 'pendente' }, '99'),
            /falha simulada na emissão/
        );
    } finally {
        pedidoRepository.buscarItensPedido = originais.buscarItensPedido;
        pedidoRepository.confirmarVendaLote = originais.confirmarVendaLote;
        db.comTransacao = originais.comTransacao;
    }
});

test('notificação concorrente que perdeu a atualização não duplica ingressos', async () => {
    const pedidoRepository = require('../src/repositories/pedido.repository');
    const originais = {
        buscarItensPedido: pedidoRepository.buscarItensPedido,
        buscarPorId: pedidoRepository.buscarPorId,
        comTransacao: db.comTransacao,
        criarIngressoEmitido: ingressoRepository.criarIngressoEmitido
    };
    let emissoes = 0;

    pedidoRepository.buscarItensPedido = async () => [{ lote_id: 1, quantidade: 1 }];
    pedidoRepository.buscarPorId = async () => ({ id: 7, status: 'pago' });
    db.comTransacao = async () => false;
    ingressoRepository.criarIngressoEmitido = async () => { emissoes += 1; };

    try {
        const resultado = await pedidoService.confirmarPagamentoPedido({ id: 7, status: 'pendente' }, '99');
        assert.deepEqual(resultado, { jaPago: true });
        assert.equal(emissoes, 0);
    } finally {
        pedidoRepository.buscarItensPedido = originais.buscarItensPedido;
        pedidoRepository.buscarPorId = originais.buscarPorId;
        db.comTransacao = originais.comTransacao;
        ingressoRepository.criarIngressoEmitido = originais.criarIngressoEmitido;
    }
});

test('pagamento aprovado após expiração é resgatado se ainda houver estoque', async () => {
    const pedidoRepository = require('../src/repositories/pedido.repository');
    const cupomRepository = require('../src/repositories/cupom.repository');
    const originais = {
        buscarItensPedido: pedidoRepository.buscarItensPedido,
        buscarPorId: pedidoRepository.buscarPorId,
        reservarLote: pedidoRepository.reservarLote,
        confirmarVendaLote: pedidoRepository.confirmarVendaLote,
        comTransacao: db.comTransacao,
        criarIngressoEmitidoTx: ingressoRepository.criarIngressoEmitidoTx
    };
    let emissoes = 0;
    let vendaConfirmada = false;

    pedidoRepository.buscarItensPedido = async () => [{ lote_id: 1, quantidade: 1 }];
    pedidoRepository.buscarPorId = async () => ({ id: 7, status: 'expirado' });
    pedidoRepository.reservarLote = async () => ({ affectedRows: 1 });
    pedidoRepository.confirmarVendaLote = async () => { vendaConfirmada = true; return { affectedRows: 1 }; };
    db.comTransacao = async (trabalho) => trabalho(async (sql) => {
        if (sql.includes("status = 'pendente'")) return { affectedRows: 0 };
        return { affectedRows: 1 };
    });
    ingressoRepository.criarIngressoEmitidoTx = async () => { emissoes += 1; return { id: emissoes, codigo: 'x'.repeat(24) }; };

    try {
        const resultado = await pedidoService.confirmarPagamentoPedido(
            { id: 7, status: 'expirado', codigo_publico: 'abc', cupom_id: null },
            '99'
        );
        assert.equal(resultado.jaPago, false);
        assert.equal(resultado.resgatado, true);
        assert.equal(vendaConfirmada, true);
        assert.equal(emissoes, 1);
    } finally {
        pedidoRepository.buscarItensPedido = originais.buscarItensPedido;
        pedidoRepository.buscarPorId = originais.buscarPorId;
        pedidoRepository.reservarLote = originais.reservarLote;
        pedidoRepository.confirmarVendaLote = originais.confirmarVendaLote;
        db.comTransacao = originais.comTransacao;
        ingressoRepository.criarIngressoEmitidoTx = originais.criarIngressoEmitidoTx;
        void cupomRepository;
    }
});

test('pagamento aprovado após expiração sem estoque fica marcado para reconciliação manual', async () => {
    const pedidoRepository = require('../src/repositories/pedido.repository');
    const originais = {
        buscarItensPedido: pedidoRepository.buscarItensPedido,
        buscarPorId: pedidoRepository.buscarPorId,
        reservarLote: pedidoRepository.reservarLote,
        comTransacao: db.comTransacao
    };

    pedidoRepository.buscarItensPedido = async () => [{ lote_id: 1, quantidade: 1 }];
    pedidoRepository.buscarPorId = async () => ({ id: 7, status: 'expirado' });
    db.comTransacao = async (trabalho) => trabalho(async (sql) => {
        if (sql.includes("status = 'pendente'")) return { affectedRows: 0 };
        throw new Error('ESTOQUE_INSUFICIENTE');
    });

    try {
        const resultado = await pedidoService.confirmarPagamentoPedido(
            { id: 7, status: 'expirado', codigo_publico: 'abc', cupom_id: null },
            '99'
        );
        assert.deepEqual(resultado, { jaPago: true, precisaReconciliacao: true });
    } finally {
        pedidoRepository.buscarItensPedido = originais.buscarItensPedido;
        pedidoRepository.buscarPorId = originais.buscarPorId;
        pedidoRepository.reservarLote = originais.reservarLote;
        db.comTransacao = originais.comTransacao;
    }
});

test('produtor não lê evento de outro produtor', async () => {
    const original = eventoRepository.buscarPorId;
    eventoRepository.buscarPorId = async () => ({ id: 9, criado_por: 2 });
    try {
        await assert.rejects(
            eventoService.obterEventoPorId(9, { id: 3, perfil: 'produtor' }),
            /Sem permissão/
        );
        const evento = await eventoService.obterEventoPorId(9, { id: 1, perfil: 'admin' });
        assert.equal(evento.id, 9);
    } finally {
        eventoRepository.buscarPorId = original;
    }
});

test('produtor não recebe contato nem cachê base do catálogo', async () => {
    const original = bandaRepository.buscarTodas;
    bandaRepository.buscarTodas = async () => [{
        id: 1,
        nome: 'Banda',
        genero: 'Rock',
        contato: 'privado@example.test',
        cache_base: 1000
    }];
    try {
        const [bandaProdutor] = await bandaService.listarBandas({ perfil: 'produtor' });
        const [bandaAdmin] = await bandaService.listarBandas({ perfil: 'admin' });
        assert.equal(bandaProdutor.contato, undefined);
        assert.equal(bandaProdutor.cache_base, undefined);
        assert.equal(bandaAdmin.contato, 'privado@example.test');
        assert.equal(bandaAdmin.cache_base, 1000);
    } finally {
        bandaRepository.buscarTodas = original;
    }
});

test('produtor não vê cachê da banda na lineup do próprio evento (achado M7)', async () => {
    const lineupService = require('../src/services/lineup.service');
    const lineupRepository = require('../src/repositories/lineup.repository');
    const originais = {
        buscarPorId: eventoRepository.buscarPorId,
        buscarPorEvento: lineupRepository.buscarPorEvento
    };

    eventoRepository.buscarPorId = async () => ({ id: 1, criado_por: 7 });
    lineupRepository.buscarPorEvento = async () => ([
        { lineup_id: 1, evento_id: 1, nome: 'Banda X', horario: '22:00', cache: 1500 }
    ]);

    try {
        const paraProdutor = await lineupService.listarLineupDoEvento(1, { id: 7, perfil: 'produtor' });
        assert.equal(paraProdutor[0].cache, undefined);
        assert.equal(paraProdutor[0].nome, 'Banda X');

        const paraAdmin = await lineupService.listarLineupDoEvento(1, { id: 99, perfil: 'admin' });
        assert.equal(paraAdmin[0].cache, 1500);
    } finally {
        eventoRepository.buscarPorId = originais.buscarPorId;
        lineupRepository.buscarPorEvento = originais.buscarPorEvento;
    }
});

test('produtor não vê cachê da banda em GET /eventos?include=lineup (achado M7)', async () => {
    const eventoService = require('../src/services/evento.service');
    const lineupRepository = require('../src/repositories/lineup.repository');
    const originais = {
        buscarTodos: eventoRepository.buscarTodos,
        buscarPorEventos: lineupRepository.buscarPorEventos
    };

    eventoRepository.buscarTodos = async () => ([{ id: 1, nome: 'Show', criado_por: 7 }]);
    lineupRepository.buscarPorEventos = async () => ([
        { lineup_id: 1, evento_id: 1, nome: 'Banda X', cache: 1500 }
    ]);

    try {
        const lista = await eventoService.listarEventos({ include: 'lineup' }, { id: 7, perfil: 'produtor' });
        assert.equal(lista[0].lineup[0].cache, undefined);
    } finally {
        eventoRepository.buscarTodos = originais.buscarTodos;
        lineupRepository.buscarPorEventos = originais.buscarPorEventos;
    }
});

test('novas senhas exigem pelo menos 12 caracteres', () => {
    assert.equal(registrarSchema.safeParse({ email: 'a@b.com', senha: '123456' }).success, false);
    assert.equal(registrarSchema.safeParse({ email: 'a@b.com', senha: 'frase-segura-123' }).success, true);
    assert.equal(trocarPropriaSenhaSchema.safeParse({ senha_atual: 'antiga', senha: 'curta' }).success, false);
});
