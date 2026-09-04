const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('path');

/**
 * Security tests for seed_admin.js
 * 
 * These tests verify that the vulnerability "Admin seed provisions a predictable 
 * privileged account when seed secrets are missing" has been properly mitigated.
 * 
 * The fix ensures that the seeder FAILS CLOSED (exits with error) when required
 * credentials are not explicitly provided, preventing the use of deterministic
 * fallback values that could create a predictable admin account.
 */

/**
 * Helper function to run seed_admin.js with specific environment variables
 * and capture its exit code and output
 */
function runSeedAdmin(env = {}) {
    return new Promise((resolve) => {
        const seedScript = path.join(__dirname, '..', 'scripts', 'seed_admin.js');
        
        // Merge with minimal required env vars (excluding SEED_ADMIN_* intentionally)
        const testEnv = {
            NODE_ENV: 'test',
            DB_HOST: 'localhost',
            DB_NAME: 'test_db',
            DB_USER: 'test',
            DB_PASSWORD: 'test',
            JWT_SECRET: 'test-secret',
            ...env
        };

        const child = spawn(process.execPath, [seedScript], {
            env: testEnv,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({ code, stdout, stderr });
        });

        // Timeout after 5 seconds to prevent hanging
        setTimeout(() => {
            child.kill();
            resolve({ code: -1, stdout, stderr: stderr + '\nTest timeout' });
        }, 5000);
    });
}

test('rejeita execução quando SEED_ADMIN_EMAIL está ausente', async () => {
    const result = await runSeedAdmin({
        // SEED_ADMIN_EMAIL is intentionally not set
        SEED_ADMIN_PASSWORD: 'secure-password-123'
    });

    // Should exit with error code 1
    assert.equal(result.code, 1, 'Script should exit with code 1 when SEED_ADMIN_EMAIL is missing');
    
    // Should output error message about missing email
    assert.match(
        result.stderr,
        /SEED_ADMIN_EMAIL deve ser definido/i,
        'Should display error message about missing SEED_ADMIN_EMAIL'
    );
});

test('rejeita execução quando SEED_ADMIN_EMAIL está vazio', async () => {
    const result = await runSeedAdmin({
        SEED_ADMIN_EMAIL: '',
        SEED_ADMIN_PASSWORD: 'secure-password-123'
    });

    // Should exit with error code 1
    assert.equal(result.code, 1, 'Script should exit with code 1 when SEED_ADMIN_EMAIL is empty');
    
    // Should output error message about missing email
    assert.match(
        result.stderr,
        /SEED_ADMIN_EMAIL deve ser definido/i,
        'Should display error message when SEED_ADMIN_EMAIL is empty'
    );
});

test('rejeita execução quando SEED_ADMIN_EMAIL contém apenas espaços', async () => {
    const result = await runSeedAdmin({
        SEED_ADMIN_EMAIL: '   ',
        SEED_ADMIN_PASSWORD: 'secure-password-123'
    });

    // Should exit with error code 1
    assert.equal(result.code, 1, 'Script should exit with code 1 when SEED_ADMIN_EMAIL is whitespace');
    
    // Should output error message about missing email
    assert.match(
        result.stderr,
        /SEED_ADMIN_EMAIL deve ser definido/i,
        'Should display error message when SEED_ADMIN_EMAIL is whitespace'
    );
});

test('rejeita execução quando SEED_ADMIN_PASSWORD está ausente', async () => {
    const result = await runSeedAdmin({
        SEED_ADMIN_EMAIL: 'admin@example.com'
        // SEED_ADMIN_PASSWORD is intentionally not set
    });

    // Should exit with error code 1
    assert.equal(result.code, 1, 'Script should exit with code 1 when SEED_ADMIN_PASSWORD is missing');
    
    // Should output error message about missing password
    assert.match(
        result.stderr,
        /SEED_ADMIN_PASSWORD deve ser definido/i,
        'Should display error message about missing SEED_ADMIN_PASSWORD'
    );
});

test('rejeita execução quando SEED_ADMIN_PASSWORD está vazio', async () => {
    const result = await runSeedAdmin({
        SEED_ADMIN_EMAIL: 'admin@example.com',
        SEED_ADMIN_PASSWORD: ''
    });

    // Should exit with error code 1
    assert.equal(result.code, 1, 'Script should exit with code 1 when SEED_ADMIN_PASSWORD is empty');
    
    // Should output error message about missing password
    assert.match(
        result.stderr,
        /SEED_ADMIN_PASSWORD deve ser definido/i,
        'Should display error message when SEED_ADMIN_PASSWORD is empty'
    );
});

