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

test('webhook aceita somente identificador numérico de pagamento', () => {
    assert.equal(mercadopagoService.extrairPaymentId({ data: { id: 12345 } }), '12345');
    assert.equal(mercadopagoService.extrairPaymentId({ data: { id: '../preferences' } }), null);
    assert.equal(mercadopagoService.extrairPaymentId({ data: { id: '1?x=2' } }), null);
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

test('notificação concorrente que perdeu a atualização não duplica ingressos', async () => {
    const originais = {
        buscarItensPedido: require('../src/repositories/pedido.repository').buscarItensPedido,
        comTransacao: db.comTransacao,
        criarIngressoEmitido: ingressoRepository.criarIngressoEmitido
    };
    const pedidoRepository = require('../src/repositories/pedido.repository');
    let emissoes = 0;

    pedidoRepository.buscarItensPedido = async () => [{ lote_id: 1, quantidade: 1 }];
    db.comTransacao = async () => false;
    ingressoRepository.criarIngressoEmitido = async () => { emissoes += 1; };

    try {
        const resultado = await pedidoService.confirmarPagamentoPedido({ id: 7, status: 'pendente' }, '99');
        assert.deepEqual(resultado, { jaPago: true });
        assert.equal(emissoes, 0);
    } finally {
        pedidoRepository.buscarItensPedido = originais.buscarItensPedido;
        db.comTransacao = originais.comTransacao;
        ingressoRepository.criarIngressoEmitido = originais.criarIngressoEmitido;
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

test('novas senhas exigem pelo menos 12 caracteres', () => {
    assert.equal(registrarSchema.safeParse({ email: 'a@b.com', senha: '123456' }).success, false);
    assert.equal(registrarSchema.safeParse({ email: 'a@b.com', senha: 'frase-segura-123' }).success, true);
    assert.equal(trocarPropriaSenhaSchema.safeParse({ senha_atual: 'antiga', senha: 'curta' }).success, false);
});
