const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 10;

const tentativas = new Map();

const normalizar = (email) => String(email || '').trim().toLowerCase();

function registroAtual(chave) {
    const registro = tentativas.get(chave);
    if (!registro) return null;
    if (Date.now() > registro.resetAt) {
        tentativas.delete(chave);
        return null;
    }
    return registro;
}

exports.bloqueado = (email) => {
    const registro = registroAtual(normalizar(email));
    return Boolean(registro && registro.count >= MAX_TENTATIVAS);
};

exports.registrarFalha = (email) => {
    const chave = normalizar(email);
    const registro = registroAtual(chave);
    if (!registro) {
        tentativas.set(chave, { count: 1, resetAt: Date.now() + JANELA_MS });
        return;
    }
    registro.count += 1;
};

exports.limparTentativas = (email) => {
    tentativas.delete(normalizar(email));
};

exports.MAX_TENTATIVAS = MAX_TENTATIVAS;
