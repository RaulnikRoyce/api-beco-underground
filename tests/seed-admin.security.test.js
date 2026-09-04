const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

/**
 * Security tests for bootstrap seeder privilege escalation mitigation
 * 
 * Pentest finding: Bootstrap seeder can promote an attacker-claimed email account
 * 
 * These tests verify that the seeder script properly distinguishes between
 * operator-created bootstrap accounts and user-registered accounts, preventing
 * privilege escalation attacks where an attacker pre-registers the admin email.
 */

// Mock database for testing seeder logic
class MockDatabase {
    constructor() {
        this.users = [];
        this.queryLog = [];
    }

    query(sql, params, callback) {
        this.queryLog.push({ sql, params });

        // Handle SELECT queries
        if (sql.includes('SELECT')) {
            const email = params[0];
            const user = this.users.find(u => u.email === email);
            callback(null, user ? [user] : []);
            return;
        }

        // Handle UPDATE queries
        if (sql.includes('UPDATE')) {
            const [hash, perfil, email] = params;
            const user = this.users.find(u => u.email === email);
            
            // Simulate the WHERE clause with bootstrap_account check
            if (user && sql.includes('bootstrap_account = 1')) {
                if (user.bootstrap_account === 1) {
                    user.senha = hash;
                    user.perfil = perfil;
                    callback(null, { affectedRows: 1 });
                } else {
                    callback(null, { affectedRows: 0 });
                }
            } else if (user && !sql.includes('bootstrap_account')) {
                // Old vulnerable version without bootstrap_account check
                user.senha = hash;
                user.perfil = perfil;
                callback(null, { affectedRows: 1 });
            } else {
                callback(null, { affectedRows: 0 });
            }
            return;
        }

        // Handle INSERT queries
        if (sql.includes('INSERT')) {
            const isBootstrap = sql.includes('bootstrap_account');
            let user;
            
            if (isBootstrap) {
                const [email, hash, perfil] = params;
                user = {
                    id: this.users.length + 1,
                    email,
                    senha: hash,
                    perfil,
                    bootstrap_account: 1,
                    ativo: 1
                };
            } else {
                const [email, hash, perfil] = params;
                user = {
                    id: this.users.length + 1,
                    email,
                    senha: hash,
                    perfil,
                    bootstrap_account: 0,
                    ativo: 1
                };
            }
            
            this.users.push(user);
            callback(null, { insertId: user.id });
            return;
        }

        callback(new Error('Unsupported query'));
    }

    addUser(user) {
        this.users.push({
            id: this.users.length + 1,
            bootstrap_account: 0,
            ativo: 1,
            ...user
        });
    }

    reset() {
        this.users = [];
        this.queryLog = [];
    }
}

// Simulate the fixed seeder logic
async function seedAdminFixed(db, email, senha, perfil = 'admin') {
    const hash = await bcrypt.hash(senha, 10);
    
    return new Promise((resolve, reject) => {
        db.query('SELECT id, bootstrap_account, perfil FROM usuarios WHERE email = ?', [email], (err, rows) => {
            if (err) return reject(err);

            if (rows.length > 0) {
                const existingUser = rows[0];
                
                // Security: Only update accounts that were originally created by the seeder
                // This prevents privilege escalation of attacker-registered accounts
                if (!existingUser.bootstrap_account) {
                    return reject(new Error('SECURITY_ERROR: Account exists but was not created by seeder'));
                }

                db.query(
                    'UPDATE usuarios SET senha = ?, perfil = ? WHERE email = ? AND bootstrap_account = 1',
                    [hash, perfil, email],
                    (updateErr) => {
                        if (updateErr) return reject(updateErr);
                        resolve({ action: 'updated', email });
                    }
                );
                return;
            }

            db.query(
                'INSERT INTO usuarios (email, senha, perfil, bootstrap_account) VALUES (?, ?, ?, 1)',
                [email, hash, perfil],
                (insertErr) => {
                    if (insertErr) return reject(insertErr);
                    resolve({ action: 'created', email });
                }
            );
        });
    });
}

// Simulate the vulnerable seeder logic (for comparison)
async function seedAdminVulnerable(db, email, senha, perfil = 'admin') {
    const hash = await bcrypt.hash(senha, 10);
    
    return new Promise((resolve, reject) => {
        db.query('SELECT id FROM usuarios WHERE email = ?', [email], (err, rows) => {
            if (err) return reject(err);

            if (rows.length > 0) {
                // VULNERABLE: No check for bootstrap_account flag
                db.query(
                    'UPDATE usuarios SET senha = ?, perfil = ? WHERE email = ?',
                    [hash, perfil, email],
                    (updateErr) => {
                        if (updateErr) return reject(updateErr);
                        resolve({ action: 'updated', email });
                    }
                );
                return;
            }

            db.query(
                'INSERT INTO usuarios (email, senha, perfil) VALUES (?, ?, ?)',
                [email, hash, perfil],
                (insertErr) => {
                    if (insertErr) return reject(insertErr);
                    resolve({ action: 'created', email });
                }
            );
        });
    });
}

