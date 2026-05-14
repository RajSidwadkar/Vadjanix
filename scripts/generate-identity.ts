import { generateSecretKey, getPublicKey } from 'nostr-tools';

function generate() {
  const sk = generateSecretKey(); // Uint8Array (32 bytes)
  const pk = getPublicKey(sk);    // string (64 chars hex)

  const skHex = Buffer.from(sk).toString('hex');

  console.log("====================================================");
  console.log("   VADJANIX NOSTR IDENTITY GENERATOR");
  console.log("====================================================");
  console.log("COPY THESE INTO YOUR .env FILE:");
  console.log("");
  console.log(`NOSTR_PRIVATE_KEY=${skHex}`);
  console.log(`NOSTR_PUBLIC_KEY=${pk}`);
  console.log("");
  console.log("====================================================");
  console.log("WARNING: NEVER SHARE YOUR PRIVATE KEY!");
  console.log("====================================================");
}

generate();
