import { crypt } from "../common/Crypto.js";
import { Request, Response } from 'express';
import { SignableObject } from "./CommonTypes.js";

const ADMIN_PUBLIC_KEY = process.env.QUANTA_CHAT_ADMIN_PUBLIC_KEY

class HttpServerUtil {
    verifyReqHTTPSignature = async (req: Request, res: Response, next: any): Promise<void> => {
        const { publicKey }: SignableObject = req.body;
        if (!publicKey) {
            res.status(401).json({ error: 'Public key is not set' });
            return;
        }
        return this.verifyHTTPSignature(req, res, publicKey, next);
    }

    verifyAdminHTTPSignature = async (req: Request, res: Response, next: any): Promise<void> => {
        return this.verifyHTTPSignature(req, res, ADMIN_PUBLIC_KEY!, next);
    }

    // Note: This is AI-Generated implementation for "RFC 9421 - HTTP Message Signatures" which looks ok to me
    // and is working but I haven't fully scrutenized it yet.
    verifyHTTPSignature = async (req: Request, res: Response, publicKey: string, next: any): Promise<void> => {
        try {
            if (!publicKey) {
                res.status(500).json({ error: 'Public key is not set' });
                return;
            }
            const sig = req.headers['signature'];
            const sigInput = req.headers['signature-input'];
        
            if (!sig || !sigInput) {
                res.status(401).json({ error: ' headers' });
                return;
            }
        
            // Parse the signature-input header
            // Format: sig1=("@method" "@target-uri" "@created" "content-type");created=1618884475;keyid="admin-key"
            const sigInputMatch = /sig1=\(([^)]+)\);created=(\d+);keyid="([^"]+)"/.exec(sigInput as string);
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
            let sigBase = '';
        
            // Add covered components to the signature base
            for (const component of coveredComponents.split(' ').map(c => c.replace(/"/g, ''))) {
                if (component === '@method') {
                    sigBase += `"@method": ${req.method.toLowerCase()}\n`;
                } else if (component === '@target-uri') {
                    const targetUri = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
                    sigBase += `"@target-uri": ${targetUri}\n`;
                } else if (component === '@created') {
                    sigBase += `"@created": ${created}\n`;
                } else if (component === 'content-type') {
                    sigBase += `"content-type": ${req.get('content-type')}\n`;
                }
            // Add other components as needed
            }
        
            // Remove trailing newline
            sigBase = sigBase.slice(0, -1);
            const msgHash = crypt.getHashBytesOfString(sigBase);
        
            // DO NOT DELETE: Keep for future debugging purposes
            // console.log('Server signatureBase:['+ JSON.stringify(signatureBase)+"]");
            // console.log('Server message hash:', bytesToHex(messageHash));
            // console.log('Signature received:', signature);
            // console.log('Admin public key:', ADMIN_PUBLIC_KEY);        

            // Verify the signature using our crypto utility
            const isValid = await crypt.verifySignatureBytes(
                msgHash,
                // AI got itself confused about which of these two lines is best.
                Buffer.from(sig as string, 'hex'),            
                publicKey
            );
        
            if (!isValid) {
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }
        
            // If we reach here, signature is valid
            console.log('Signature verified successfully for HTTP endpoint');
            next();
        } catch (error) {
            console.error('Error verifying signature:', error);
            res.status(500).json({ error: 'Signature verification error' });
        }
    };

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
            const curTime = Date.now();
            const reqTime = parseInt(timestamp.toString(), 10);
    
            // Check if timestamp is valid
            if (isNaN(reqTime)) {
                console.error('Invalid timestamp format');
                res.status(401).json({ 
                    success: false, 
                    error: 'Unauthorized: Invalid timestamp' 
                });
                return;
            }
    
            // Check if request is not too old (5 minute window)
            const fiveMinutes = 5 * 60 * 1000;
            if (curTime - reqTime > fiveMinutes) {
                console.error('Request timestamp too old');
                res.status(401).json({ 
                    success: false, 
                    error: 'Unauthorized: Request expired' 
                });
                return;
            }
    
            // Verify the signature using the admin public key
            if (!ADMIN_PUBLIC_KEY) {
                console.error('Admin public key not set');
                res.status(401).json({ 
                    success: false, 
                    error: 'Server configuration error: Admin public key not set' 
                });
                return;
            }
        
            // Create the hash of the timestamp
            const msgHash = crypt.getHashBytesOfString(timestamp.toString());
        
            // Convert the base64 signature to buffer
            const sigBuf = Buffer.from(signature.toString(), 'hex');
        
            // Use your existing verifySignatureBytes method
            const isValid = await crypt.verifySignatureBytes(msgHash, sigBuf, ADMIN_PUBLIC_KEY);
    
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
}

export const httpServerUtil = new HttpServerUtil();    