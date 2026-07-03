// src/repositories/banda.repository.js
const db = require('../database/db');

exports.buscarTodas = () => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM bandas', (err, resultados) => {
            if (err) return reject(err);
            resolve(resultados);
        });
    });
};

// --- A PEÇA QUE FALTAVA ---
exports.buscarPorId = (id) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM bandas WHERE id = ?', [id], (err, resultados) => {
            if (err) return reject(err);
            resolve(resultados[0]); // Retorna apenas a banda específica
        });
    });
};

exports.salvar = (dados) => {
    return new Promise((resolve, reject) => {
        const { nome, genero, contato, cache_base } = dados;
        db.query('INSERT INTO bandas (nome, genero, contato, cache_base) VALUES (?, ?, ?, ?)', 
        [nome, genero, contato, cache_base], (err, result) => {
            if (err) return reject(err);
            resolve({ id: result.insertId, ...dados });
        });
    });
};