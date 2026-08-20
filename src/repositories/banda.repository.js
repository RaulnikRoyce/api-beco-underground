const db = require('../database/db');

exports.buscarTodas = async () => {
    const [resultados] = await db.promise().query(
        'SELECT id, nome, genero, contato, cache_base, criado_em FROM bandas ORDER BY nome ASC'
    );
    return resultados;
};

exports.buscarPorId = async (id) => {
    const [resultados] = await db.promise().query(
        'SELECT id, nome, genero, contato, cache_base, criado_em FROM bandas WHERE id = ?',
        [id]
    );
    return resultados[0] || null;
};

exports.salvar = async (dados) => {
    const { nome, genero, contato, cache_base } = dados;
    const [result] = await db.promise().query(
        'INSERT INTO bandas (nome, genero, contato, cache_base) VALUES (?, ?, ?, ?)',
        [nome, genero || null, contato || null, cache_base]
    );

    return {
        id: result.insertId,
        nome,
        genero: genero || null,
        contato: contato || null,
        cache_base
    };
};

exports.remover = async (id) => {
    const [result] = await db.promise().query('DELETE FROM bandas WHERE id = ?', [id]);
    return result.affectedRows > 0;
};
