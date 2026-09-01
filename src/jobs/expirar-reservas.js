require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local'), override: true });

const pedidoService = require('../src/services/pedido.service');

pedidoService.expirarReservas()
    .then((resultado) => {
        console.log(JSON.stringify({ job: 'expirar-reservas', ...resultado, em: new Date().toISOString() }));
        process.exit(0);
    })
    .catch((err) => {
        console.error('Erro ao expirar reservas:', err.message);
        process.exit(1);
    });
