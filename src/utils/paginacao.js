const parsePaginacao = (query) => {
    const pagina = Math.max(1, Number(query.page) || 1);
    const limite = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const offset = (pagina - 1) * limite;
    return { pagina, limite, offset };
};

const envelope = (dados, pagina, limite, total) => ({
    dados,
    meta: {
        pagina,
        limite,
        total,
        paginas: Math.ceil(total / limite) || 1
    }
});

module.exports = { parsePaginacao, envelope };
