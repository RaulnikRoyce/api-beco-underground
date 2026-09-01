if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
    require('dotenv').config({ path: '.env.local', override: true });
}

const { carregarEnv } = require('./src/config/env');
const { migrar } = require('./src/database/migrate');

let env;
try {
    env = carregarEnv();
} catch (erro) {
    console.error(JSON.stringify({
        nivel: 'error',
        mensagem: erro.message,
        em: new Date().toISOString()
    }));
    process.exit(1);
}

const app = require('./src/app');

async function iniciar() {
    if (env.nodeEnv === 'production') {
        try {
            await migrar({
                log: (mensagem) => console.log(JSON.stringify({
                    nivel: 'info',
                    mensagem: `Migração: ${mensagem}`,
                    em: new Date().toISOString()
                }))
            });
        } catch (erro) {
            console.error(JSON.stringify({
                nivel: 'error',
                mensagem: 'Falha na migração do banco',
                detalhe: erro.message,
                em: new Date().toISOString()
            }));
            process.exit(1);
        }
    }

    app.listen(env.port, '0.0.0.0', () => {
        console.log(JSON.stringify({
            nivel: 'info',
            mensagem: `API em 0.0.0.0:${env.port}`,
            em: new Date().toISOString()
        }));
    });
}

iniciar();
