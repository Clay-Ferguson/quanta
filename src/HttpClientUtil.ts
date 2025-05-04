import { crypt } from "../common/Crypto";
import { KeyPairHex } from "../common/CryptoIntf";

class HttpClientUtil {
    httpPost = async (url: string, obj: any) => {
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
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`Error fetching ${url}: ${res.status} ${res.statusText}`);
        }
        
        const ret = await res.json();
        return ret;
    }

    secureHttpPost = async (url: string, keyPair: KeyPairHex, body?: any): Promise<any> => {
        if (!keyPair.publicKey) {
            console.error("Attempting secure post with invalid keyPair");
        }
        if (!body.publicKey) {
            body.publicKey = keyPair.publicKey;
        }
        console.log(`secureHttpPost: ${url} publicKey=${keyPair.publicKey}`);

        let response: any | null = null;
        try {
            const headers = await this.buildSecureHeaders(url, keyPair!);
            const opts: RequestInit = {
                method: 'POST',
                headers
            };
            
            // Add body if provided
            if (body) {
                opts.headers = {
                    ...opts.headers,
                    'Content-Type': 'application/json'
                };
                opts.body = JSON.stringify(body);
            }
            
            const res = await fetch(url, opts); 
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
    
    buildSecureHeaders = async (url: string, keyPair: KeyPairHex): Promise<Record<string,string>> => {
        // Get the current timestamp in seconds
        const created = Math.floor(Date.now() / 1000);
                        
        // Create the signature-input string
        const sigInput = `sig1=("@method" "@target-uri" "@created" "content-type");created=${created};keyid="admin-key"`;
                        
        // Build the signature base
        let sigBase = '';
        sigBase += `"@method": post\n`;
        sigBase += `"@target-uri": ${window.location.origin}${url}\n`;
        sigBase += `"@created": ${created}\n`;
        sigBase += `"content-type": application/json`;  
            
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
    
        return {
            'Content-Type': 'application/json',
            'Signature-Input': sigInput,
            'Signature': signatureHex
        };
    }
    
}

export const httpClientUtil = new HttpClientUtil();    