// Simulate user registration (always creates non-bootstrap accounts)
async function registerUser(db, email, senha, perfil = 'produtor') {
    const hash = await bcrypt.hash(senha, 10);
    
    return new Promise((resolve, reject) => {
        db.query(
            'INSERT INTO usuarios (email, senha, perfil) VALUES (?, ?, ?)',
            [email, hash, perfil],
            (err, result) => {
                if (err) return reject(err);
                resolve({ id: result.insertId, email, perfil });
            }
        );
    });
}

test('seeder creates new bootstrap admin account with bootstrap_account=1', async () => {
    const db = new MockDatabase();
    const result = await seedAdminFixed(db, 'admin@beco.com', 'securepass123');
    
    assert.equal(result.action, 'created');
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].email, 'admin@beco.com');
    assert.equal(db.users[0].perfil, 'admin');
    assert.equal(db.users[0].bootstrap_account, 1);
});

test('seeder updates existing bootstrap account successfully', async () => {
    const db = new MockDatabase();
    
    // First seed creates the account
    await seedAdminFixed(db, 'admin@beco.com', 'password1');
    const originalHash = db.users[0].senha;
    
    // Second seed updates the password
    const result = await seedAdminFixed(db, 'admin@beco.com', 'newpassword2');
    
    assert.equal(result.action, 'updated');
    assert.equal(db.users.length, 1);
    assert.notEqual(db.users[0].senha, originalHash);
    assert.equal(db.users[0].bootstrap_account, 1);
});

test('seeder REJECTS promotion of user-registered account (exploit prevention)', async () => {
    const db = new MockDatabase();
    
    // Attacker pre-registers the admin email as a normal user
    await registerUser(db, 'admin@beco.com', 'attackerpass', 'produtor');
    
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].perfil, 'produtor');
    assert.equal(db.users[0].bootstrap_account, 0);
    
    // Operator attempts to seed admin - should be rejected
    await assert.rejects(
        async () => {
            await seedAdminFixed(db, 'admin@beco.com', 'adminpass');
        },
        {
            message: 'SECURITY_ERROR: Account exists but was not created by seeder'
        }
    );
    
    // Verify the account was NOT promoted to admin
    assert.equal(db.users[0].perfil, 'produtor');
    assert.equal(db.users[0].bootstrap_account, 0);
});

test('user registration creates accounts with bootstrap_account=0', async () => {
    const db = new MockDatabase();
    
    await registerUser(db, 'user@example.com', 'userpass', 'produtor');
    
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].email, 'user@example.com');
    assert.equal(db.users[0].perfil, 'produtor');
    assert.equal(db.users[0].bootstrap_account, 0);
});

test('UPDATE query includes bootstrap_account=1 condition in WHERE clause', async () => {
    const db = new MockDatabase();
    
    // Create a bootstrap account
    await seedAdminFixed(db, 'admin@beco.com', 'pass1');
    
    // Update it
    await seedAdminFixed(db, 'admin@beco.com', 'pass2');
    
    // Check that the UPDATE query includes the security condition
    const updateQuery = db.queryLog.find(q => q.sql.includes('UPDATE'));
    assert.ok(updateQuery, 'UPDATE query should exist');
    assert.ok(
        updateQuery.sql.includes('bootstrap_account = 1'),
        'UPDATE query must include bootstrap_account = 1 in WHERE clause'
    );
});

test('SELECT query retrieves bootstrap_account flag for security check', async () => {
    const db = new MockDatabase();
    
    // Pre-register an account
    await registerUser(db, 'admin@beco.com', 'pass');
    
    // Attempt to seed (will fail)
    try {
        await seedAdminFixed(db, 'admin@beco.com', 'adminpass');
    } catch (e) {
        // Expected to fail
    }
    
    // Verify SELECT query includes bootstrap_account
    const selectQuery = db.queryLog.find(q => q.sql.includes('SELECT'));
    assert.ok(selectQuery, 'SELECT query should exist');
    assert.ok(
        selectQuery.sql.includes('bootstrap_account'),
        'SELECT query must retrieve bootstrap_account flag'
    );
});

