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

exports.salvar = ({ nome, genero, contato, cache_base }) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO bandas (nome, genero, contato, cache_base) VALUES (?, ?, ?, ?)',
        [nome, genero || null, contato || null, cache_base],
        (err, result) => {
            if (err) return reject(err);
            resolve({ id: result.insertId, nome, genero, contato, cache_base });
        }
    );
});

exports.excluir = (id) => new Promise((resolve, reject) => {
    db.query('DELETE FROM bandas WHERE id = ?', [id], (err, result) => {
        if (err) return reject(err);
        resolve(result.affectedRows > 0);
    });
});
