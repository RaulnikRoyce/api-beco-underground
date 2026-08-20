const db = require('../database/db');

exports.buscarTodos = async () => {
    const [resultados] = await db.promise().query(
        'SELECT id, nome, data, local, criado_em FROM eventos ORDER BY data DESC, id DESC'
    );
    return resultados;
};

exports.buscarPorId = async (id) => {
    const [resultados] = await db.promise().query(
        'SELECT id, nome, data, local, criado_em FROM eventos WHERE id = ?',
        [id]
    );
    return resultados[0] || null;
};

exports.salvar = async ({ nome, data, local }) => {
    const [result] = await db.promise().query(
        'INSERT INTO eventos (nome, data, local) VALUES (?, ?, ?)',
        [nome, data, local]
    );

    return {
        id: result.insertId,
        nome,
        data,
        local
    };
};

exports.atualizar = async (id, { nome, data, local }) => {
    const [result] = await db.promise().query(
        'UPDATE eventos SET nome = ?, data = ?, local = ? WHERE id = ?',
        [nome, data, local, id]
    );

    if (result.affectedRows === 0) {
        return null;
    }

    return exports.buscarPorId(id);
};

exports.remover = async (id) => {
    const [result] = await db.promise().query('DELETE FROM eventos WHERE id = ?', [id]);
    return result.affectedRows > 0;
};
