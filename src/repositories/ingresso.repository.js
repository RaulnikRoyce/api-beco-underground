const db = require('../database/db');
const dashboardRepository = require('./dashboard.repository');
const { paraMysqlDatetime } = require('../utils/mysql-datetime');

const CAMPOS_EVENTO_INGRESSO = `
    slug,
    publico_esperado,
    capacidade_maxima,
    margem_percentual,
    venda_publicada,
    taxa_mp_percentual,
    repassa_taxa_comprador
`;

exports.buscarCustos = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, evento_id, descricao, categoria, valor
         FROM custos_evento
         WHERE evento_id = ?
         ORDER BY id ASC`,
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        }
    );
});

exports.buscarCustoPorId = (custoId, eventoId) => new Promise((resolve, reject) => {
    db.query(
        'SELECT id, evento_id, descricao, categoria, valor FROM custos_evento WHERE id = ? AND evento_id = ?',
        [custoId, eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.criarCusto = ({ evento_id, descricao, categoria, valor }) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO custos_evento (evento_id, descricao, categoria, valor) VALUES (?, ?, ?, ?)',
        [evento_id, descricao, categoria || null, valor],
        (err, result) => {
            if (err) return reject(err);
            resolve({ id: result.insertId, evento_id, descricao, categoria: categoria || null, valor });
        }
    );
});

exports.atualizarCusto = (custoId, eventoId, dados) => new Promise((resolve, reject) => {
    const campos = [];
    const params = [];

    if (dados.descricao !== undefined) {
        campos.push('descricao = ?');
        params.push(dados.descricao);
    }
    if (dados.categoria !== undefined) {
        campos.push('categoria = ?');
        params.push(dados.categoria);
    }
    if (dados.valor !== undefined) {
        campos.push('valor = ?');
        params.push(dados.valor);
    }

    if (!campos.length) return resolve(null);

    params.push(custoId, eventoId);
    db.query(
        `UPDATE custos_evento SET ${campos.join(', ')} WHERE id = ? AND evento_id = ?`,
        params,
        (err, result) => {
            if (err) return reject(err);
            if (!result.affectedRows) return resolve(null);
            exports.buscarCustoPorId(custoId, eventoId).then(resolve).catch(reject);
        }
    );
});

exports.excluirCusto = (custoId, eventoId) => new Promise((resolve, reject) => {
    db.query(
        'DELETE FROM custos_evento WHERE id = ? AND evento_id = ?',
        [custoId, eventoId],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.affectedRows > 0);
        }
    );
});

exports.somaCustosProducao = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        'SELECT COALESCE(SUM(valor), 0) AS total FROM custos_evento WHERE evento_id = ?',
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(Number(rows[0].total) || 0);
        }
    );
});

exports.buscarLotes = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, evento_id, nome, preco, quantidade_total, quantidade_vendida,
                quantidade_reservada, ordem, inicio_venda, fim_venda, ativo
         FROM lotes_ingresso
         WHERE evento_id = ?
         ORDER BY ordem ASC, id ASC`,
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        }
    );
});

exports.buscarLotePorId = (loteId, eventoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, evento_id, nome, preco, quantidade_total, quantidade_vendida,
                quantidade_reservada, ordem, inicio_venda, fim_venda, ativo
         FROM lotes_ingresso WHERE id = ? AND evento_id = ?`,
        [loteId, eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.criarLote = (dados) => new Promise((resolve, reject) => {
    db.query(
        `INSERT INTO lotes_ingresso
         (evento_id, nome, preco, quantidade_total, ordem, inicio_venda, fim_venda, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            dados.evento_id,
            dados.nome,
            dados.preco,
            dados.quantidade_total,
            dados.ordem ?? 0,
            paraMysqlDatetime(dados.inicio_venda),
            paraMysqlDatetime(dados.fim_venda),
            dados.ativo ?? 1
        ],
        (err, result) => {
            if (err) return reject(err);
            exports.buscarLotePorId(result.insertId, dados.evento_id).then(resolve).catch(reject);
        }
    );
});

exports.atualizarLote = (loteId, eventoId, dados) => new Promise((resolve, reject) => {
    const campos = [];
    const params = [];
    const permitidos = ['nome', 'preco', 'quantidade_total', 'ordem', 'inicio_venda', 'fim_venda', 'ativo'];

    permitidos.forEach((campo) => {
        if (dados[campo] !== undefined) {
            campos.push(`${campo} = ?`);
            const valor = (campo === 'inicio_venda' || campo === 'fim_venda')
                ? paraMysqlDatetime(dados[campo])
                : dados[campo];
            params.push(valor);
        }
    });

    if (!campos.length) return resolve(null);

    params.push(loteId, eventoId);
    db.query(
        `UPDATE lotes_ingresso SET ${campos.join(', ')} WHERE id = ? AND evento_id = ?`,
        params,
        (err, result) => {
            if (err) return reject(err);
            if (!result.affectedRows) return resolve(null);
            exports.buscarLotePorId(loteId, eventoId).then(resolve).catch(reject);
        }
    );
});

exports.excluirLote = (loteId, eventoId) => new Promise((resolve, reject) => {
    db.query(
        'DELETE FROM lotes_ingresso WHERE id = ? AND evento_id = ?',
        [loteId, eventoId],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.affectedRows > 0);
        }
    );
});

