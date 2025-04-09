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
  
    // Function to import a private key from a hex string
    importPrivateKey(privateKeyHex: any) {
        try {
            const privateKeyBytes = hexToBytes(privateKeyHex);
            // You might want to add validation here to ensure it's a valid private key
            return privateKeyBytes;
        } catch (error) {
            console.error("Invalid private key hex string:", error);
            return null;
        }
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
        const privateKeyBytes = this.importPrivateKey(keyPair.privateKey);
        if (!privateKeyBytes) {
            throw new Error("Invalid private key");
        }
        
        // Create a canonical form of the message with deterministic ordering
        const canonicalMsg = {
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp
        };
        
        const canonicalString = this.getCanonicalJSON(canonicalMsg);
        const canonicalBytes = new TextEncoder().encode(canonicalString);
        const msgHash = sha256(canonicalBytes);

        // Now the sign function will work because hmacSha256Sync is set
        const signature = await secp.signAsync(msgHash, privateKeyBytes);

        // Convert the signature to compact format and then to hex
        msg.signature = signature.toCompactHex();
        msg.publicKey = keyPair.publicKey;
        console.log("Signature Hex:", msg.signature);
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
