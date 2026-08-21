const minutosPalco = (horario) => {
    if (!horario) return Number.POSITIVE_INFINITY;
    const hhmm = String(horario).match(/^(\d{1,2}):(\d{2})/);
    if (!hhmm) return Number.POSITIVE_INFINITY;
    const hora = Number(hhmm[1]);
    const minuto = Number(hhmm[2]);
    return (hora < 12 ? hora + 24 : hora) * 60 + minuto;
};

exports.montarPaginaBanda = (slot, palco) => {
    if (!slot) return null;

    const ordenado = [...palco].sort((a, b) => minutosPalco(a.horario) - minutosPalco(b.horario));

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
        lineup: ordenado.map((item) => ({
            nome: item.nome,
            horario: item.horario,
            voce: Number(item.lineup_id) === Number(slot.lineup_id)
        }))
    };
};
