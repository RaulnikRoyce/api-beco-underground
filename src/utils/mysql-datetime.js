const pad = (valor) => String(valor).padStart(2, '0');

const formatarPartes = ({ ano, mes, dia, hora, minuto, segundo }) =>
    `${ano}-${pad(mes)}-${pad(dia)} ${pad(hora)}:${pad(minuto)}:${pad(segundo)}`;

exports.paraMysqlDatetime = (valor) => {
    if (valor == null || valor === '') return null;

    if (valor instanceof Date) {
        if (Number.isNaN(valor.getTime())) return null;
        return formatarPartes({
            ano: valor.getUTCFullYear(),
            mes: valor.getUTCMonth() + 1,
            dia: valor.getUTCDate(),
            hora: valor.getUTCHours(),
            minuto: valor.getUTCMinutes(),
            segundo: valor.getUTCSeconds()
        });
    }

    const texto = String(valor).trim();
    const local = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (local && !/[zZ]$/.test(texto) && !/[+-]\d{2}:\d{2}$/.test(texto)) {
        return formatarPartes({
            ano: Number(local[1]),
            mes: Number(local[2]),
            dia: Number(local[3]),
            hora: Number(local[4]),
            minuto: Number(local[5]),
            segundo: Number(local[6] || 0)
        });
    }

    const data = new Date(texto);
    if (Number.isNaN(data.getTime())) return null;

    return formatarPartes({
        ano: data.getUTCFullYear(),
        mes: data.getUTCMonth() + 1,
        dia: data.getUTCDate(),
        hora: data.getUTCHours(),
        minuto: data.getUTCMinutes(),
        segundo: data.getUTCSeconds()
    });
};
