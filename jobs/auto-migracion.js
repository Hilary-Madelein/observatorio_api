const path = require('path');
require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

const MigracionController = require('../controllers/MigracionController');

(async () => {
    const migrador = new MigracionController();

    try {
        console.log('🔄 Iniciando migración desde Azure Cosmos DB...');
        await migrador.migrar();
        console.log('✅ Migración finalizada correctamente.');
    } catch (error) {
        console.error('❌ Error durante la migración:', error.message);
    } finally {
        process.exit();
    }
})();
