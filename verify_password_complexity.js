const AccountService = require('./services/AccountService');
const EntityService = require('./services/EntityService');
const { entity, account, role } = require('./models');
const uuid = require('uuid');

async function verifyPasswordComplexity() {
    console.log("--- Starting Password Complexity Verification ---");
    const testId = '09' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const testEmail = `complexity_${testId}@test.com`;

    try {
        // 1. Create User
        console.log(`Creating user with ID: ${testId}`);
        const someRole = await role.findOne();
        await EntityService.create({
            nombres: 'Test',
            apellidos: 'Complexity',
            identificacion: testId,
            telefono: '0999999999',
            correo: testEmail,
            clave: testId,
            rol: someRole ? [someRole.external_id] : []
        });

        // 2. Login
        const login = await AccountService.login(testEmail, testId);
        if (!login || !login.info || !login.info.token) throw new Error("Login failed");
        console.log("Login successful.");

        // 3. Test Invalid Passwords
        const testCases = [
            { pass: testId, msg: "Same as current" }, // Same as current
            { pass: "short1A!", msg: "Too short" }, // < 9 chars (8 chars)
            { pass: "nolowercase123!", msg: "No uppercase" }, // No uppercase (wait regex requires uppercase)
            { pass: "NoNumber!", msg: "No number" }, // No number
            { pass: "NoSpecial1", msg: "No special char" } // No special
        ];

        for (const test of testCases) {
            try {
                // Determine expected failure
                // Case 1: Same as current
                if (test.msg === "Same as current") {
                    await AccountService.changePassword(testEmail, testId, test.pass);
                } else {
                    // Check complexity
                    await AccountService.changePassword(testEmail, testId, test.pass);
                }
                console.error(`FAILED: Should have rejected '${test.msg}' but accepted it.`);
            } catch (error) {
                console.log(`SUCCESS: Rejected '${test.msg}' with error: ${error.message}`);
                // Verify error message if strict
            }
        }

        // 4. Test Valid Password
        const validPass = "Valid123!Password";
        try {
            await AccountService.changePassword(testEmail, testId, validPass);
            console.log("SUCCESS: Accepted valid password.");
        } catch (error) {
            console.error(`FAILED: Rejected valid password: ${error.message}`);
        }

    } catch (error) {
        console.error("Verification Error:", error);
    } finally {
        // Cleanup if needed
        process.exit(0);
    }
}

verifyPasswordComplexity();
