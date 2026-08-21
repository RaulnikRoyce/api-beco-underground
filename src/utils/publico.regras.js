exports.montarPaginaBanda = (slot, palco) => {
    if (!slot) return null;

    return {
        evento: {
            nome: slot.evento_nome,
            data: slot.evento_data,
            local: slot.evento_local
        },
        voce: {
            nome: slot.nome,
            horario: slot.horario,
            cache: Number(slot.cache)
        },
        lineup: palco.map((item) => ({
            nome: item.nome,
            horario: item.horario,
            voce: Number(item.lineup_id) === Number(slot.lineup_id)
        }))
    };
};
