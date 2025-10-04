const registrationService = require('./src/service/registration');

async function runCleanup() {
    try {
        console.log('Starting cleanup job...');
        const result = await registrationService.runCleanupJob();
        console.log('Cleanup completed:', result);
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
    runCleanup();
}

module.exports = { runCleanup };
