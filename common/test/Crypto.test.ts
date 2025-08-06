import { crypt } from '../Crypto.js';
import { KeyPairHex, SignableObject } from '../types/CommonTypes.js';
import { TestRunner } from '../TestRunner.js';
import {
    assert,
    assertEqual,
    assertDefined,
    assertNull
} from '../CommonUtils.js';

// Test object types that extend SignableObject
type TestMessage = SignableObject & {
    message?: string;
    timestamp?: number;
    type?: string;
    content?: string;
    userId?: string;
    data?: string;
};

// Mock canonicalizer function for testing
function mockCanonicalizer(obj: any): string {
    // Remove signature and publicKey properties for canonicalization
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { signature, publicKey, ...cleanObj } = obj;
    return JSON.stringify(cleanObj, Object.keys(cleanObj).sort());
}

export async function runTests() {
    console.log("🚀 Starting Crypto tests...");
    
    const testRunner = new TestRunner("Crypto");
    
    try {
        // Key Generation Tests
        await testRunner.run("generateKeypair - should generate valid key pairs", async () => {
            const keyPair = crypt.generateKeypair();
            
            assertDefined(keyPair, 'Should return a key pair object');
            assertDefined(keyPair.privateKey, 'Should have a private key');
            assertDefined(keyPair.publicKey, 'Should have a public key');
            assertEqual(keyPair.privateKey.length, 64, 'Private key should be 64 hex characters');
            assertEqual(keyPair.publicKey.length, 66, 'Public key should be 66 hex characters (compressed)');
            
            // Verify hex format
            assert(/^[0-9a-f]+$/i.test(keyPair.privateKey), 'Private key should be valid hex');
            assert(/^[0-9a-f]+$/i.test(keyPair.publicKey), 'Public key should be valid hex');
        });

        await testRunner.run("generateKeypair - should generate unique key pairs", async () => {
            const keyPair1 = crypt.generateKeypair();
            const keyPair2 = crypt.generateKeypair();
            
            assert(keyPair1.privateKey !== keyPair2.privateKey, 'Private keys should be unique');
            assert(keyPair1.publicKey !== keyPair2.publicKey, 'Public keys should be unique');
        });

        // Key Import Tests
        await testRunner.run("makeKeysFromPrivateKeyHex - should create valid key pair from private key", async () => {
            const originalKeyPair = crypt.generateKeypair();
            const reconstructedKeyPair = crypt.makeKeysFromPrivateKeyHex(originalKeyPair.privateKey);
            
            assertDefined(reconstructedKeyPair, 'Should successfully reconstruct key pair');
            assertEqual(reconstructedKeyPair!.privateKey, originalKeyPair.privateKey, 'Private key should match');
            assertEqual(reconstructedKeyPair!.publicKey, originalKeyPair.publicKey, 'Public key should match');
        });

        await testRunner.run("makeKeysFromPrivateKeyHex - should reject invalid private keys", async () => {
            assertNull(crypt.makeKeysFromPrivateKeyHex(''), 'Should reject empty string');
            assertNull(crypt.makeKeysFromPrivateKeyHex('invalid'), 'Should reject invalid hex');
            assertNull(crypt.makeKeysFromPrivateKeyHex('12345'), 'Should reject too short key');
            assertNull(crypt.makeKeysFromPrivateKeyHex('0'.repeat(63)), 'Should reject wrong length key');
            assertNull(crypt.makeKeysFromPrivateKeyHex('g'.repeat(64)), 'Should reject non-hex characters');
            assertNull(crypt.makeKeysFromPrivateKeyHex('0'.repeat(65)), 'Should reject too long key');
        });

        await testRunner.run("makeKeysFromPrivateKeyHex - should handle edge case private keys", async () => {
            // Test with all zeros (should be invalid)
            assertNull(crypt.makeKeysFromPrivateKeyHex('0'.repeat(64)), 'Should reject all-zero private key');
            
            // Test with all F's (should be invalid as it's >= curve order)
            assertNull(crypt.makeKeysFromPrivateKeyHex('f'.repeat(64)), 'Should reject all-F private key');
        });

        // Private Key Import Tests
        await testRunner.run("importPrivateKey - should import valid private keys", async () => {
            const keyPair = crypt.generateKeypair();
            const keyBytes = crypt.importPrivateKey(keyPair.privateKey);
            
            assertDefined(keyBytes, 'Should return key bytes');
            assertEqual(keyBytes!.length, 32, 'Should return 32 bytes');
            assert(keyBytes instanceof Uint8Array, 'Should return Uint8Array');
        });

        await testRunner.run("importPrivateKey - should reject invalid private keys", async () => {
            assertNull(crypt.importPrivateKey(''), 'Should reject empty string');
            assertNull(crypt.importPrivateKey('invalid'), 'Should reject invalid hex');
            assertNull(crypt.importPrivateKey('12345'), 'Should reject too short key');
            assertNull(crypt.importPrivateKey('0'.repeat(63)), 'Should reject wrong length key');
            assertNull(crypt.importPrivateKey('g'.repeat(64)), 'Should reject non-hex characters');
        });

        // Hash Generation Tests
        await testRunner.run("getHashBytesOfString - should generate consistent SHA256 hashes", async () => {
            const testString = "Hello, World!";
            const hash1 = crypt.getHashBytesOfString(testString);
            const hash2 = crypt.getHashBytesOfString(testString);
            
            assertEqual(hash1.length, 32, 'SHA256 hash should be 32 bytes');
            assert(hash1 instanceof Uint8Array, 'Should return Uint8Array');
            
            // Verify consistency
            assertEqual(hash1.toString(), hash2.toString(), 'Same input should produce same hash');
        });

        await testRunner.run("getHashBytesOfString - should generate different hashes for different inputs", async () => {
            const hash1 = crypt.getHashBytesOfString("Hello");
            const hash2 = crypt.getHashBytesOfString("World");
            
            assert(hash1.toString() !== hash2.toString(), 'Different inputs should produce different hashes');
        });

        await testRunner.run("getHashBytesOfString - should handle empty string", async () => {
            const hash = crypt.getHashBytesOfString("");
            assertEqual(hash.length, 32, 'Should still produce 32-byte hash for empty string');
        });

        // String Signing Tests
        await testRunner.run("getSigHexOfString - should generate valid signatures", async () => {
            const keyPair = crypt.generateKeypair();
            const keyBytes = crypt.importPrivateKey(keyPair.privateKey)!;
            const testString = "Test message for signing";
            
            const signature = await crypt.getSigHexOfString(testString, keyBytes);
            
            assertDefined(signature, 'Should return a signature');
            assertEqual(typeof signature, 'string', 'Signature should be a string');
            assertEqual(signature.length, 128, 'Compact signature should be 128 hex characters');
            assert(/^[0-9a-f]+$/i.test(signature), 'Signature should be valid hex');
        });

        await testRunner.run("getSigHexOfString - should generate different signatures for different messages", async () => {
            const keyPair = crypt.generateKeypair();
            const keyBytes = crypt.importPrivateKey(keyPair.privateKey)!;
            
            const sig1 = await crypt.getSigHexOfString("Message 1", keyBytes);
            const sig2 = await crypt.getSigHexOfString("Message 2", keyBytes);
            
            assert(sig1 !== sig2, 'Different messages should produce different signatures');
        });

        // Private Key Signing Tests
        await testRunner.run("signWithPrivateKey - should sign data with private key", async () => {
            const keyPair = crypt.generateKeypair();
            const testData = "Data to be signed";
            
            const signature = await crypt.signWithPrivateKey(testData, keyPair);
            
            assertDefined(signature, 'Should return a signature');
            assertEqual(typeof signature, 'string', 'Signature should be a string');
            assertEqual(signature.length, 128, 'Signature should be 128 hex characters');
        });

        await testRunner.run("signWithPrivateKey - should reject invalid key pairs", async () => {
            const testData = "Data to be signed";
            
            try {
                await crypt.signWithPrivateKey(testData, null as any);
                assert(false, 'Should throw error for null key pair');
            } catch (error) {
                assert(error instanceof Error, 'Should throw Error');
            }
            
            try {
                await crypt.signWithPrivateKey(testData, {} as KeyPairHex);
                assert(false, 'Should throw error for empty key pair');
            } catch (error) {
                assert(error instanceof Error, 'Should throw Error');
            }
        });

        // Object Signing Tests
        await testRunner.run("signObject - should sign objects correctly", async () => {
            const keyPair = crypt.generateKeypair();
            const testObj: TestMessage = {
                message: "Hello, World!",
                timestamp: Date.now(),
                type: "test"
            };
            
            await crypt.signObject(testObj, mockCanonicalizer, keyPair);
            
            assertDefined(testObj.signature, 'Object should have signature after signing');
            assertDefined(testObj.publicKey, 'Object should have publicKey after signing');
            assertEqual(testObj.publicKey, keyPair.publicKey, 'Public key should match key pair');
            assertEqual(testObj.signature!.length, 128, 'Signature should be 128 hex characters');
        });

        await testRunner.run("signObject - should handle objects with existing signature/publicKey", async () => {
            const keyPair = crypt.generateKeypair();
            const testObj: TestMessage = {
                message: "Hello",
                signature: "old_signature",
                publicKey: "old_public_key"
            };
            
            await crypt.signObject(testObj, mockCanonicalizer, keyPair);
            
            // Should overwrite old signature and publicKey
            assertEqual(testObj.publicKey, keyPair.publicKey, 'Should overwrite old public key');
            assert(testObj.signature !== "old_signature", 'Should overwrite old signature');
        });

        // Signature Verification Tests
        await testRunner.run("verifySignature - should verify valid signatures", async () => {
            const keyPair = crypt.generateKeypair();
            const testObj: TestMessage = {
                message: "Test message",
                timestamp: 1234567890
            };
            
            // Sign the object
            await crypt.signObject(testObj, mockCanonicalizer, keyPair);
            
            // Verify the signature
            const isValid = await crypt.verifySignature(testObj, mockCanonicalizer);
            assert(isValid, 'Should verify valid signature');
        });

        await testRunner.run("verifySignature - should reject invalid signatures", async () => {
            const keyPair = crypt.generateKeypair();
            const testObj: TestMessage = {
                message: "Test message",
                timestamp: 1234567890
            };
            
            // Sign the object
            await crypt.signObject(testObj, mockCanonicalizer, keyPair);
            
            // Tamper with the signature
            testObj.signature = testObj.signature!.replace('a', 'b');
            
            const isValid = await crypt.verifySignature(testObj, mockCanonicalizer);
            assert(!isValid, 'Should reject tampered signature');
        });

        await testRunner.run("verifySignature - should reject objects without signature", async () => {
            const testObj: TestMessage = {
                message: "Test message"
            };
            
            const isValid = await crypt.verifySignature(testObj, mockCanonicalizer);
            assert(!isValid, 'Should reject unsigned object');
        });

        await testRunner.run("verifySignature - should reject objects with tampered content", async () => {
            const keyPair = crypt.generateKeypair();
            const testObj: TestMessage = {
                message: "Original message",
                timestamp: 1234567890
            };
            
            // Sign the object
            await crypt.signObject(testObj, mockCanonicalizer, keyPair);
            
            // Tamper with the content
            testObj.message = "Tampered message";
            
            const isValid = await crypt.verifySignature(testObj, mockCanonicalizer);
            assert(!isValid, 'Should reject object with tampered content');
        });

        // Raw Signature Verification Tests
        await testRunner.run("verifySignatureBytes - should verify raw signature bytes", async () => {
            const keyPair = crypt.generateKeypair();
            const testMessage = "Test message for raw verification";
            const keyBytes = crypt.importPrivateKey(keyPair.privateKey)!;
            
            // Create signature
            const signatureHex = await crypt.getSigHexOfString(testMessage, keyBytes);
            const sigBytes = new Uint8Array(signatureHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
            const msgHash = crypt.getHashBytesOfString(testMessage);
            
            const isValid = await crypt.verifySignatureBytes(msgHash, sigBytes, keyPair.publicKey);
            assert(isValid, 'Should verify valid raw signature');
        });

        await testRunner.run("verifySignatureBytes - should reject invalid raw signatures", async () => {
            const keyPair = crypt.generateKeypair();
            const testMessage = "Test message";
            const msgHash = crypt.getHashBytesOfString(testMessage);
            
            // Create invalid signature bytes
            const invalidSigBytes = new Uint8Array(64).fill(0);
            
            const isValid = await crypt.verifySignatureBytes(msgHash, invalidSigBytes, keyPair.publicKey);
            assert(!isValid, 'Should reject invalid signature bytes');
        });

        await testRunner.run("verifySignatureBytes - should handle malformed signature bytes", async () => {
            const keyPair = crypt.generateKeypair();
            const msgHash = crypt.getHashBytesOfString("test");
            
            // Test with wrong length signature
            const wrongLengthSig = new Uint8Array(32);
            const isValid = await crypt.verifySignatureBytes(msgHash, wrongLengthSig, keyPair.publicKey);
            assert(!isValid, 'Should reject wrong length signature');
        });

        // Integration Tests
        await testRunner.run("end-to-end signature workflow - should work correctly", async () => {
            // Generate key pair
            const keyPair = crypt.generateKeypair();
            
            // Create and sign an object
            const originalObj: TestMessage = {
                type: "message",
                content: "This is a test message",
                timestamp: Date.now(),
                userId: "user123"
            };
            
            // Sign the object
            await crypt.signObject(originalObj, mockCanonicalizer, keyPair);
            
            // Verify the signature
            const isValid = await crypt.verifySignature(originalObj, mockCanonicalizer);
            assert(isValid, 'End-to-end signature should be valid');
            
            // Ensure object has required properties
            assertDefined(originalObj.signature, 'Signed object should have signature');
            assertDefined(originalObj.publicKey, 'Signed object should have public key');
        });

        await testRunner.run("key reconstruction and verification - should work correctly", async () => {
            // Generate original key pair
            const originalKeyPair = crypt.generateKeypair();
            
            // Reconstruct key pair from private key
            const reconstructedKeyPair = crypt.makeKeysFromPrivateKeyHex(originalKeyPair.privateKey)!;
            
            // Sign with original, verify with reconstructed
            const testData = "Test data for reconstruction verification";
            const signature = await crypt.signWithPrivateKey(testData, originalKeyPair);
            
            // Create object for verification
            const testObj: TestMessage = {
                data: testData,
                signature: signature,
                publicKey: reconstructedKeyPair.publicKey
            };
            
            // This should work since the keys are the same
            const isValid = await crypt.verifySignature(testObj, (obj) => (obj as TestMessage).data || '');
            assert(isValid, 'Signature should be valid with reconstructed key pair');
        });

        await testRunner.run("multiple signatures with same key - should all be valid", async () => {
            const keyPair = crypt.generateKeypair();
            const messages = ["Message 1", "Message 2", "Message 3"];
            const signatures: string[] = [];
            
            // Sign multiple messages
            for (const message of messages) {
                const signature = await crypt.signWithPrivateKey(message, keyPair);
                signatures.push(signature);
            }
            
            // Verify all signatures are different
            const uniqueSignatures = new Set(signatures);
            assertEqual(uniqueSignatures.size, signatures.length, 'All signatures should be unique');
            
            // Verify all signatures are valid
            for (let i = 0; i < messages.length; i++) {
                const testObj: TestMessage = {
                    message: messages[i],
                    signature: signatures[i],
                    publicKey: keyPair.publicKey
                };
                
                const isValid = await crypt.verifySignature(testObj, (obj) => (obj as TestMessage).message || '');
                assert(isValid, `Signature ${i + 1} should be valid`);
            }
        });

    } catch (error) {
        console.error("❌ Crypto test suite failed:", error);
    } finally {
        // Final report
        testRunner.report();
    }
}
