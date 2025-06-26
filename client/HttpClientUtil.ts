import { crypt } from "../common/Crypto";
import { KeyPairHex } from "../common/types/CommonTypes";
import { alertModal } from "./components/AlertModalComp";
import { gs } from "./GlobalState";

class HttpClientUtil {
    httpPost = async (url: string, obj: any) => {
        // encode the url
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

        let response: TResponse | null = null;
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
            const res = await fetch(url, opts); 
            // // pretty print the response object using formatted JSON
            // console.log(`>>>> RAW Response from ${url}:`, JSON.stringify(res, null, 2));

            if (res.ok) {
                response = await res.json();
            }
            else {
                const errorData = await res.json();
                const msg = `Failed to post to ${url}: ${errorData.error || 'Unknown error'}`;
                console.error(msg);

                // Show a less frightening error message to the user
                await alertModal("An error occurred while processing your request. Please try again later.");
                return null;
            }
        } catch (error) {
            console.error(`Error posting to ${url}:`, error);
        }
        return response;
    }
    
    // todo-1: all calls to this can now remove 'publicKey' from the body of the post, but be careful
    //         because some of the actual methods (might still rely on the body argument even though it's now not 
    //         used in the signature generation).
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
        sigBase += `"@target-uri": ${window.location.origin}${url}\n`;
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