exports.somaQuantidadeLotes = (eventoId, excluirLoteId = null) => new Promise((resolve, reject) => {
    const params = [eventoId];
    let sql = 'SELECT COALESCE(SUM(quantidade_total), 0) AS total FROM lotes_ingresso WHERE evento_id = ?';

    if (excluirLoteId != null) {
        sql += ' AND id != ?';
        params.push(excluirLoteId);
    }

    db.query(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(Number(rows[0].total) || 0);
    });
});

exports.atualizarConfigEvento = (eventoId, dados) => new Promise((resolve, reject) => {
    const campos = [];
    const params = [];
    const permitidos = [
        'slug',
        'publico_esperado',
        'capacidade_maxima',
        'margem_percentual',
        'venda_publicada',
        'taxa_mp_percentual',
        'repassa_taxa_comprador'
    ];

    permitidos.forEach((campo) => {
        if (dados[campo] !== undefined) {
            campos.push(`${campo} = ?`);
            params.push(dados[campo]);
        }
    });

    if (!campos.length) return resolve(null);

    params.push(eventoId);
    db.query(
        `UPDATE eventos SET ${campos.join(', ')} WHERE id = ?`,
        params,
        (err, result) => {
            if (err) return reject(err);
            if (!result.affectedRows) return resolve(null);
            exports.buscarConfigEvento(eventoId).then(resolve).catch(reject);
        }
    );
});

exports.buscarConfigEvento = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, nome, DATE_FORMAT(data, '%Y-%m-%d') AS data, local, criado_por, ${CAMPOS_EVENTO_INGRESSO}
         FROM eventos WHERE id = ?`,
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.buscarEventoPorSlug = (slug) => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, nome, DATE_FORMAT(data, '%Y-%m-%d') AS data, local, ${CAMPOS_EVENTO_INGRESSO}
         FROM eventos WHERE slug = ?`,
        [slug],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0]);
        }
    );
});

exports.slugEmUso = (slug, eventoIdExcluir = null) => new Promise((resolve, reject) => {
    const params = [slug];
    let sql = 'SELECT id FROM eventos WHERE slug = ?';

    if (eventoIdExcluir != null) {
        sql += ' AND id != ?';
        params.push(eventoIdExcluir);
    }

    db.query(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows.length > 0);
    });
});

exports.definirSlug = (eventoId, slug) => new Promise((resolve, reject) => {
    db.query('UPDATE eventos SET slug = ? WHERE id = ?', [slug, eventoId], (err) => {
        if (err) return reject(err);
        resolve(slug);
    });
});

exports.listarEventosPublicados = () => new Promise((resolve, reject) => {
    db.query(
        `SELECT id, nome, DATE_FORMAT(data, '%Y-%m-%d') AS data, local, slug, venda_publicada
         FROM eventos
         WHERE venda_publicada = 1
         ORDER BY data ASC, id ASC`,
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        }
    );
});

exports.criarPedidoCortesia = ({ evento_id, codigo_publico, nome, email, total }) =>
    exports.criarPedidoPagoCanal({
        evento_id, codigo_publico, nome, email, total, canal: 'cortesia'
    });

exports.criarPedidoPagoCanal = ({ evento_id, codigo_publico, nome, email, total, canal }) => new Promise((resolve, reject) => {
    db.query(
        `INSERT INTO pedidos_ingresso (evento_id, codigo_publico, nome, email, status, canal, total)
         VALUES (?, ?, ?, ?, 'pago', ?, ?)`,
        [evento_id, codigo_publico, nome, email, canal || 'cortesia', total],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.insertId);
        }
    );
});

exports.criarItemPedido = ({ pedido_id, lote_id, quantidade, preco_unitario }) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO itens_pedido (pedido_id, lote_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
        [pedido_id, lote_id, quantidade, preco_unitario],
        (err, result) => {
            if (err) return reject(err);
            resolve(result.insertId);
        }
    );
});

exports.criarIngressoEmitido = ({ codigo, pedido_id, lote_id }) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO ingressos_emitidos (codigo, pedido_id, lote_id) VALUES (?, ?, ?)',
        [codigo, pedido_id, lote_id],
        (err, result) => {
            if (err) return reject(err);
            resolve({ id: result.insertId, codigo, pedido_id, lote_id, status: 'valido' });
        }
    );
});

exports.buscarIngressosPorPedido = (pedidoId) => new Promise((resolve, reject) => {
    db.query(
        'SELECT id, codigo, pedido_id, lote_id, status FROM ingressos_emitidos WHERE pedido_id = ?',
        [pedidoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        }
    );
});

exports.contarIngressosEmitidos = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT COUNT(ie.id) AS total
         FROM ingressos_emitidos ie
         JOIN pedidos_ingresso p ON ie.pedido_id = p.id
         WHERE p.evento_id = ? AND p.status = 'pago' AND ie.status != 'cancelado'`,
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(Number(rows[0].total) || 0);
        }
    );
});

exports.receitaIngressos = (eventoId) => new Promise((resolve, reject) => {
    db.query(
        `SELECT COALESCE(SUM(p.total), 0) AS receita
         FROM pedidos_ingresso p
         WHERE p.evento_id = ? AND p.status = 'pago'`,
        [eventoId],
        (err, rows) => {
            if (err) return reject(err);
            resolve(Number(rows[0].receita) || 0);
        }
    );
});

exports.obterCustoCaches = (eventoId) =>
    dashboardRepository.obterResumoDoEvento(eventoId).then((resumo) => Number(resumo.custo_total_caches) || 0);
