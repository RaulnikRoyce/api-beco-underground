const crypto = require('crypto');
const { gerarTokenPreview, validarTokenPreview } = require('../utils/preview.token');
const db = require('../database/db');
const eventoRepository = require('../repositories/evento.repository');
const ingressoRepository = require('../repositories/ingresso.repository');
const pedidoRepository = require('../repositories/pedido.repository');
const { AppError } = require('../utils/erros');
const { podeEditarEvento } = require('../utils/evento.regras');
const { gerarSlugBase, garantirSlugUnico } = require('../utils/slug');
const {
    gerarLotesSugeridos,
    obterLoteVigente,
    restamDoLote,
    mensagemPublicoInsuficiente,
    arredondar,
    arredondarPrecoIngresso
} = require('../utils/lote.regras');

exports.gerarLotesSugeridos = gerarLotesSugeridos;
exports.obterLoteVigente = obterLoteVigente;

exports.calcularPrecificacao = ({
    custoCaches,
    custoProducao,
    publicoEsperado,
    capacidadeMaxima,
    margemPercentual,
    precoLoteAtivo,
    percentualVendido,
    precoSimulado
}) => {
    const caches = Number(custoCaches) || 0;
    const producao = Number(custoProducao) || 0;
    const custoTotal = caches + producao;
    const margem = Number(margemPercentual) || 0;
    let publico = Number(publicoEsperado) || 0;
    const capacidade = Number(capacidadeMaxima) || 0;
    if (capacidade > 0 && publico > 0) publico = Math.min(publico, capacidade);
    const metaReceita = arredondar(custoTotal * (1 + margem / 100));
    const precoSugerido = publico > 0 ? arredondarPrecoIngresso(metaReceita / publico) : null;
    const precoAtivo = Number(precoLoteAtivo) || precoSugerido || 0;
    const breakEven = precoAtivo > 0 ? Math.ceil(custoTotal / precoAtivo) : null;

    const pct = percentualVendido != null ? Number(percentualVendido) : 80;
    const preco = Number(precoSimulado) || precoSugerido || 0;
    const vendidos = publico > 0 ? Math.floor(publico * pct / 100) : 0;
    const receitaSimulada = arredondar(vendidos * preco);
    const sobra = arredondar(receitaSimulada - custoTotal);
    const breakEvenSimulado = preco > 0 ? Math.ceil(custoTotal / preco) : null;
    const faltaParaMeta = arredondar(metaReceita - receitaSimulada);

    const lotesSugeridos = gerarLotesSugeridos({
        publicoEsperado: Number(publicoEsperado) || 0,
        capacidadeMaxima: capacidade || null,
        metaReceita,
        precoMedioReferencia: precoSugerido
    });

    return {
        custo_caches: caches,
        custo_producao: producao,
        custo_total: custoTotal,
        meta_receita: metaReceita,
        preco_sugerido: precoSugerido,
        preco_medio_referencia: precoSugerido,
        break_even: breakEven,
        lotes_sugeridos: lotesSugeridos,
        simulador: {
            percentual_vendido: pct,
            ingressos_vendidos: vendidos,
            preco_unitario: preco,
            receita: receitaSimulada,
            sobra,
            falta_para_meta: faltaParaMeta,
            break_even: breakEvenSimulado,
            meta_receita: metaReceita,
            cobre_custo: sobra >= 0
        }
    };
};

const assertLeitura = async (eventoId, usuario) => {
    const evento = await eventoRepository.buscarPorId(eventoId);
    if (!evento) throw new AppError(404, 'Evento não encontrado');
    if (!podeEditarEvento(evento, usuario)) {
        throw new AppError(403, 'Sem permissão para ver ingressos deste evento');
    }
    return evento;
};

const assertAdmin = (usuario) => {
    if (usuario.perfil !== 'admin') {
        throw new AppError(403, 'Só admin pode alterar ingressos');
    }
};

const validarCapacidade = async (eventoId, novaQuantidade, excluirLoteId = null) => {
    const config = await ingressoRepository.buscarConfigEvento(eventoId);
    const capacidade = Number(config?.capacidade_maxima);

    if (!capacidade) return;

    const somaAtual = await ingressoRepository.somaQuantidadeLotes(eventoId, excluirLoteId);
    if (somaAtual + Number(novaQuantidade) > capacidade) {
        throw new AppError(400, `Soma dos lotes (${somaAtual + Number(novaQuantidade)}) passa a capacidade (${capacidade})`);
    }
};

