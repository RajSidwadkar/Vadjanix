import 'dotenv/config';
import { Bootstrapper } from './core/bootstrapper.js';

async function main() {
    console.log('\n=========================================');
    console.log('🚀 VADJANIX SOVEREIGN MONOLITH IGNITING');
    console.log('=========================================\n');
    
    try {
        const { apiServer, discord, whatsapp, telegram } = await Bootstrapper.ignite();
        
        console.log('[SYSTEM] -> Starting API Server...');
        const port = process.env.PORT || 3000;
        const server = apiServer.listen(port, () => {
            console.log('    ✅ API Server listening on port ' + port);
        });
        
        console.log('[SYSTEM] -> Connecting Discord Adapter...');
        await discord.initialize();
        console.log('    ✅ Discord Bot Online');

        console.log('[SYSTEM] -> Connecting Telegram Adapter...');
        await telegram.initialize();
        console.log('    ✅ Telegram Webhook Active');

        console.log('[SYSTEM] -> Cooling down event loop (5s) before WhatsApp injection...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('[SYSTEM] -> Connecting WhatsApp Adapter...');
        await whatsapp.initialize();
        console.log('    ✅ WhatsApp Client Online');
        
        console.log('\n=========================================');
        console.log('🟢 STATUS: AGI ONLINE. EVENT LOOP LOCKED.');
        console.log('=========================================\n');

        async function shutdown() {
            console.log('\n[SYSTEM] -> Shutdown signal received. Powering down...');
            
            try {
                await telegram.stop();
            } catch (e) {}
            
            try {
                await whatsapp.stop();
            } catch (e) {}
            
            try {
                await discord.stop();
            } catch (e) {}

            server.close();
            console.log('[SYSTEM] -> All systems offline. Goodbye.\n');
            process.exit(0);
        }

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        process.on('SIGUSR2', shutdown);

    } catch (error) {
        console.error('[FATAL ERROR] System Ignition Failed:');
        console.error(error);
        process.exit(1);
    }
}

main();
