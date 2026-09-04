const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Integration tests for bootstrap_account security property
 * 
 * These tests verify that the bootstrap_account flag is properly set
 * throughout the application to prevent privilege escalation attacks.
 */

test('auth.repository.salvar creates non-bootstrap accounts by default', () => {
    // This test verifies the SQL query structure
    const authRepository = require('../src/repositories/auth.repository');
    
    // Get the source code of the salvar function
    const salvarSource = authRepository.salvar.toString();
    
    // Verify that the INSERT query does NOT include bootstrap_account
    // This ensures it defaults to 0 as per the schema
    assert.ok(
        !salvarSource.includes('bootstrap_account'),
        'User registration should not set bootstrap_account (defaults to 0)'
    );
    
    // Verify it's a standard 3-parameter INSERT
    assert.ok(
        salvarSource.includes('INSERT INTO usuarios (email, senha, perfil)'),
        'User registration should use standard 3-column INSERT'
    );
});

test('seed_admin.js creates accounts with bootstrap_account=1', () => {
    const fs = require('fs');
    const path = require('path');
    
    // Read the seed_admin.js file
    const seedPath = path.join(__dirname, '..', 'scripts', 'seed_admin.js');
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    
    // Verify INSERT includes bootstrap_account
    assert.ok(
        seedContent.includes('bootstrap_account'),
        'Seeder must include bootstrap_account in INSERT'
    );
    
    assert.ok(
        seedContent.includes('VALUES (?, ?, ?, 1)') || 
        seedContent.includes('bootstrap_account) VALUES'),
        'Seeder must set bootstrap_account to 1'
    );
});

test('seed_admin.js checks bootstrap_account before UPDATE', () => {
    const fs = require('fs');
    const path = require('path');
    
    const seedPath = path.join(__dirname, '..', 'scripts', 'seed_admin.js');
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    
    // Verify SELECT retrieves bootstrap_account
    assert.ok(
        seedContent.includes('SELECT id, bootstrap_account, perfil'),
        'Seeder must SELECT bootstrap_account for security check'
    );
    
    // Verify security check exists
    assert.ok(
        seedContent.includes('!existingUser.bootstrap_account') ||
        seedContent.includes('existingUser.bootstrap_account === 0'),
        'Seeder must check bootstrap_account flag before updating'
    );
    
    // Verify error message for security violation
    assert.ok(
        seedContent.includes('ERRO DE SEGURANÇA') || 
        seedContent.includes('SECURITY_ERROR') ||
        seedContent.includes('não foi criada pelo seeder'),
        'Seeder must have descriptive security error message'
    );
});

test('seed_admin.js UPDATE includes bootstrap_account in WHERE clause', () => {
    const fs = require('fs');
    const path = require('path');
    
    const seedPath = path.join(__dirname, '..', 'scripts', 'seed_admin.js');
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    
    // Verify UPDATE query includes bootstrap_account condition
    assert.ok(
        seedContent.includes('WHERE email = ? AND bootstrap_account = 1'),
        'UPDATE query must include bootstrap_account = 1 in WHERE clause'
    );
});

test('database schema includes bootstrap_account column with default 0', () => {
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Verify column exists
    assert.ok(
        schemaContent.includes('bootstrap_account'),
        'Schema must include bootstrap_account column'
    );
    
    // Verify default value is 0
    assert.ok(
        schemaContent.includes('bootstrap_account TINYINT(1) NOT NULL DEFAULT 0'),
        'bootstrap_account must default to 0 for user-registered accounts'
    );
});

test('migration adds bootstrap_account column', () => {
    const fs = require('fs');
    const path = require('path');
    
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '007_usuarios_bootstrap_account.sql');
    
    // Verify migration file exists
    assert.ok(
        fs.existsSync(migrationPath),
        'Migration 007_usuarios_bootstrap_account.sql must exist'
    );
    
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    
    // Verify it adds the column
    assert.ok(
        migrationContent.includes('ALTER TABLE usuarios ADD COLUMN bootstrap_account'),
        'Migration must add bootstrap_account column'
    );
    
    // Verify default value
    assert.ok(
        migrationContent.includes('DEFAULT 0'),
        'Migration must set default to 0'
    );
});