const obterPrecoLoteAtivo = (lotes) => {
    const ativos = (lotes || []).filter((lote) => lote.ativo);
    if (!ativos.length) return null;
    return Number(ativos.sort((a, b) => a.ordem - b.ordem || a.id - b.id)[0].preco);
};

exports.garantirSlugDoEvento = async (eventoId, nomePreferido) => {
    const config = await ingressoRepository.buscarConfigEvento(eventoId);
    if (config?.slug) return config.slug;

    const base = gerarSlugBase(nomePreferido || config?.nome);
    const slug = await garantirSlugUnico(base, eventoId);
    await ingressoRepository.definirSlug(eventoId, slug);
    return slug;
};

exports.listarCustos = async (eventoId, usuario) => {
    await assertLeitura(eventoId, usuario);
    return ingressoRepository.buscarCustos(eventoId);
};

exports.criarCusto = async (eventoId, dados, usuario) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);
    return ingressoRepository.criarCusto({ ...dados, evento_id: eventoId });
};

exports.atualizarCusto = async (eventoId, custoId, dados, usuario) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);
    const atualizado = await ingressoRepository.atualizarCusto(custoId, eventoId, dados);
    if (!atualizado) throw new AppError(404, 'Custo não encontrado');
    return atualizado;
};

exports.excluirCusto = async (eventoId, custoId, usuario) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);
    const ok = await ingressoRepository.excluirCusto(custoId, eventoId);
    if (!ok) throw new AppError(404, 'Custo não encontrado');
};

exports.listarLotes = async (eventoId, usuario) => {
    await assertLeitura(eventoId, usuario);
    return ingressoRepository.buscarLotes(eventoId);
};

exports.criarLote = async (eventoId, dados, usuario) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);
    await validarCapacidade(eventoId, dados.quantidade_total);
    return ingressoRepository.criarLote({ ...dados, evento_id: eventoId });
};

exports.atualizarLote = async (eventoId, loteId, dados, usuario) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);

    if (dados.quantidade_total !== undefined) {
        await validarCapacidade(eventoId, dados.quantidade_total, loteId);
    }

    const atualizado = await ingressoRepository.atualizarLote(loteId, eventoId, dados);
    if (!atualizado) throw new AppError(404, 'Lote não encontrado');
    return atualizado;
};

exports.excluirLote = async (eventoId, loteId, usuario) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);

    const lote = await ingressoRepository.buscarLotePorId(loteId, eventoId);
    if (!lote) throw new AppError(404, 'Lote não encontrado');

    const ativos = await pedidoRepository.contarPedidosAtivosPorLote(loteId);
    if (ativos > 0) {
        throw new AppError(
            409,
            `Há ${ativos} pedido(s) ativo(s) neste lote. Cancele-os em Compradores antes de excluir.`
        );
    }

    await pedidoRepository.limparVinculosLoteInativos(loteId);

    const ok = await ingressoRepository.excluirLote(loteId, eventoId);
    if (!ok) throw new AppError(404, 'Lote não encontrado');
};

exports.obterPrecificacao = async (eventoId, usuario, query = {}) => {
    await assertLeitura(eventoId, usuario);

    const [config, custoProducao, custoCaches, lotes] = await Promise.all([
        ingressoRepository.buscarConfigEvento(eventoId),
        ingressoRepository.somaCustosProducao(eventoId),
        ingressoRepository.obterCustoCaches(eventoId),
        ingressoRepository.buscarLotes(eventoId)
    ]);

    return exports.calcularPrecificacao({
        custoCaches,
        custoProducao,
        publicoEsperado: config?.publico_esperado,
        capacidadeMaxima: config?.capacidade_maxima,
        margemPercentual: config?.margem_percentual,
        precoLoteAtivo: obterPrecoLoteAtivo(lotes),
        percentualVendido: query.percentual_vendido,
        precoSimulado: query.preco_simulado
    });
};

