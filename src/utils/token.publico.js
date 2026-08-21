const crypto = require('crypto');

exports.gerarTokenPublico = () => crypto.randomBytes(16).toString('hex');

exports.ehTokenPublico = (token) => /^[a-f0-9]{32}$/.test(String(token || ''));