test('vulnerable seeder ALLOWS privilege escalation (demonstrates the exploit)', async () => {
    const db = new MockDatabase();
    
    // Attacker pre-registers the admin email
    await registerUser(db, 'admin@beco.com', 'attackerpass', 'produtor');
    
    assert.equal(db.users[0].perfil, 'produtor');
    assert.equal(db.users[0].bootstrap_account, 0);
    
    // Vulnerable seeder promotes the account (THIS IS THE VULNERABILITY)
    const result = await seedAdminVulnerable(db, 'admin@beco.com', 'adminpass');
    
    assert.equal(result.action, 'updated');
    // VULNERABILITY: Account was promoted to admin despite being user-registered
    assert.equal(db.users[0].perfil, 'admin');
    assert.equal(db.users[0].bootstrap_account, 0); // Still marked as non-bootstrap
});

test('fixed seeder prevents the same exploit that vulnerable version allows', async () => {
    const dbVulnerable = new MockDatabase();
    const dbFixed = new MockDatabase();
    
    // Setup: Attacker pre-registers in both scenarios
    await registerUser(dbVulnerable, 'admin@beco.com', 'attackerpass', 'produtor');
    await registerUser(dbFixed, 'admin@beco.com', 'attackerpass', 'produtor');
    
    // Vulnerable version: Exploit succeeds
    await seedAdminVulnerable(dbVulnerable, 'admin@beco.com', 'adminpass');
    assert.equal(dbVulnerable.users[0].perfil, 'admin'); // EXPLOITED
    
    // Fixed version: Exploit is blocked
    await assert.rejects(
        async () => {
            await seedAdminFixed(dbFixed, 'admin@beco.com', 'adminpass');
        },
        {
            message: 'SECURITY_ERROR: Account exists but was not created by seeder'
        }
    );
    assert.equal(dbFixed.users[0].perfil, 'produtor'); // NOT EXPLOITED
});

test('multiple bootstrap accounts can coexist (different emails)', async () => {
    const db = new MockDatabase();
    
    await seedAdminFixed(db, 'admin1@beco.com', 'pass1');
    await seedAdminFixed(db, 'admin2@beco.com', 'pass2');
    
    assert.equal(db.users.length, 2);
    assert.equal(db.users[0].bootstrap_account, 1);
    assert.equal(db.users[1].bootstrap_account, 1);
    assert.equal(db.users[0].perfil, 'admin');
    assert.equal(db.users[1].perfil, 'admin');
});

test('bootstrap account can be updated multiple times (reseed scenario)', async () => {
    const db = new MockDatabase();
    
    await seedAdminFixed(db, 'admin@beco.com', 'pass1');
    const hash1 = db.users[0].senha;
    
    await seedAdminFixed(db, 'admin@beco.com', 'pass2');
    const hash2 = db.users[0].senha;
    
    await seedAdminFixed(db, 'admin@beco.com', 'pass3');
    const hash3 = db.users[0].senha;
    
    assert.equal(db.users.length, 1);
    assert.notEqual(hash1, hash2);
    assert.notEqual(hash2, hash3);
    assert.equal(db.users[0].bootstrap_account, 1);
});

test('seeder INSERT includes bootstrap_account column', async () => {
    const db = new MockDatabase();
    
    await seedAdminFixed(db, 'admin@beco.com', 'pass');
    
    const insertQuery = db.queryLog.find(q => q.sql.includes('INSERT'));
    assert.ok(insertQuery, 'INSERT query should exist');
    assert.ok(
        insertQuery.sql.includes('bootstrap_account'),
        'INSERT query must include bootstrap_account column'
    );
});

test('security error message is descriptive and actionable', async () => {
    const db = new MockDatabase();
    
    await registerUser(db, 'admin@beco.com', 'userpass', 'produtor');
    
    try {
        await seedAdminFixed(db, 'admin@beco.com', 'adminpass');
        assert.fail('Should have thrown security error');
    } catch (error) {
        assert.ok(error.message.includes('SECURITY_ERROR'));
        assert.ok(error.message.includes('not created by seeder'));
    }
});

test('bootstrap_account flag is immutable after creation', async () => {
    const db = new MockDatabase();
    
    // Create user-registered account
    await registerUser(db, 'user@beco.com', 'pass', 'produtor');
    assert.equal(db.users[0].bootstrap_account, 0);
    
    // Create bootstrap account
    await seedAdminFixed(db, 'admin@beco.com', 'pass');
    assert.equal(db.users[1].bootstrap_account, 1);
    
    // Update bootstrap account - flag should remain 1
    await seedAdminFixed(db, 'admin@beco.com', 'newpass');
    assert.equal(db.users[1].bootstrap_account, 1);
    
    // Verify user account flag is still 0
    assert.equal(db.users[0].bootstrap_account, 0);
});
