import { crypt } from "../common/Crypto.js";
import { Request, Response } from 'express';
import { UserProfileCompact } from "../common/types/CommonTypes.js";
import { config } from "./Config.js";
import { dbUsers } from "./DBUsers.js";
import { AuthenticatedRequest } from "./HttpTypes.js";

const ADMIN_PUBLIC_KEY = config.get("adminPublicKey");

/**
 * Utility class for HTTP signature verification and authentication middleware.
 * Implements RFC 9421 - HTTP Message Signatures for secure API authentication.
 * Provides methods for verifying both request body signatures and query parameter signatures.
 */
class HttpServerUtil {
    /**
     * Express middleware that verifies HTTP signatures using the public key from the request body.
     * Extracts the public key from req.body and delegates to verifyHTTPSignature.
     * 
     * @param req - Express request object containing the public key in the body
     * @param res - Express response object for sending error responses
     * @param next - Express next function to continue to the next middleware
     * @returns Promise<void> 
     */
    verifyReqHTTPSignature = async (req: Request, res: Response, next: any): Promise<void> => {
        // get publicKey from request headers
        const publicKey = req.headers['public-key'] as string;
        if (!publicKey) {
            // console.log('public-key header not found: Request headers:', req.headers);    
            res.status(401).json({ error: 'Public key is not set in request body or header' });
            return;
        }
        
        return this.verifyHTTPSignature(req, res, publicKey, false, next);
    }

    /* NOTE: Allow anon means there need not be a UserProfile stored in the database yet fo the public key, but the request
    still must be signed with some key. Users DO have to have crypto running in browser. */
    verifyReqHTTPSignatureAllowAnon = async (req: Request, res: Response, next: any): Promise<void> => {
        // get publicKey from request headers
        const publicKey = req.headers['public-key'] as string;
        // console.log('verifyReqHTTPSignatureAllowAnon: publicKey:', publicKey);
        if (!publicKey) {
            throw new Error('Public key is not set in request body or header');
        }
        
        return this.verifyHTTPSignature(req, res, publicKey, true, next);
    }

    /**
     * Express middleware that verifies HTTP signatures using the admin public key.
     * Uses the ADMIN_PUBLIC_KEY environment variable for signature verification.
     * 
     * @param req - Express request object
     * @param res - Express response object for sending error responses
     * @param next - Express next function to continue to the next middleware
     * @returns Promise<void>
     */
    verifyAdminHTTPSignature = async (req: Request, res: Response, next: any): Promise<void> => {
        return this.verifyHTTPSignature(req, res, ADMIN_PUBLIC_KEY!, false, next);
    }