exports.obterResumo = async (eventoId, usuario) => {
    await assertLeitura(eventoId, usuario);

    const [config, custos, lotes, precificacao, vendidos, receita, entraram] = await Promise.all([
        ingressoRepository.buscarConfigEvento(eventoId),
        ingressoRepository.buscarCustos(eventoId),
        ingressoRepository.buscarLotes(eventoId),
        exports.obterPrecificacao(eventoId, usuario),
        ingressoRepository.contarIngressosEmitidos(eventoId),
        ingressoRepository.receitaIngressos(eventoId),
        pedidoRepository.contarIngressosUsados(eventoId)
    ]);

    const lotesComRestam = lotes.map((lote) => ({
        ...lote,
        restam: restamDoLote(lote)
    }));

    const vigente = obterLoteVigente(lotesComRestam);

    return {
        config,
        custos,
        lotes: lotesComRestam.map((lote) => ({
            ...lote,
            vigente: vigente ? lote.id === vigente.id : false
        })),
        lote_vigente: vigente,
        precificacao,
        vendidos,
        receita,
        entraram,
        custo_coberto: receita >= (precificacao.custo_total || 0),
        link_publico: config?.slug ? `/${config.slug}` : `/e/${eventoId}`
    };
};

exports.atualizarConfig = async (eventoId, dados, usuario) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);

    if (dados.slug !== undefined) {
        const slug = String(dados.slug).trim().toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
            throw new AppError(400, 'Slug inválido. Use letras minúsculas, números e hífens.');
        }
        const emUso = await ingressoRepository.slugEmUso(slug, eventoId);
        if (emUso) throw new AppError(409, 'Slug já está em uso');
        dados.slug = slug;
    }

    const atualizado = await ingressoRepository.atualizarConfigEvento(eventoId, dados);
    if (!atualizado) throw new AppError(404, 'Evento não encontrado');
    return atualizado;
};

exports.publicarVenda = async (eventoId, usuario, publicado = true) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);

    const config = await ingressoRepository.buscarConfigEvento(eventoId);
    if (!config?.slug) {
        await exports.garantirSlugDoEvento(eventoId, config?.nome);
    }

    const lotes = await ingressoRepository.buscarLotes(eventoId);
    if (publicado && !lotes.length) {
        throw new AppError(400, 'Cadastre ao menos um lote antes de publicar');
    }

    return ingressoRepository.atualizarConfigEvento(eventoId, { venda_publicada: publicado ? 1 : 0 });
};

exports.criarLotesSugeridos = async (eventoId, usuario) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);

    const precificacao = await exports.obterPrecificacao(eventoId, usuario);
    const sugestoes = precificacao.lotes_sugeridos || [];
    if (!sugestoes.length) {
        throw new AppError(400, mensagemPublicoInsuficiente());
    }

    const existentes = await ingressoRepository.buscarLotes(eventoId);
    if (existentes.length) {
        throw new AppError(409, 'Remova os lotes atuais ou crie manualmente. Já existem lotes cadastrados.');
    }

    const criados = [];
    for (const sugestao of sugestoes) {
        await validarCapacidade(eventoId, sugestao.quantidade_total);
        const lote = await ingressoRepository.criarLote({
            evento_id: eventoId,
            nome: sugestao.nome,
            preco: sugestao.preco,
            quantidade_total: sugestao.quantidade_total,
            ordem: sugestao.ordem,
            inicio_venda: null,
            fim_venda: null
        });
        criados.push(lote);
    }
    return criados;
};

exports.listarEventosPublicos = async () => {
    const eventos = await ingressoRepository.listarEventosPublicados();
    const comLotes = await Promise.all(eventos.map(async (evento) => {
        const lotes = await ingressoRepository.buscarLotes(evento.id);
        const comRestam = lotes.map((lote) => ({ ...lote, restam: restamDoLote(lote) }));
        const vigente = obterLoteVigente(comRestam);
        return {
            ...evento,
            lotes: vigente ? [vigente] : [],
            lote_vigente: vigente
        };
    }));
    return comLotes.filter((evento) => evento.lote_vigente);
};

