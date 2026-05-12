/*
 * Copyright 2026 Raj Kumar Sidwadkar
 * * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * * http://www.apache.org/licenses/LICENSE-2.0
 * * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import 'dotenv/config';
import { Bootstrapper } from './core/bootstrapper.js';

async function main() {
    console.log('\n=========================================');
    console.log('🚀 VADJANIX SOVEREIGN MONOLITH IGNITING');
    console.log('=========================================\n');
    
    try {
        const { apiServer, channels } = await Bootstrapper.ignite();
        
        console.log('[SYSTEM] -> Starting API Server...');
        const port = process.env.PORT || 3000;
        const server = apiServer.listen(port, () => {
            console.log('    ✅ API Server listening on port ' + port);
        });
        
        console.log('\n=========================================');
        console.log('🟢 STATUS: AGI ONLINE. EVENT LOOP LOCKED.');
        console.log('=========================================\n');

        async function shutdown() {
            console.log('\n[SYSTEM] -> Shutdown signal received. Powering down...');
            
            try {
                await channels.stop();
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