    /**
     * Core HTTP signature verification method implementing RFC 9421 - HTTP Message Signatures.
     * Verifies the signature and signature-input headers against the provided public key.
     * 
     * The signature-input header format: sig1=("@method" "@target-uri" "@created" "content-type");created=1618884475;keyid="admin-key"
     * 
     * Validation includes:
     * - Public key presence
     * - Required headers (signature, signature-input)
     * - Signature-input format parsing
     * - Key ID verification (must be "admin-key")
     * - Timestamp validation (within 2-minute window)
     * - Signature base construction and verification
     * 
     * Note: This is AI-Generated implementation for "RFC 9421 - HTTP Message Signatures" which looks ok to me
     * and is working but I haven't fully scrutenized it yet.
     * 
     * @param req - Express request object containing headers and request data
     * @param res - Express response object for sending error responses
     * @param publicKey - The public key to use for signature verification
     * @param next - Express next function to continue to the next middleware
     * @returns Promise<void>
     */
    verifyHTTPSignature = async (req: Request, res: Response, publicKey: string, allowAnon: boolean, next: any): Promise<void> => {
        try {
            // console.log('verifyHTTPSignature: publicKey:', publicKey);
            if (!publicKey) {
                throw new Error('Public key is not set in request body or header');
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
        
            // Remove trailing newline if present
            if (sigBase.endsWith('\n')) {
                sigBase = sigBase.slice(0, -1);
            }
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

            // This is required so that we can let the user save a UserProfile knowing that they're the owner of the private key.
            (req as AuthenticatedRequest).validSignature = true;
           
            const userProfile: UserProfileCompact | null = await dbUsers.getUserProfileCompact(publicKey);
            if (userProfile) {
                // console.log('User profile found for public key:', publicKey);
                // Store userProfile in the request object for use in downstream middleware and route handlers
                (req as AuthenticatedRequest).userProfile = userProfile;
            }       
            else {
                if (!allowAnon) {
                    res.status(401).json({ error: 'Unauthorized: User profile not found' });
                    return;
                }
                // console.warn('User profile not found for public key (treating as ANON USER)', publicKey);
            } 
            
            next();
        } catch (error) {
            console.error('Error verifying signature:', error);
            res.status(500).json({ error: 'Signature verification error' });
        }
    };

    /**
     * Express middleware for verifying admin signature in query parameters (designed for GET requests).
     * Validates timestamp and signature query parameters against the admin public key.
     * 
     * Expected query parameters:
     * - auth: Signed data formatted like be formatted like `${timestamp}-${publicKey}`
     * - signature: Hex-encoded signature of the 'auth' text
     *
     * @param req - Express request object containing timestamp and signature in query parameters
     * @param res - Express response object for sending error responses
     * @param next - Express next function to continue to the next middleware
     * @returns Promise<void>
     */
    verifyReqHTTPQuerySig = async (req: Request, res: Response, next: any): Promise<void> => {
        const { auth, signature } = req.query;

        // Validate required parameters
        if (!auth || !signature) {
            console.error('Missing authentication parameters');
            res.status(401).json({ 
                error: 'Unauthorized: Missing authentication parameters' 
            });
            return;
        }

        // The 'auth' will be formatted like `${timestamp}-${publicKey}`
        const [timestamp, publicKey] = (auth as string).split('-');

        try {
            // Make sure timestamp is not too old (e.g., 5 minutes)
            const curTime = Date.now();
            const reqTime = parseInt(timestamp.toString(), 10);
    
            // Check if timestamp is valid
            if (isNaN(reqTime)) {
                console.error('Invalid timestamp format');
                res.status(401).json({ 
                    error: 'Unauthorized: Invalid timestamp' 
                });
                return;
            }
    
            // Check if request is not too old (5 minute window)
            const fiveMinutes = 5 * 60 * 1000;
            if (curTime - reqTime > fiveMinutes) {
                console.error('Request timestamp too old');
                res.status(401).json({ 
                    error: 'Unauthorized: Request expired' 
                });
                return;
            }
        
            // Create the hash of the auth string
            const msgHash = crypt.getHashBytesOfString(auth as string);
        
            // Convert the base64 signature to buffer
            const sigBuf = Buffer.from(signature.toString(), 'hex');
        
            // Use your existing verifySignatureBytes method
            const isValid = await crypt.verifySignatureBytes(msgHash, sigBuf, publicKey);
    
            if (!isValid) {
                console.error('Invalid admin signature');
                res.status(401).json({ 
                    error: 'Unauthorized: Invalid signature' 
                });
                return;
            }
    
            const userProfile: UserProfileCompact | null = await dbUsers.getUserProfileCompact(publicKey);
            if (userProfile) {
                // Store userProfile in the request object for use in downstream middleware and route handlers
                (req as AuthenticatedRequest).userProfile = userProfile;
            }       

            // If signature is valid, proceed to the next middleware or route handler
            next();
        } catch (error) {
            console.error('Error verifying admin signature:', error);
            res.status(401).json({ 
                error: 'Unauthorized: Authentication failed' 
            });
            return;
        }
    }
}

/**
 * Singleton instance of HttpServerUtil for use throughout the application.
 * Provides access to HTTP signature verification middleware methods.
 */
export const httpServerUtil = new HttpServerUtil();