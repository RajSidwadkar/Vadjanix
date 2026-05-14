import { generateSecretKey, getPublicKey } from 'nostr-tools';
import fs from 'fs';

export function createIdentity() {
    const sk = generateSecretKey(); // Uint8Array (32 bytes)
    const pk = getPublicKey(sk);    // string (64 chars hex)

    const identity = {
        name: "Vadjanix_Agent_01",
        pubkey: pk,
        private_key: Buffer.from(sk).toString('hex')
    };

    fs.writeFileSync('./.env_identity', JSON.stringify(identity, null, 2));
    console.log("🔑 Identity Created!");
    console.log("Your Public Key (HEX):", pk);
}