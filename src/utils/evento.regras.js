exports.podeExcluirEvento = (evento, usuario) => {
    if (!evento || !usuario) return false;
    return usuario.perfil === 'admin' || Number(evento.criado_por) === Number(usuario.id);
};

exports.podeEditarEvento = exports.podeExcluirEvento;

exports.agruparLineups = (eventos, itens) => {
    const mapa = {};
    eventos.forEach((evento) => {
        mapa[evento.id] = [];
    });
    itens.forEach((item) => {
        if (!mapa[item.evento_id]) mapa[item.evento_id] = [];
        mapa[item.evento_id].push(item);
    });
    return eventos.map((evento) => ({
        ...evento,
        lineup: mapa[evento.id] || []
    }));
};
