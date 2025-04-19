import * as secp from '@noble/secp256k1';
import { Request, Response } from 'express';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { KeyPairHex } from './CryptoIntf.js';
import { ChatMessage } from '../src/AppServiceTypes.js';

// See also: https://www.npmjs.com/package/@noble/secp256k1
class Crypto {
    adminPublicKey: string | null = null;

    setAdminPublicKey(adminPublicKey: string | undefined) {
        this.adminPublicKey = adminPublicKey || null;
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

    // Function to create a KeyPairHex object from a private key hex string
    makeKeysFromPrivateKeyHex(privateKeyHex: string): KeyPairHex | null {
        try {
            // Convert hex to bytes
            const privateKeyBytes = hexToBytes(privateKeyHex);
            
            // Validate private key
            if (!secp.utils.isValidPrivateKey(privateKeyBytes)) {
                console.error("Invalid private key");
                return null;
            }
            
            // Derive public key from private key
            const publicKeyBytes = secp.getPublicKey(privateKeyBytes);
            const publicKeyHex = bytesToHex(publicKeyBytes);
            
            return {
                privateKey: privateKeyHex,
                publicKey: publicKeyHex,
            };
        } catch (error) {
            console.error("Error creating key pair from private key:", error);
            return null;
        }
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
            console.log("verifySignature(1) Verified: "+isVerified);
            return isVerified;
        } catch (error) {
            console.error("Error verifying signature:", error);
            return false;
        }
    }

    async verifySignatureBytes(msgHash: Uint8Array, signatureBytes: Uint8Array, publicKeyHex: string): Promise<boolean> {
        try {
            const publicKeyBytes = hexToBytes(publicKeyHex);
            
            // Convert the signature bytes to a Signature object
            let signature: secp.Signature;
            try {
                signature = secp.Signature.fromCompact(signatureBytes);
            } catch (error) {
                console.error("Error parsing signature:", error);
                return false;
            }
            
            // Verify the signature
            const isVerified: boolean = await secp.verify(signature, msgHash, publicKeyBytes);
            // console.log("Sig Bytes Verified: "+isVerified);
            return isVerified;
        } catch (error) {
            console.error("Error verifying signature:", error);
            return false;
        }
    }

    getMessageHashBytes(msg: any): Uint8Array {
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

    // Note: This is AI-Generated implementation for "RFC 9421 - HTTP Message Signatures" which looks ok to me
    // and is working but I haven't fully scrutenized it yet.
    verifyHTTPSignature = async (req: Request, res: Response, next: any): Promise<void> => {
        try {
            if (!this.adminPublicKey) {
                res.status(500).json({ error: 'Admin public key is not set' });
                return;
            }
            const signature = req.headers['signature'];
            const signatureInput = req.headers['signature-input'];
        
            if (!signature || !signatureInput) {
                res.status(401).json({ error: ' headers' });
                return;
            }
        
            // Parse the signature-input header
            // Format: sig1=("@method" "@target-uri" "@created" "content-type");created=1618884475;keyid="admin-key"
            const sigInputMatch = /sig1=\(([^)]+)\);created=(\d+);keyid="([^"]+)"/.exec(signatureInput as string);
            if (!sigInputMatch) {
                res.status(401).json({ error: 'Invalid signature-input format' });
                return;
            }
        
            // We skip the first element which is the full match, and that's what the leading comma is doing here
            const [, coveredComponents, createdTimestamp, keyId] = sigInputMatch;
        
            // Verify the admin key ID
            if (keyId !== "admin-key") {
                res.status(401).json({ error: 'Invalid key ID' });
                return;
            }
        
            // Check if the timestamp is within a reasonable window (2 minutes)
            const created = parseInt(createdTimestamp);
            const now = Math.floor(Date.now() / 1000);
            if (Math.abs(now - created) > 2 * 60) {
                res.status(401).json({ error: 'Signature timestamp is too old or from the future' });
                return;
            }
        
            // Build the signature base
            let signatureBase = '';
        
