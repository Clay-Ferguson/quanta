import { crypt } from "../common/Crypto";
import { KeyPairHex } from "../common/types/CommonTypes";
import { alertModal } from "./components/AlertModalComp";
import { gs } from "./GlobalState";

class HttpClientUtil {
    httpPost = async (url: string, obj: any) => {
        url = encodeURI(url);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(obj)
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch from ${url}: ${res.status} ${res.statusText}`);
        }
        const ret = await res.json();
        return ret;
    }

    httpGet = async (url: string) => {
        url = encodeURI(url);
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Error fetching ${url}: ${res.status} ${res.statusText}`);
        }
        
        const ret = await res.json();
        return ret;
    }

    /**
     * Posts using a digital signature for authentication.
     * 
     * @param url 
     * @param body 
     * @returns null if error, or else the response object
     */
    secureHttpPost = async <TRequest = any, TResponse = any> (url: string, body?: TRequest): Promise<TResponse | null> => {
        const _gs = gs();
        if (!_gs.keyPair) {
            console.error("No key pair available in GlobalState for secure HTTP post");
            return null;
        }

        try {
            const isFormData = body instanceof FormData;
            const headers = await this.buildSecureHeaders(url, _gs.keyPair!, isFormData);
            const opts: RequestInit = {
                method: 'POST',
                headers
            };
            
            // Add body if provided
            if (body) {
                if (isFormData) {
                    // For FormData, don't set Content-Type header - let browser set it with boundary
                    opts.body = body as any;
                } else {
                    opts.headers = {
                        ...opts.headers,
                        'Content-Type': 'application/json'
                    };
                    opts.body = JSON.stringify(body);
                }
            }
            
            url = encodeURI(url);
            // console.log(`>>>> Fetch ${url}:`, JSON.stringify(opts, null, 2));
            const res = await fetch(url, opts); 
            const response = await res.json();
            // console.log(`>>>> RAW Response from ${url}:`, JSON.stringify(response, null, 2));

            if (!res.ok) {
                console.error(`Failed to post to ${url}: error=${response.error} errorMessage=${response.errorMessage}`);
                await alertModal(response.errorMessage || 'An error occurred while processing your request. Please try again later.');
                return null;
            }
            return response;
        } catch (error) {
            console.error(`Error posting to ${url}:`, error);
            // Show the actual error message to the user &&&
            await alertModal('An error occurred while processing your request. Please try again later.');
            return null;
        }
    }
    
    buildSecureHeaders = async (url: string, keyPair: KeyPairHex, isFormData: boolean = false): Promise<Record<string,string>> => {
        // Get the current timestamp in seconds
        const created = Math.floor(Date.now() / 1000);
                        
        // Create the signature-input string - exclude content-type for FormData since browser sets boundary
        const components = isFormData ? 
            `"@method" "@target-uri" "@created"` : 
            `"@method" "@target-uri" "@created" "content-type"`;
        const sigInput = `sig1=(${components});created=${created};keyid="admin-key"`;
                        
        // Build the signature base
        let sigBase = '';
        sigBase += `"@method": post\n`;
        sigBase += `"@target-uri": ${window.location.origin}${encodeURI(url)}\n`;
        sigBase += `"@created": ${created}`;
        
        // Only include content-type in signature for JSON requests
        if (!isFormData) {
            sigBase += `\n"content-type": application/json`;
        }
            
        if (!keyPair || !keyPair.privateKey) {
            throw new Error("No private key available");
        }
                        
        // Sign the message hash
        const privKeyBytes = crypt.importPrivateKey(keyPair.privateKey);
        if (!privKeyBytes) {
            throw new Error("Invalid private key");
        }
                        
        const signatureHex: string = await crypt.getSigHexOfString(sigBase, privKeyBytes);
                        
        // DO NOT DELETE: Keep for future debugging.
        // console.log('Client signatureBase:['+JSON.stringify(signatureBase)+']');
        // console.log('Client message hash:', bytesToHex(messageHash));
        // console.log('Signature generated:', signatureHex);
        // console.log('Admin public key:', this.adminPublicKey);
    
        const headers: Record<string, string> = {
            'Signature-Input': sigInput,
            'Signature': signatureHex,
            'public-key': keyPair.publicKey, // warning: the HTTP stack will force to lower case.
        };

        // Only set Content-Type for JSON requests, not FormData
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        return headers;
    }
}

export const httpClientUtil = new HttpClientUtil();    