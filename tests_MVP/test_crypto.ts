import { signPacket, verifyPacketSignature } from '../src/voice/crypto.js';
import { IntentPacket } from '../src/router/schema.js';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

async function testCrypto() {
  const sk = Buffer.from(generateSecretKey()).toString('hex');
  const pk = getPublicKey(Buffer.from(sk, 'hex'));

  const packet: IntentPacket = {
    from: "vadjanix://external-agent",
    to: "vadjanix://my-agent",
    action: "read",
    payload: { message: "Hello from the outside!" },
    reasoning: "Testing signatures."
  };

  console.log("Signing packet...");
  const signedPacket = await signPacket(packet, sk);
  console.log("Signed packet auth:", signedPacket.auth);

  console.log("Verifying packet...");
  const isValid = await verifyPacketSignature(signedPacket, pk);
  console.log("Signature valid:", isValid);

  if (!isValid) throw new Error("Signature verification failed!");

  console.log("Testing tampered packet...");
  const tamperedPacket = { ...signedPacket, payload: { message: "I am a malicious message!" } };
  const isTamperedValid = await verifyPacketSignature(tamperedPacket, pk);
  console.log("Tampered signature valid:", isTamperedValid);

  if (isTamperedValid) throw new Error("Tampered signature should not be valid!");

  console.log("All crypto tests passed!");
}

testCrypto().catch(e => {
  console.error(e);
  process.exit(1);
});
