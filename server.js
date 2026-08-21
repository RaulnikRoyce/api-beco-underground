require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const { carregarEnv } = require('./src/config/env');
const env = carregarEnv();
const app = require('./src/app');

app.listen(env.port, () => {
    console.log(JSON.stringify({
        nivel: 'info',
        mensagem: `API em http://localhost:${env.port}`,
        em: new Date().toISOString()
    }));
});
