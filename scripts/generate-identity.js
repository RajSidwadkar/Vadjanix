import { generateSecretKey, getPublicKey } from 'nostr-tools';
function generate() {
    const sk = generateSecretKey(); // Uint8Array
    const pk = getPublicKey(sk); // Uint8Array
    const skHex = Buffer.from(sk).toString('hex');
    const pkHex = Buffer.from(pk).toString('hex');
    console.log("====================================================");
    console.log("   VADJANIX NOSTR IDENTITY GENERATOR");
    console.log("====================================================");
    console.log("COPY THESE INTO YOUR .env FILE:");
    console.log("");
    console.log(`NOSTR_PRIVATE_KEY=${skHex}`);
    console.log(`NOSTR_PUBLIC_KEY=${pkHex}`);
    console.log("");
    console.log("====================================================");
    console.log("WARNING: NEVER SHARE YOUR PRIVATE KEY!");
    console.log("====================================================");
}
generate();
