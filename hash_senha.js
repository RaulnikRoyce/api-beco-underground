const bcrypt = require('bcryptjs');

const senha = 'sua_senha_secreta'; // Troque pela senha do Admin
const saltRounds = 10;

bcrypt.hash(senha, saltRounds, (err, hash) => {
    if (err) throw err;
    console.log('Use este HASH para inserir no banco:');
    console.log(hash);
});