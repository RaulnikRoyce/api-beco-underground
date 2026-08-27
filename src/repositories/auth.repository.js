const db = require('../database/db');

const SELECT_PUBLICO = 'SELECT id, email, perfil, ativo FROM usuarios';

exports.buscarPorEmail = (email) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM usuarios WHERE email = ?', [email], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados[0] || null);
    });
});

exports.buscarPorId = (id) => new Promise((resolve, reject) => {
    db.query(`${SELECT_PUBLICO} WHERE id = ?`, [id], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados[0] || null);
    });
});

exports.buscarPorIdComSenha = (id) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM usuarios WHERE id = ?', [id], (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados[0] || null);
    });
});

exports.listar = () => new Promise((resolve, reject) => {
    db.query(`${SELECT_PUBLICO} ORDER BY perfil ASC, email ASC`, (err, resultados) => {
        if (err) return reject(err);
        resolve(resultados);
    });
});

exports.contarAdminsAtivos = () => new Promise((resolve, reject) => {
    db.query(
        "SELECT COUNT(*) AS total FROM usuarios WHERE perfil = 'admin' AND ativo = 1",
        (err, resultados) => {
            if (err) return reject(err);
            resolve(resultados[0].total);
        }
    );
});

exports.salvar = (email, senhaCriptografada, perfil) => new Promise((resolve, reject) => {
    db.query(
        'INSERT INTO usuarios (email, senha, perfil) VALUES (?, ?, ?)',
        [email, senhaCriptografada, perfil],
        (err, result) => {
            if (err) return reject(err);
            resolve({ id: result.insertId, email, perfil, ativo: 1 });
        }
    );
});

exports.atualizarAtivo = (id, ativo) => new Promise((resolve, reject) => {
    db.query(
        'UPDATE usuarios SET ativo = ? WHERE id = ?',
        [ativo ? 1 : 0, id],
        (err) => {
            if (err) return reject(err);
            resolve();
        }
    );
});

exports.excluir = (id) => new Promise((resolve, reject) => {
    db.query('DELETE FROM usuarios WHERE id = ?', [id], (err, result) => {
        if (err) return reject(err);
        resolve(result.affectedRows > 0);
    });
});

exports.atualizarSenha = (id, senhaCriptografada) => new Promise((resolve, reject) => {
    db.query('UPDATE usuarios SET senha = ? WHERE id = ?', [senhaCriptografada, id], (err) => {
        if (err) return reject(err);
        resolve();
    });
});
