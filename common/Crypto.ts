import * as secp from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { KeyPairHex, SignableObject } from './types/CommonTypes.js';

/**
 * Cryptographic utility class providing SECP256K1 elliptic curve cryptography operations.
 * 
 * This class handles key generation, digital signatures, and signature verification
 * using the @noble/secp256k1 library. It supports both object signing with canonicalization
 * and raw data signing operations.
 * 
 * See also: https://www.npmjs.com/package/@noble/secp256k1 
 */
class Crypto {
    /**
     * Generates a new SECP256K1 key pair with cryptographically secure random private key.
     * 
     * @returns A new key pair containing both private and public keys in hexadecimal format
     */
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

    /**
     * Creates a KeyPairHex object from an existing private key hex string.
     * Derives the corresponding public key and validates the private key.
     * 
     * @param privKeyHex - The private key as a 64-character hexadecimal string
     * @returns A key pair object containing both private and public keys, or null if the private key is invalid
     */
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

    /**
     * Signs a SignableObject by canonicalizing it and creating a digital signature.
     * Modifies the object in-place by adding signature and publicKey properties.
     * 
     * @param obj - The object to be signed (will be modified in-place)
     * @param canonicalizr - Function to convert the object to a canonical string representation
     * @param keyPair - The key pair containing the private key for signing
     */
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

    /**
     * Converts a private key from hexadecimal string format to Uint8Array bytes.
     * Validates the key format and length before conversion.
     * 
     * @param privKeyHex - The private key as a 64-character hexadecimal string
     * @returns The private key as a Uint8Array, or null if the key is invalid
     */
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

    /**
     * Verifies the digital signature of a SignableObject using its embedded signature and public key.
     * 
     * @param msg - The signed object containing signature and publicKey properties
     * @param canonicalizr - Function to convert the object to a canonical string representation
     * @returns True if the signature is valid, false otherwise
     */
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

    /**
     * Verifies a digital signature using raw message hash, signature bytes, and public key.
     * This is a lower-level verification method that works with byte arrays directly.
     * 
     * @param msgHash - The SHA256 hash of the original message as a Uint8Array
     * @param sigBytes - The signature bytes as a Uint8Array
     * @param pubKeyHex - The public key as a hexadecimal string
     * @returns True if the signature is valid, false otherwise
     */
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

    /**
     * Computes the SHA256 hash of a string and returns it as a Uint8Array.
     * 
     * @param str - The input string to hash
     * @returns The SHA256 hash as a Uint8Array
     */
    getHashBytesOfString(str: string): Uint8Array {
        const strBytes: Uint8Array = new TextEncoder().encode(str);
        const hashBytes: Uint8Array = sha256(strBytes);
        return hashBytes;
    }
    
    /**
     * Signs arbitrary string data with a private key and returns the signature as hexadecimal.
     * 
     * @param data - The string data to sign
     * @param keyPair - The key pair containing the private key for signing
     * @returns The signature as a hexadecimal string
     */
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

    /**
     * Signs the SHA256 hash of a string using SECP256K1 private key bytes.
     * Returns the signature in compact hexadecimal format.
     * 
     * @param s - The string to hash and sign
     * @param keyBytes - The private key as a Uint8Array
     * @returns The signature as a compact hexadecimal string
     */
    getSigHexOfString = async (s: string, keyBytes: Uint8Array) => {
        const hash = this.getHashBytesOfString(s);    
        const sig = await secp.signAsync(hash, keyBytes);    
        return sig.toCompactHex();
    }
}

/**
 * Global singleton instance of the Crypto class for convenient access throughout the application.
 */
export const crypt = new Crypto();
