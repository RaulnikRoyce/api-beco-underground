const db = require('../database/db');

const ORDENAR = {
    data_desc: 'data DESC, id DESC',
    data_asc: 'data ASC, id ASC',
    nome: 'nome ASC'
};

const SELECT_EVENTO = `SELECT id, nome, DATE_FORMAT(data, '%Y-%m-%d') AS data, local, criado_por,
    slug, publico_esperado, capacidade_maxima, margem_percentual, venda_publicada,
    taxa_mp_percentual, repassa_taxa_comprador
FROM eventos`;

exports.buscarTodos = ({ q, ordenar = 'data_desc', limite, offset } = {}) => new Promise((resolve, reject) => {
    const params = [];
    let sql = SELECT_EVENTO;

    if (q) {
        sql += ' WHERE (nome LIKE ? OR local LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY ${ORDENAR[ordenar] || ORDENAR.data_desc}`;

    if (limite != null) {
        sql += ' LIMIT ? OFFSET ?';
        params.push(Number(limite), Number(offset) || 0);
    }

    db.query(sql, params, (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados);
    });
});

exports.contar = ({ q } = {}) => new Promise((resolve, reject) => {
    const params = [];
    let sql = 'SELECT COUNT(*) AS total FROM eventos';

    if (q) {
        sql += ' WHERE (nome LIKE ? OR local LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
    }

    db.query(sql, params, (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados[0].total);
    });
});

exports.buscarPorId = (id) => new Promise((resolve, reject) => {
    db.query(`${SELECT_EVENTO} WHERE id = ?`, [id], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados[0]);
    });
});

exports.salvar = ({ nome, data, local, criado_por, slug }) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO eventos (nome, data, local, criado_por, slug) VALUES (?, ?, ?, ?, ?)',
        [nome, data, local, criado_por || null, slug || null],
        (err, result) => {
            if (err) return reject(err);
            exports.buscarPorId(result.insertId).then(resolve).catch(reject);
        }
    );
});

exports.excluir = (id) => new Promise((resolve, reject) => {
    db.query('DELETE FROM eventos WHERE id = ?', [id], (err, result) => {
        if (err) return reject(err);
        resolve(result.affectedRows > 0);
    });
});

exports.atualizar = (id, dados) => new Promise((resolve, reject) => {
    const campos = [];
    const params = [];

    if (dados.nome !== undefined) {
        campos.push('nome = ?');
        params.push(dados.nome);
    }
    if (dados.data !== undefined) {
        campos.push('data = ?');
        params.push(dados.data);
    }
    if (dados.local !== undefined) {
        campos.push('local = ?');
        params.push(dados.local);
    }

    if (!campos.length) return resolve(false);

    params.push(id);
    db.query(`UPDATE eventos SET ${campos.join(', ')} WHERE id = ?`, params, (err, result) => {
        if (err) return reject(err);
        if (!result.affectedRows) return resolve(false);
        exports.buscarPorId(id).then(resolve).catch(reject);
    });
});
