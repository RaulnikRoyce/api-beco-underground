const arredondar = (valor) => Math.round(Number(valor) * 100) / 100;

/** Preço de ingresso em múltiplo de R$ 5 (termina em 0 ou 5). Mínimo R$ 5. */
const arredondarPrecoIngresso = (valor) => {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return 5;
    const arred = Math.round(n / 5) * 5;
    return arred < 5 ? 5 : arred;
};

/** Garante escada Antecipado < 1º < 2º < Porta após o arredondamento. */
const garantirPrecosCrescentes = (precos) => {
    const out = [...precos];
    for (let i = 1; i < out.length; i += 1) {
        if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 5;
    }
    return out;
};

const PUBLICO_MINIMO = 30;
const QTD_MIN_POR_LOTE = 5;

const TIERS = [
    { nome: 'Antecipado', pctPublico: 0.3, fator: 0.8 },
    { nome: '1º lote', pctPublico: 0.4, fator: 1 },
    { nome: '2º lote', pctPublico: 0.25, fator: 1.25 },
    { nome: 'Porta', pctPublico: 0.05, fator: 1.4 }
];

/** Distribui inteiros com maior resto; soma = total. */
const distribuirQuantidades = (total, pesos) => {
    const bruto = pesos.map((p) => total * p);
    const bases = bruto.map((n) => Math.floor(n));
    let resto = total - bases.reduce((s, n) => s + n, 0);
    const ordem = bruto
        .map((n, i) => ({ i, frac: n - bases[i] }))
        .sort((a, b) => b.frac - a.frac);
    const qtds = [...bases];
    for (let k = 0; k < resto; k += 1) {
        qtds[ordem[k % ordem.length].i] += 1;
    }
    return qtds;
};

/** Garante o mínimo por lote tirando do maior; null se o total não comporta. */
const aplicarMinimoPorLote = (quantidades, minimo) => {
    const qtds = [...quantidades];
    if (qtds.reduce((soma, q) => soma + q, 0) < minimo * qtds.length) return null;

    for (let i = 0; i < qtds.length; i += 1) {
        while (qtds[i] < minimo) {
            let maior = 0;
            for (let k = 1; k < qtds.length; k += 1) {
                if (qtds[k] > qtds[maior]) maior = k;
            }
            if (maior === i || qtds[maior] - 1 < minimo) return null;
            qtds[maior] -= 1;
            qtds[i] += 1;
        }
    }
    return qtds;
};

/**
 * @param {{ publicoEsperado: number, capacidadeMaxima?: number|null, metaReceita: number, precoMedioReferencia?: number|null }} params
 * @returns {Array} lotes sugeridos ou [] se inválido
 */
exports.gerarLotesSugeridos = ({
    publicoEsperado,
    capacidadeMaxima,
    metaReceita,
    precoMedioReferencia
}) => {
    let publico = Number(publicoEsperado) || 0;
    const capacidade = Number(capacidadeMaxima) || 0;
    if (capacidade > 0) publico = Math.min(publico, capacidade);
    if (publico < PUBLICO_MINIMO) return [];

    const meta = Number(metaReceita) || 0;
    const precoMedio = Number(precoMedioReferencia) || (publico > 0 ? meta / publico : 0);
    if (!precoMedio || meta <= 0) return [];

    const pesos = TIERS.map((t) => t.pctPublico);
    const quantidades = aplicarMinimoPorLote(distribuirQuantidades(publico, pesos), QTD_MIN_POR_LOTE);
    if (!quantidades) return [];

    let precos = TIERS.map((tier) => arredondarPrecoIngresso(precoMedio * tier.fator));

    const receitaBruta = precos.reduce((soma, preco, i) => soma + preco * quantidades[i], 0);
    if (receitaBruta > 0 && meta > 0) {
        const ajuste = meta / receitaBruta;
        precos = TIERS.map((tier, i) => arredondarPrecoIngresso(precos[i] * ajuste));
    }
    precos = garantirPrecosCrescentes(precos);

    const lotes = TIERS.map((tier, ordem) => ({
        nome: tier.nome,
        preco: precos[ordem],
        quantidade_total: quantidades[ordem],
        ordem,
        inicio_venda: null,
        fim_venda: null
    }));

    const receitaFinal = lotes.reduce((soma, lote) => soma + lote.preco * lote.quantidade_total, 0);
    return lotes.map((lote) => ({
        ...lote,
        receita_estimada: arredondar(lote.preco * lote.quantidade_total),
        receita_total_estimada: arredondar(receitaFinal)
    }));
};

exports.PUBLICO_MINIMO_LOTES = PUBLICO_MINIMO;
exports.mensagemPublicoInsuficiente = () =>
    `Defina um público esperado real (mín. ${PUBLICO_MINIMO}) antes de gerar lotes.`;

const restamDoLote = (lote) => Math.max(
    0,
    Number(lote.quantidade_total) - Number(lote.quantidade_vendida || 0) - Number(lote.quantidade_reservada || 0)
);

const parseDataLote = (valor) => {
    if (valor == null || valor === '') return null;
    const d = valor instanceof Date ? valor : new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Lote vigente: menor ordem elegível (ativo, estoque, janela de datas).
 * @param {Array} lotes
 * @param {Date} [agora]
 */
exports.obterLoteVigente = (lotes, agora = new Date()) => {
    const lista = [...(lotes || [])].sort((a, b) => (a.ordem - b.ordem) || (a.id - b.id));
    const now = agora instanceof Date ? agora : new Date(agora);

    for (const lote of lista) {
        if (!Number(lote.ativo)) continue;
        if (restamDoLote(lote) <= 0) continue;

        const inicio = parseDataLote(lote.inicio_venda);
        const fim = parseDataLote(lote.fim_venda);
        if (inicio && now < inicio) continue;
        if (fim && now > fim) continue;

        return {
            ...lote,
            restam: restamDoLote(lote),
            vigente: true
        };
    }
    return null;
};

exports.restamDoLote = restamDoLote;
exports.arredondar = arredondar;
exports.arredondarPrecoIngresso = arredondarPrecoIngresso;
