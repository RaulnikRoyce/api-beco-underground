const db = require('../database/db');

exports.buscarTodas = () => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM bandas', (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

exports.criar = (dados) => {
    return new Promise((resolve, reject) => {
        const { nome, genero, contato, cache_base } = dados;
        db.query('INSERT INTO bandas (nome, genero, contato, cache_base) VALUES (?, ?, ?, ?)', 
        [nome, genero, contato, cache_base], (err, results) => {
            if (err) return reject(err);
            resolve({ id: results.insertId, ...dados });
        });
    });
};