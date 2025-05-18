import * as secp from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { KeyPairHex } from './CryptoIntf.js';
import { SignableObject } from './types/CommonTypes.js';

// See also: https://www.npmjs.com/package/@noble/secp256k1
class Crypto {
        
    // Function to generate a new keypair
    generateKeypair(): KeyPairHex {
        // Generate a random private key (32 bytes)
        const privKeyBytes = secp.utils.randomPrivateKey();
        const privKeyHex = bytesToHex(privKeyBytes);
  
        // Get the corresponding public key (compressed format, 33 bytes)
        const pubKeyBytes = secp.getPublicKey(privKeyBytes);
        const pubKeyHex = bytesToHex(pubKeyBytes);
  
        return {
            privateKey: privKeyHex,
            publicKey: pubKeyHex,
        };
    }

    // Function to create a KeyPairHex object from a private key hex string
    makeKeysFromPrivateKeyHex(privKeyHex: string): KeyPairHex | null {
        try {
            // Convert hex to bytes
            const privKeyBytes = hexToBytes(privKeyHex);
            
            // Validate private key
            if (!secp.utils.isValidPrivateKey(privKeyBytes)) {
                console.error("Invalid private key");
                return null;
            }
            
            // Derive public key from private key
            const pubKeyBytes = secp.getPublicKey(privKeyBytes);
            const pubKeyHex = bytesToHex(pubKeyBytes);
            
            return {
                privateKey: privKeyHex,
                publicKey: pubKeyHex,
            };
        } catch (error) {
            console.error("Error creating key pair from private key:", error);
            return null;
        }
    }

    signObject = async (obj: SignableObject, canonicalizr: (obj: any) => string, keyPair: KeyPairHex) => {
        const privKeyBytes: Uint8Array | null = this.importPrivateKey(keyPair.privateKey);
        if (!privKeyBytes) {
            throw new Error("Invalid private key");
        }
        
        const canonical: string = canonicalizr(obj);
        obj.signature = await this.getSigHexOfString(canonical, privKeyBytes);
        obj.publicKey = keyPair.publicKey;

        // Optionally, you can verify the signature here
        // this.verifySignature(msg, canonicalizr);
    }

    importPrivateKey(privKeyHex: string): Uint8Array | null {
        if (!privKeyHex || privKeyHex.length !== 64) {
            console.log("Invalid private key hex string.");
            return null;
        }
        try {
            return hexToBytes(privKeyHex);
        } catch (error) {
            console.error("Error importing private key:", error);
            return null;
        }
    }

    verifySignature = async (msg: SignableObject, canonicalizr: (obj: any) => string): Promise<boolean> => {
        if (!msg.signature || !msg.publicKey) {
            console.warn("Message is missing signature or public key.");
            return false;
        }

        const canonicalString: string = canonicalizr(msg);
        const msgHash : Uint8Array = this.getHashBytesOfString(canonicalString);
        const pubKeyBytes: Uint8Array = hexToBytes(msg.publicKey);
        const sigBytes: Uint8Array = hexToBytes(msg.signature);

        // The `@noble/secp256k1` library expects a Signature object, not just the raw bytes for verification.
        // Since we used `toCompactHex()` during signing, we should use `Signature.fromCompact()` here.
        let sig: secp.Signature;
        try {
            sig = secp.Signature.fromCompact(sigBytes);
        } catch (error) {
            console.error("Error parsing signature:", error);
            return false;
        }

        try {
            const isVerified: boolean = await secp.verify(sig, msgHash, pubKeyBytes);
            return isVerified;
        } catch (error) {
            console.error("Error verifying signature:", error);
            return false;
        }
    }

    verifySignatureBytes = async (msgHash: Uint8Array, sigBytes: Uint8Array, pubKeyHex: string): Promise<boolean> => {
        try {
            const pubKeyBytes = hexToBytes(pubKeyHex);
            
            // Convert the signature bytes to a Signature object
            let sig: secp.Signature;
            try {
                sig = secp.Signature.fromCompact(sigBytes);
            } catch (error) {
                console.error("Error parsing signature:", error);
                return false;
            }
            
            // Verify the signature
            const isVerified: boolean = await secp.verify(sig, msgHash, pubKeyBytes);
            // console.log("Sig Bytes Verified: "+isVerified);
            return isVerified;
        } catch (error) {
            console.error("Error verifying signature:", error);
            return false;
        }
    }

    getHashBytesOfString(str: string): Uint8Array {
        const strBytes: Uint8Array = new TextEncoder().encode(str);
        const hashBytes: Uint8Array = sha256(strBytes);
        return hashBytes;
    }
    
    /**
    * Opens the recent attachments page in a new tab with admin authentication
    * 
    * DO NOT DELETE: This is no longer being used but this and the server-side code are being kept
    * as a reference for how to implement admin authentication for HTTP GET requests. Also this method is specific
    * to attachments and for that reason didn't belong in this class either, but we keep it for now.
    */
    openRecentAttachments = async (keyPair: KeyPairHex) => {
        // Current timestamp
        const timestamp = Date.now().toString();

        const sig = await this.signWithPrivateKey(timestamp, keyPair);
        if (!sig) {
            console.error('Failed to sign the timestamp');
            alert('Failed to authenticate. Please check your admin credentials.');
            return;
        }
        const url = `/recent-attachments?timestamp=${timestamp}&signature=${sig}`;
            
        // Open in new tab
        window.open(url, '_blank');
    }

    signWithPrivateKey = async (data: string, keyPair: KeyPairHex) => {
        if (!keyPair || !keyPair.privateKey) {
            throw new Error("No private key available");
        }
                    
        // Sign the message hash
        const keyBytes: Uint8Array | null = crypt.importPrivateKey(keyPair.privateKey);
        if (!keyBytes) {
            throw new Error("Invalid private key");
        }
    
        const sigHex = await this.getSigHexOfString(data, keyBytes);
        return sigHex;
    }

    // Takes the hash of 's' and signs it with the private key, returning the hex of the signature
    getSigHexOfString = async (s: string, keyBytes: Uint8Array) => {
        const hash = this.getHashBytesOfString(s);    
        const sig = await secp.signAsync(hash, keyBytes);    
        return sig.toCompactHex();
    }
}

export const crypt = new Crypto();