            // Add covered components to the signature base
            for (const component of coveredComponents.split(' ').map(c => c.replace(/"/g, ''))) {
                if (component === '@method') {
                    signatureBase += `"@method": ${req.method.toLowerCase()}\n`;
                } else if (component === '@target-uri') {
                    const targetUri = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
                    signatureBase += `"@target-uri": ${targetUri}\n`;
                } else if (component === '@created') {
                    signatureBase += `"@created": ${created}\n`;
                } else if (component === 'content-type') {
                    signatureBase += `"content-type": ${req.get('content-type')}\n`;
                }
            // Add other components as needed
            }
        
            // Remove trailing newline
            signatureBase = signatureBase.slice(0, -1);
        
            // todo-0: our crypto.getMessageHashBytes for getting hash of a chat message might be better off
            // using this way of encoding instead. Look into it.
            // Create message hash similar to how we do it in Crypto.ts
            const messageHash = sha256(new TextEncoder().encode(signatureBase));
        
            // DO NOT DELETE: Keep for future debugging purposes
            // console.log('Server signatureBase:['+ JSON.stringify(signatureBase)+"]");
            // console.log('Server message hash:', bytesToHex(messageHash));
            // console.log('Signature received:', signature);
            // console.log('Admin public key:', ADMIN_PUBLIC_KEY);        

            // Verify the signature using our crypto utility
            const isValid = await crypto.verifySignatureBytes(
                messageHash,
                // AI got itself confused about which of these two lines is best.
                Buffer.from(signature as string, 'hex'),            
                this.adminPublicKey!
            );
        
            if (!isValid) {
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }
        
            // If we reach here, signature is valid
            console.log('Signature verified successfully for admin endpoint');
            next();
        } catch (error) {
            console.error('Error verifying signature:', error);
            res.status(500).json({ error: 'Signature verification error' });
        }
    };

    buildSecureHeaders = async (url: string, keyPair: KeyPairHex): Promise<Record<string,string>> => {
        // Get the current timestamp in seconds
        const created = Math.floor(Date.now() / 1000);
                    
        // Create the signature-input string
        const signatureInput = `sig1=("@method" "@target-uri" "@created" "content-type");created=${created};keyid="admin-key"`;
                    
        // Build the signature base
        let signatureBase = '';
        signatureBase += `"@method": post\n`;
        signatureBase += `"@target-uri": ${window.location.origin}${url}\n`;
        signatureBase += `"@created": ${created}\n`;
        signatureBase += `"content-type": application/json`;
                    
        const messageHash = sha256(new TextEncoder().encode(signatureBase));    
        
        if (!keyPair || !keyPair.privateKey) {
            throw new Error("No private key available");
        }
                    
        // Sign the message hash
        const privateKeyBytes = crypto.importPrivateKey(keyPair.privateKey);
        if (!privateKeyBytes) {
            throw new Error("Invalid private key");
        }
                    
        const signature = await secp.signAsync(messageHash, privateKeyBytes);
        const signatureHex = signature.toCompactHex();
                    
        // DO NOT DELETE: Keep for future debugging.
        // console.log('Client signatureBase:['+JSON.stringify(signatureBase)+']');
        // console.log('Client message hash:', bytesToHex(messageHash));
        // console.log('Signature generated:', signatureHex);
        // console.log('Admin public key:', this.adminPublicKey);

        return {
            'Content-Type': 'application/json',
            'Signature-Input': signatureInput,
            'Signature': signatureHex
        };
    }

    // Eventually we'll need to support a BODY to send, but we don't need it for now.
    secureHttpPost = async (url: string, keyPair: KeyPairHex): Promise<any> => {
        let response: any | null = null;
        try {
            const headers = await crypto.buildSecureHeaders(url, keyPair!);
            const res = await fetch(url, {
                method: 'POST',
                headers
            }); 
            
            if (res.ok) {
                response = await res.json();
            }
            else {
                const errorData = await res.json();
                alert(`Failed to post to ${url}: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(`Error posting to ${url}:`, error);
        }
        return response;
    }
}

export const crypto = new Crypto();
