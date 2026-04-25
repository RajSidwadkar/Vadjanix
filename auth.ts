import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

console.log("=========================================");
console.log("🔒 VADJANIX AIRLOCK: VISUAL DEBUG MODE");
console.log("=========================================\n");

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false, // <-- TAKING THE BLINDFOLD OFF
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('loading_screen', (percent, message) => {
    console.log(`[AIRLOCK] Loading WhatsApp: ${percent}% - ${message}`);
});

client.on('qr', (qr) => {
    console.log("\n[AIRLOCK] QR Code generated! Scan it with your phone:\n");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log("\n=========================================");
    console.log("✅ AUTHENTICATION SUCCESSFUL!");
    console.log("The .wwebjs_auth folder is fully built.");
    console.log("You can safely press Ctrl+C to close this script.");
    console.log("=========================================\n");
});

client.on('auth_failure', msg => {
    console.error('\n❌ [AIRLOCK] Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.error('\n❌ [AIRLOCK] Client was logged out or disconnected:', reason);
});

console.log("[AIRLOCK] Booting up visible browser. Please watch the Chrome window...");
client.initialize().catch(err => console.error("[FATAL ERROR]", err));