import * as secp from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { KeyPairHex } from './CryptoIntf';
import { ChatMessage } from './AppServiceIntf';

// See also: https://www.npmjs.com/package/@noble/secp256k1
class Crypto {
    private static inst: Crypto | null = null;

    constructor() {
        console.log('Crypto singleton created');
    }

    static getInst() {
        if (!Crypto.inst) {
            Crypto.inst = new Crypto();
        }
        return Crypto.inst;
    }

    // Function to generate a new keypair
    generateKeypair(): KeyPairHex {
        // Generate a random private key (32 bytes)
        const privateKeyBytes = secp.utils.randomPrivateKey();
        const privateKeyHex = bytesToHex(privateKeyBytes);
  
        // Get the corresponding public key (compressed format, 33 bytes)
        const publicKeyBytes = secp.getPublicKey(privateKeyBytes);
        const publicKeyHex = bytesToHex(publicKeyBytes);
  
        return {
            privateKey: privateKeyHex,
            publicKey: publicKeyHex,
        };
    }
  
    // Function to export a key (already as hex in this example)
    exportKey(keyHex: any) {
        return keyHex; // In this case, it's already a hex string
    }
    
    // Function to import a public key from a hex string
    importPublicKey(publicKeyHex: any) {
        try {
            const publicKeyBytes = hexToBytes(publicKeyHex);
            // You might want to add validation here to ensure it's a valid public key
            return publicKeyBytes;
        } catch (error) {
            console.error("Invalid public key hex string:", error);
            return null;
        }
    }

    async signMessage(msg: ChatMessage, keyPair: KeyPairHex) {
        const privateKeyBytes: Uint8Array | null = this.importPrivateKey(keyPair.privateKey);
        if (!privateKeyBytes) {
            throw new Error("Invalid private key");
        }
        
        const msgHash: Uint8Array = this.getMessageHashBytes(msg);

        // Now the sign function will work because hmacSha256Sync is set
        const signature: secp.SignatureWithRecovery = await secp.signAsync(msgHash, privateKeyBytes);

        // Convert the signature to compact format and then to hex
        msg.signature = signature.toCompactHex();
        msg.publicKey = keyPair.publicKey;
        console.log("Signature Hex:", msg.signature);

        // Optionally, you can verify the signature here
        // this.verifySignature(msg);
    }

    importPrivateKey(privateKeyHex: string): Uint8Array | null {
        if (!privateKeyHex || privateKeyHex.length !== 64) {
            console.log("Invalid private key hex string.");
            return null;
        }
        try {
            return hexToBytes(privateKeyHex);
        } catch (error) {
            console.error("Error importing private key:", error);
            return null;
        }
    }

    async verifySignature(msg: ChatMessage): Promise<boolean> {
        if (!msg.signature || !msg.publicKey) {
            console.warn("Message is missing signature or public key.");
            return false;
        }

        const msgHash: Uint8Array = this.getMessageHashBytes(msg);
        const publicKeyBytes: Uint8Array = hexToBytes(msg.publicKey);
        const signatureBytes: Uint8Array = hexToBytes(msg.signature);

        // The `@noble/secp256k1` library expects a Signature object, not just the raw bytes for verification.
        // Since we used `toCompactHex()` during signing, we should use `Signature.fromCompact()` here.
        let signature: secp.Signature;
        try {
            signature = secp.Signature.fromCompact(signatureBytes);
        } catch (error) {
            console.error("Error parsing signature:", error);
            return false;
        }

        try {
            const isVerified: boolean = await secp.verify(signature, msgHash, publicKeyBytes);
            console.log("Signature Verified:", isVerified);
            return isVerified;
        } catch (error) {
            console.error("Error verifying signature:", error);
            return false;
        }
    }

    getMessageHashBytes(msg: ChatMessage): Uint8Array {
        const canonicalMsg = {
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp
        };
        const canonicalString: string = this.getCanonicalJSON(canonicalMsg);
        const canonicalBytes: Uint8Array = new TextEncoder().encode(canonicalString);
        const msgHash: Uint8Array = sha256(canonicalBytes);
        return msgHash;
    }

    // Helper function for deterministic JSON serialization
    getCanonicalJSON(obj: any): string {
        if (typeof obj !== 'object' || obj === null) {
            return JSON.stringify(obj);
        }
        
        if (Array.isArray(obj)) {
            return '[' + obj.map(item => this.getCanonicalJSON(item)).join(',') + ']';
        }
        
        // Sort object keys alphabetically
        const sortedKeys = Object.keys(obj).sort();
        const parts = sortedKeys.map(key => {
            const value = obj[key];
            return JSON.stringify(key) + ':' + this.getCanonicalJSON(value);
        });
        
        return '{' + parts.join(',') + '}';
    }
}

export default Crypto;
