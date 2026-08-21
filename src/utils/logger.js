const log = (nivel, mensagem, extra = {}) => {
    const entrada = {
        nivel,
        mensagem,
        em: new Date().toISOString(),
        ...extra
    };

    const linha = JSON.stringify(entrada);
    if (nivel === 'error') {
        console.error(linha);
        return;
    }
    console.log(linha);
};

module.exports = {
    info: (mensagem, extra) => log('info', mensagem, extra),
    warn: (mensagem, extra) => log('warn', mensagem, extra),
    error: (mensagem, extra) => log('error', mensagem, extra)
};
