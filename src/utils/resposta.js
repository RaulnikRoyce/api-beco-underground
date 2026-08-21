const ok = (res, dados, status = 200) => res.status(status).json(dados);

const criado = (res, mensagem, extra = {}) =>
    res.status(201).json({ mensagem, ...extra });

const mensagem = (res, texto) => res.json({ mensagem: texto });

module.exports = { ok, criado, mensagem };
