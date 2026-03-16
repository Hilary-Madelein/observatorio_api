const EntityService = require('./services/EntityService');
const AccountService = require('./services/AccountService');
const { entity, account, role } = require('./models');
const uuid = require('uuid');

async function verifyIdAuth() {
    const testId = '09' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'); // Random valid-ish ID
    console.log("Testing with ID:", testId);
    const testEmail = `test_${Date.now()}@test.com`;
    const testData = {
        nombres: 'Test',
        apellidos: 'User',
        identificacion: testId,
        telefono: '0999999999',
        correo: testEmail,
        clave: testId, // Password same as ID
        rol: [] // Assuming empty roles or valid UUIDs. Let's fetch a role if needed.
    };

    console.log("--- Starting Verification---");

    try {
        // Ensure DB is verified/synced
        console.log("Syncing Entity model...");
        await entity.sync({ alter: true });
        console.log("Entity model synced.");

        // 1. Fetch a valid role ID for creation
        const someRole = await role.findOne();
        if (someRole) {
            testData.rol = [someRole.external_id];
        } else {
            console.log("No roles found, might fail if role is required");
        }

        console.log(`1. Creating User with Identification: ${testId} and Password: ${testId}`);
        // Mocking file upload if needed, Service might expect simple object if modified
        // EntityService.create usually takes (data, transaction)
        // Controller passes data from req.body.
        // Let's call EntityService.create directly. 
        // Note: EntityService.create signature is: async create(data) based on previous context or assumption. 
        // Actually, looking at previous changes, `const entityData = { ... identification: data.identificacion ... }` in create method.

        await EntityService.create(testData);
        console.log("User created successfully.");

        // 2. Verify Data in DB
        const createdEntity = await entity.findOne({ where: { identification: testId } });
        if (!createdEntity) {
            throw new Error("Entity not found in DB with that identification.");
        }
        console.log(`2. Verified Entity exists in DB with identification: ${createdEntity.identification}`);

        // 3. Try checking password via AccountService (Login)
        console.log(`3. Attempting Login with Email: ${testEmail} and Password: ${testId}`);
        // AccountService.login(email, password)
        // AccountService.login returns { msg, info: { token, user: ... }, code }
        const loginResult = await AccountService.login(testEmail, testId);

        if (loginResult && loginResult.info && loginResult.info.token) {
            console.log("Login Successful!");
            console.log(`User must change password? ${loginResult.info.user.mustChangePassword}`);
        } else {
            console.log("Login Result:", JSON.stringify(loginResult, null, 2));
            throw new Error("Login failed.");
        }

        console.log("--- Verification SUCCESS ---");

    } catch (error) {
        console.error("--- Verification FAILED ---");
        console.error(error);
        if (error.info) console.error(error.info);
    } finally {
        // Cleanup
        // await entity.destroy({ where: { identification: testId }, force: true }); // Optional: Clean up
        process.exit(0);
    }
}

// Need to initialize Sequelize connection? 
// Usually models require connection. models/index.js handles it.
verifyIdAuth();
