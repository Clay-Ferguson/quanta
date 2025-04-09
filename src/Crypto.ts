import * as secp256k1 from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { KeyPairHex } from './CryptoIntf';

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
        const privateKeyBytes = secp256k1.utils.randomPrivateKey();
        const privateKeyHex = bytesToHex(privateKeyBytes);
  
        // Get the corresponding public key (compressed format, 33 bytes)
        const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes);
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
  
    // Example Usage:
    useExample() {
        // Generate a new keypair
        const newKeypair = this.generateKeypair();

        console.log("Generated Keypair:");
        console.log("Private Key (Hex):", newKeypair.privateKey);
        console.log("Public Key (Hex):", newKeypair.publicKey);
  
        // Export the keys (already in hex)
        const exportedPrivateKey = this.exportKey(newKeypair.privateKey);
        const exportedPublicKey = this.exportKey(newKeypair.publicKey);

        console.log("\nExported Keys:");
        console.log("Exported Private Key (Hex):", exportedPrivateKey);
        console.log("Exported Public Key (Hex):", exportedPublicKey);
  
        // Simulate importing the private key
        const importedPrivateKeyBytes = this.importPrivateKey(exportedPrivateKey);
        if (importedPrivateKeyBytes) {
            console.log("\nImported Private Key (Bytes):", importedPrivateKeyBytes);
            // You can then derive the public key from the imported private key if needed
            const publicKeyFromImportedPrivate = secp256k1.getPublicKey(importedPrivateKeyBytes);
            console.log("Public Key from Imported Private (Hex):", bytesToHex(publicKeyFromImportedPrivate));
        }
  
        // Simulate importing the public key
        const importedPublicKeyBytes = this.importPublicKey(exportedPublicKey);
        if (importedPublicKeyBytes) {
            console.log("\nImported Public Key (Bytes):", importedPublicKeyBytes);
        }
    }
}

export default Crypto;