exports.obterEventoPublico = async (slugOuId, previewToken) => {
    let evento = null;
    const numerico = /^\d+$/.test(String(slugOuId));

    if (numerico) {
        evento = await ingressoRepository.buscarConfigEvento(Number(slugOuId));
    } else {
        evento = await ingressoRepository.buscarEventoPorSlug(slugOuId);
    }

    if (!evento) throw new AppError(404, 'Evento não encontrado');

    if (!evento.venda_publicada && !validarTokenPreview(previewToken, evento.id)) {
        throw new AppError(404, 'Venda não publicada');
    }

    const lotes = await ingressoRepository.buscarLotes(evento.id);
    const lotesComRestam = lotes.map((lote) => ({
        ...lote,
        restam: restamDoLote(lote)
    }));
    const vigente = obterLoteVigente(lotesComRestam);

    const lotesPublicos = lotesComRestam
        .filter((l) => Number(l.ativo))
        .map((lote) => ({
            ...lote,
            vigente: vigente ? lote.id === vigente.id : false,
            status_venda: !Number(lote.ativo)
                ? 'inativo'
                : lote.restam <= 0
                    ? 'esgotado'
                    : vigente && lote.id === vigente.id
                        ? 'vigente'
                        : 'indisponivel'
        }));

    return {
        ...evento,
        lotes: lotesPublicos,
        lote_vigente: vigente
    };
};

exports.criarTokenPreview = async (eventoId, usuario) => {
    const evento = await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);
    return { token: gerarTokenPreview(evento.id), expira_em_segundos: 300 };
};

const emitirPedidoPagoPresencial = async (eventoId, dados, usuario, canal) => {
    await assertLeitura(eventoId, usuario);
    assertAdmin(usuario);

    const lotes = await ingressoRepository.buscarLotes(eventoId);
    const lotesComRestam = lotes.map((l) => ({ ...l, restam: restamDoLote(l) }));
    const vigente = obterLoteVigente(lotesComRestam);

    let loteId = dados.lote_id ? Number(dados.lote_id) : vigente?.id;
    if (!loteId) throw new AppError(400, 'Nenhum lote disponível');

    const lote = await ingressoRepository.buscarLotePorId(loteId, eventoId);
    if (!lote) throw new AppError(404, 'Lote não encontrado');

    const quantidade = Number(dados.quantidade) || 1;
    const restam = restamDoLote(lote);
    if (restam < quantidade) throw new AppError(400, 'Estoque insuficiente neste lote');

    const codigoPublico = crypto.randomBytes(8).toString('hex');
    const total = arredondar(Number(lote.preco) * quantidade);
    const email = (dados.email && String(dados.email).trim())
        || `porta+${codigoPublico}@beco.local`;

    const pedidoId = await ingressoRepository.criarPedidoPagoCanal({
        evento_id: eventoId,
        codigo_publico: codigoPublico,
        nome: dados.nome,
        email,
        total,
        canal
    });

    await ingressoRepository.criarItemPedido({
        pedido_id: pedidoId,
        lote_id: lote.id,
        quantidade,
        preco_unitario: lote.preco
    });

    await new Promise((resolve, reject) => {
        db.query(
            'UPDATE lotes_ingresso SET quantidade_vendida = quantidade_vendida + ? WHERE id = ?',
            [quantidade, lote.id],
            (err) => (err ? reject(err) : resolve())
        );
    });

    const ingressos = [];
    for (let i = 0; i < quantidade; i += 1) {
        const codigo = crypto.randomBytes(12).toString('hex');
        const emitido = await ingressoRepository.criarIngressoEmitido({
            codigo,
            pedido_id: pedidoId,
            lote_id: lote.id
        });
        ingressos.push(emitido);
    }

    return { pedido_id: pedidoId, codigo_publico: codigoPublico, ingressos, canal };
};

exports.emitirCortesia = async (eventoId, dados, usuario) => {
    const resultado = await emitirPedidoPagoPresencial(eventoId, dados, usuario, 'cortesia');
    return resultado;
};

exports.emitirVendaPorta = async (eventoId, dados, usuario) => {
    if (!dados.nome || String(dados.nome).trim().length < 2) {
        throw new AppError(400, 'Nome obrigatório');
    }
    return emitirPedidoPagoPresencial(eventoId, dados, usuario, 'porta');
};