test('rejeita execução quando SEED_ADMIN_PASSWORD contém apenas espaços', async () => {
    const result = await runSeedAdmin({
        SEED_ADMIN_EMAIL: 'admin@example.com',
        SEED_ADMIN_PASSWORD: '   '
    });

    // Should exit with error code 1
    assert.equal(result.code, 1, 'Script should exit with code 1 when SEED_ADMIN_PASSWORD is whitespace');
    
    // Should output error message about missing password
    assert.match(
        result.stderr,
        /SEED_ADMIN_PASSWORD deve ser definido/i,
        'Should display error message when SEED_ADMIN_PASSWORD is whitespace'
    );
});

test('rejeita execução quando ambas as credenciais estão ausentes', async () => {
    const result = await runSeedAdmin({
        // Both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are intentionally not set
    });

    // Should exit with error code 1
    assert.equal(result.code, 1, 'Script should exit with code 1 when both credentials are missing');
    
    // Should output error message (at least about the first missing credential)
    assert.match(
        result.stderr,
        /SEED_ADMIN_EMAIL deve ser definido/i,
        'Should display error message about missing credentials'
    );
});

test('não usa valores de fallback determinísticos', async () => {
    // This test verifies that the old predictable fallback values are not used
    const result = await runSeedAdmin({
        // Intentionally not providing credentials
    });

    // Should fail closed (exit with error)
    assert.equal(result.code, 1, 'Script must fail when credentials are not provided');
    
    // Should NOT proceed to database operations
    const combinedOutput = result.stdout + result.stderr;
    assert.doesNotMatch(
        combinedOutput,
        /admin@beco\.com/i,
        'Should not use old fallback email admin@beco.com'
    );
    assert.doesNotMatch(
        combinedOutput,
        /Admin criado|Admin atualizado/i,
        'Should not create or update admin when credentials are missing'
    );
});

test('valida que o script requer credenciais explícitas antes de qualquer operação de banco', async () => {
    // This test ensures validation happens BEFORE any database connection/query
    const result = await runSeedAdmin({
        // Not providing credentials
        DB_HOST: 'invalid-host-that-would-fail-connection'
    });

    // Should fail at validation stage (exit code 1), not at DB connection stage
    assert.equal(result.code, 1, 'Should fail at validation, not at DB connection');
    
    // Error should be about missing credentials, not DB connection
    assert.match(
        result.stderr,
        /SEED_ADMIN_(EMAIL|PASSWORD) deve ser definido/i,
        'Error should be about missing credentials'
    );
    assert.doesNotMatch(
        result.stderr,
        /Erro ao (consultar|criar|atualizar)/i,
        'Should not reach database operations'
    );
});

test('valida que credenciais vazias não passam pela validação mesmo com trim', async () => {
    // Test various whitespace-only inputs to ensure trim() is working correctly
    const testCases = [
        { email: ' ', password: 'valid-pass' },
        { email: '\t', password: 'valid-pass' },
        { email: '\n', password: 'valid-pass' },
        { email: 'valid@email.com', password: ' ' },
        { email: 'valid@email.com', password: '\t' },
        { email: 'valid@email.com', password: '\n' }
    ];

    for (const testCase of testCases) {
        const result = await runSeedAdmin({
            SEED_ADMIN_EMAIL: testCase.email,
            SEED_ADMIN_PASSWORD: testCase.password
        });

        assert.equal(
            result.code,
            1,
            `Should reject whitespace-only input: email="${testCase.email}", password="${testCase.password}"`
        );
    }
});

test('confirma que o script falha antes de usar bcrypt quando credenciais estão ausentes', async () => {
    // This ensures the validation happens before expensive bcrypt operations
    const result = await runSeedAdmin({
        // Not providing credentials
    });

    // Should fail immediately at validation
    assert.equal(result.code, 1, 'Should fail at validation stage');
    
    // Should not reach bcrypt hashing or database operations
    const combinedOutput = result.stdout + result.stderr;
    assert.doesNotMatch(
        combinedOutput,
        /Seed em/i,
        'Should not reach the seed() function execution'
    );
});
