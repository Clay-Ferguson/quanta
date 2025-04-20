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

    getCanonicalMessageString(msg: ChatMessage): string {
        return this.getCanonicalJSON({
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp
        });
    }

    async signMessage(msg: ChatMessage, keyPair: KeyPairHex) {
        const privateKeyBytes: Uint8Array | null = this.importPrivateKey(keyPair.privateKey);
        if (!privateKeyBytes) {
            throw new Error("Invalid private key");
        }
        
        const canonicalString: string = this.getCanonicalMessageString(msg);
        msg.signature = await this.getSigHexOfString(canonicalString, privateKeyBytes);
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

        const msgHash: Uint8Array = this.getHashBytesOfMessage(msg);
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
            console.log("verifySignature Verified: "+isVerified);
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

    getHashBytesOfString(str: string): Uint8Array {
        const strBytes: Uint8Array = new TextEncoder().encode(str);
        const hashBytes: Uint8Array = sha256(strBytes);
        return hashBytes;
    }

    getHashBytesOfMessage(msg: ChatMessage): Uint8Array {
        const canonicalString: string = this.getCanonicalMessageString(msg);
        const msgHash : Uint8Array = this.getHashBytesOfString(canonicalString);
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
    verifyAdminHTTPSignature = async (req: Request, res: Response, next: any): Promise<void> => {
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
            const messageHash = this.getHashBytesOfString(signatureBase);
        
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
        
        if (!keyPair || !keyPair.privateKey) {
            throw new Error("No private key available");
        }
                    
        // Sign the message hash
        const privateKeyBytes = crypto.importPrivateKey(keyPair.privateKey);
        if (!privateKeyBytes) {
            throw new Error("Invalid private key");
        }
                    
        const signatureHex: string = await this.getSigHexOfString(signatureBase, privateKeyBytes);
                    
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

    // Middleware for verifying admin signature in query parameters (for GET requests)
    verifyAdminHTTPQuerySig = async (req: Request, res: Response, next: any): Promise<void> => {
        const { timestamp, signature } = req.query;

        // Validate required parameters
        if (!timestamp || !signature) {
            console.error('Missing authentication parameters');
            res.status(401).json({ 
                success: false, 
                error: 'Unauthorized: Missing authentication parameters' 
            });
            return;
        }

        try {
        // Make sure timestamp is not too old (e.g., 5 minutes)
            const currentTime = Date.now();
            const requestTime = parseInt(timestamp.toString(), 10);
    
            // Check if timestamp is valid
            if (isNaN(requestTime)) {
                console.error('Invalid timestamp format');
                res.status(401).json({ 
                    success: false, 
                    error: 'Unauthorized: Invalid timestamp' 
                });
                return;
            }
    
            // Check if request is not too old (5 minute window)
            const fiveMinutes = 5 * 60 * 1000;
            if (currentTime - requestTime > fiveMinutes) {
                console.error('Request timestamp too old');
                res.status(401).json({ 
                    success: false, 
                    error: 'Unauthorized: Request expired' 
                });
                return;
            }
    
            // Verify the signature using the admin public key
            if (!this.adminPublicKey) {
                console.error('Admin public key not set');
                res.status(401).json({ 
                    success: false, 
                    error: 'Server configuration error: Admin public key not set' 
                });
                return;
            }
        
            // Create the hash of the timestamp
            const msgHash = this.getHashBytesOfString(timestamp.toString());
        
            // Convert the base64 signature to buffer
            const signatureBuffer = Buffer.from(signature.toString(), 'hex');
        
            // Use your existing verifySignatureBytes method
            const isValid = await this.verifySignatureBytes(msgHash, signatureBuffer, this.adminPublicKey);
    
            if (!isValid) {
                console.error('Invalid admin signature');
                res.status(401).json({ 
                    success: false, 
                    error: 'Unauthorized: Invalid signature' 
                });
                return;
            }
    
            // If signature is valid, proceed to the next middleware or route handler
            next();
        } catch (error) {
            console.error('Error verifying admin signature:', error);
            res.status(401).json({ 
                success: false, 
                error: 'Unauthorized: Authentication failed' 
            });
            return;
        }
    }
    
    secureHttpPost = async (url: string, keyPair: KeyPairHex, body?: any): Promise<any> => {
        let response: any | null = null;
        try {
            const headers = await crypto.buildSecureHeaders(url, keyPair!);
            const requestOptions: RequestInit = {
                method: 'POST',
                headers
            };
        
            // Add body if provided
            if (body) {
                requestOptions.headers = {
                    ...requestOptions.headers,
                    'Content-Type': 'application/json'
                };
                requestOptions.body = JSON.stringify(body);
            }
        
            const res = await fetch(url, requestOptions); 
        
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

    /**
    * Opens the recent attachments page in a new tab with admin authentication
    */
    openRecentAttachments = (keyPair: KeyPairHex) => {
        // Current timestamp
        const timestamp = Date.now().toString();
    
        // Sign the timestamp with the admin private key
        // todo-0: change this to an 'await' style call.
        this.signWithPrivateKey(timestamp, keyPair)
            .then((signature: any) => {
            // Construct the URL with authentication parameters
                const url = `/recent-attachments?timestamp=${timestamp}&signature=${signature}`;
            
                // Open in new tab
                window.open(url, '_blank');
            })
            .catch((error: any) => {
                console.error('Error signing URL:', error);
                alert('Failed to authenticate. Please check your admin credentials.');
            });
    }

    signWithPrivateKey = async (data: string, keyPair: KeyPairHex) => {
        if (!keyPair || !keyPair.privateKey) {
            throw new Error("No private key available");
        }
                    
        // Sign the message hash
        const keyBytes: Uint8Array | null = crypto.importPrivateKey(keyPair.privateKey);
        if (!keyBytes) {
            throw new Error("Invalid private key");
        }
    
        const sigHex = await this.getSigHexOfString(data, keyBytes);
        return sigHex;
    }

    // Takes the hash of 's' and signs it with the private key, returnign the hex of the signature
    getSigHexOfString = async (s: string, keyBytes: Uint8Array) => {
        const hash = this.getHashBytesOfString(s);    
        const sig = await secp.signAsync(hash, keyBytes);    
        return sig.toCompactHex();
    }
}

export const crypto = new Crypto();
