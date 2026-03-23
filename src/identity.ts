import { generateSecretKey, getPublicKey } from 'nostr-tools';
import fs from 'fs';

export function createIdentity() {
    const sk = generateSecretKey(); // Your Private Key (Keep secret!)
    const pk = getPublicKey(sk);    // Your Public Key (Your Diplomatic ID)

    const identity = {
        name: "Vadjanix_Agent_01",
        npub: pk,
        private_key: Buffer.from(sk).toString('hex')
    };

    fs.writeFileSync('./.env_identity', JSON.stringify(identity, null, 2));
    console.log("🔑 Identity Created!");
    console.log("Your Public ID (NPUB):", pk);
}