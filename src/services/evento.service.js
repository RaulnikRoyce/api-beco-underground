const db = require('../database/db');

exports.buscarTodos = () => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM eventos', (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

exports.buscarPorId = (id) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM eventos WHERE id = ?', [id], (err, results) => {
            if (err) return reject(err);
            if (results.length === 0) return resolve(null);
            resolve(results[0]);
        });
    });
};

exports.criar = (dados) => {
    return new Promise((resolve, reject) => {
        const { nome, data, local } = dados;
        db.query('INSERT INTO eventos (nome, data, local) VALUES (?, ?, ?)', 
        [nome, data, local], (err, results) => {
            if (err) return reject(err);
            resolve({ id: results.insertId, ...dados });
        });
    });
};