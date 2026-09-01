const db = require('../database/db');

exports.buscarTodas = () => new Promise((resolve, reject) => {
    db.query('SELECT * FROM bandas ORDER BY nome ASC', (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados);
    });
});

exports.buscarPorId = (id) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM bandas WHERE id = ?', [id], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados[0]);
    });
});

exports.salvar = ({ nome, genero, contato, descricao, cache_base }) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO bandas (nome, genero, contato, descricao, cache_base) VALUES (?, ?, ?, ?, ?)',
        [nome, genero || null, contato || null, descricao || null, cache_base],
        (err, result) => {
            if (err) return reject(err);
            resolve({ id: result.insertId, nome, genero, contato, descricao, cache_base });
        }
    );
});

exports.atualizar = (id, dados) => new Promise((resolve, reject) => {
    const campos = [];
    const valores = [];

    if (dados.nome !== undefined) { campos.push('nome = ?'); valores.push(dados.nome); }
    if (dados.genero !== undefined) { campos.push('genero = ?'); valores.push(dados.genero || null); }
    if (dados.contato !== undefined) { campos.push('contato = ?'); valores.push(dados.contato || null); }
    if (dados.descricao !== undefined) { campos.push('descricao = ?'); valores.push(dados.descricao || null); }
    if (dados.cache_base !== undefined) { campos.push('cache_base = ?'); valores.push(dados.cache_base); }

    if (!campos.length) return resolve(null);

    valores.push(id);
    db.query(`UPDATE bandas SET ${campos.join(', ')} WHERE id = ?`, valores, (err, result) => {
        if (err) return reject(err);
        if (!result.affectedRows) return resolve(null);
        exports.buscarPorId(id).then(resolve).catch(reject);
    });
});

exports.excluir = (id) => new Promise((resolve, reject) => {
    db.query('DELETE FROM bandas WHERE id = ?', [id], (err, result) => {
        if (err) return reject(err);
        resolve(result.affectedRows > 0);
    });
});