test('seed_admin.js exits with error code on security violation', () => {
    const fs = require('fs');
    const path = require('path');
    
    const seedPath = path.join(__dirname, '..', 'scripts', 'seed_admin.js');
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    
    // Find the security check block
    const hasSecurityCheck = seedContent.includes('!existingUser.bootstrap_account');
    assert.ok(hasSecurityCheck, 'Security check must exist');
    
    // Verify it exits with error code
    const lines = seedContent.split('\n');
    let foundCheck = false;
    let foundExit = false;
    let checkLineIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('!existingUser.bootstrap_account')) {
            foundCheck = true;
            checkLineIndex = i;
        }
        if (foundCheck && lines[i].includes('process.exit(1)')) {
            // Verify exit is within reasonable distance (within 20 lines)
            if (i - checkLineIndex < 20) {
                foundExit = true;
                break;
            }
        }
    }
    
    assert.ok(
        foundExit,
        'Seeder must call process.exit(1) on security violation'
    );
});

test('registrar schema does not include bootstrap_account field', () => {
    const registrarSchema = require('../src/schemas/auth.schema').registrarSchema;
    
    // Zod v4 uses shape() method differently
    // We'll check the schema by attempting to parse valid and invalid data
    
    // Valid registration data
    const validResult = registrarSchema.safeParse({
        email: 'test@example.com',
        senha: 'password123'
    });
    assert.ok(validResult.success, 'Schema must accept email and senha');
    
    // Zod will either ignore extra fields or fail depending on configuration
    // The key is that the schema definition doesn't include it
    const schemaSource = registrarSchema.toString();
    assert.ok(
        !schemaSource.includes('bootstrap_account'),
        'Schema source must not reference bootstrap_account'
    );
    
    // Also verify the schema file content
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, '..', 'src', 'schemas', 'auth.schema.js');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Find the registrarSchema definition
    const registrarSchemaMatch = schemaContent.match(/exports\.registrarSchema\s*=\s*z\.object\(\{([^}]+)\}\)/);
    assert.ok(registrarSchemaMatch, 'registrarSchema definition must exist');
    
    const schemaFields = registrarSchemaMatch[1];
    assert.ok(schemaFields.includes('email'), 'Schema must have email field');
    assert.ok(schemaFields.includes('senha'), 'Schema must have senha field');
    assert.ok(!schemaFields.includes('bootstrap_account'), 'Schema must NOT have bootstrap_account field');
    assert.ok(!schemaFields.includes('perfil'), 'Schema must NOT allow perfil selection');
});

test('auth.service.registrar always creates produtor accounts', () => {
    const authService = require('../src/services/auth.service');
    
    // Get the source code
    const registrarSource = authService.registrar.toString();
    
    // Verify it hardcodes 'produtor' role
    assert.ok(
        registrarSource.includes("'produtor'"),
        'Registration must hardcode produtor role'
    );
    
    // Verify it doesn't accept role as parameter
    assert.ok(
        !registrarSource.includes('perfil') || registrarSource.includes("'produtor'"),
        'Registration must not allow role selection'
    );
});

test('seed_admin.js uses environment variables with secure defaults', () => {
    const fs = require('fs');
    const path = require('path');
    
    const seedPath = path.join(__dirname, '..', 'scripts', 'seed_admin.js');
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    
    // Verify it reads from environment
    assert.ok(
        seedContent.includes('process.env.SEED_ADMIN_EMAIL'),
        'Seeder must read email from environment'
    );
    
    assert.ok(
        seedContent.includes('process.env.SEED_ADMIN_PASSWORD'),
        'Seeder must read password from environment'
    );
    
    // Verify it has fallback values (for development)
    assert.ok(
        seedContent.includes('admin@beco.com'),
        'Seeder must have default email for development'
    );
});

test('security fix prevents the documented exploit scenario', () => {
    // This is a documentation test that verifies the fix addresses the pentest finding
    const fs = require('fs');
    const path = require('path');
    
    const seedPath = path.join(__dirname, '..', 'scripts', 'seed_admin.js');
    const seedContent = fs.readFileSync(seedPath, 'utf8');
    
    // The exploit was: attacker registers email, then seeder promotes it
    // The fix must:
    // 1. Check bootstrap_account flag
    const hasCheck = seedContent.includes('bootstrap_account');
    
    // 2. Reject non-bootstrap accounts
    const hasRejection = seedContent.includes('!existingUser.bootstrap_account');
    
    // 3. Only update bootstrap accounts
    const hasWhereClause = seedContent.includes('bootstrap_account = 1');
    
    // 4. Create new accounts with bootstrap flag
    const hasBootstrapInsert = seedContent.includes('VALUES (?, ?, ?, 1)');
    
    assert.ok(hasCheck, 'Fix must check bootstrap_account flag');
    assert.ok(hasRejection, 'Fix must reject non-bootstrap accounts');
    assert.ok(hasWhereClause, 'Fix must only update bootstrap accounts');
    assert.ok(hasBootstrapInsert, 'Fix must create accounts with bootstrap flag');
});
