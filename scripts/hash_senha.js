const bcrypt = require('bcryptjs');

const senha = process.argv[2];

if (!senha) {
    console.error('Uso: node scripts/hash_senha.js <senha>');
    process.exit(1);
}

bcrypt.hash(senha, 10, (err, hash) => {
    if (err) throw err;
    console.log(hash);
});
