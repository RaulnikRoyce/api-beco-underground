// src/repositories/evento.repository.js
const db = require('../database/db');

exports.buscarTodos = () => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM eventos', (err, resultados) => {
            if (err) return reject(err);
            resolve(resultados);
        });
    });
};

exports.buscarPorId = (id) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM eventos WHERE id = ?', [id], (err, resultados) => {
            if (err) return reject(err);
            resolve(resultados[0]); // Retorna apenas o evento específico
        });
    });
};