import { ChatMessage} from "./types/CommonTypes.js";
import { WebRTCJoin, WebRTCOffer } from "./types/WebRTCTypes.js";

class Canonicalizer {
    // Helper function for deterministic JSON serialization
    getCanonicalJSON = (obj: any): string => {
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
    
    canonical_ChatMessage = (msg: ChatMessage): string => {
        return this.getCanonicalJSON({
            clz: 'ChatMessage',
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp
        });
    }

    canonical_WebRTCJoin = (msg: WebRTCJoin): string => {
        return this.getCanonicalJSON({
            clz: 'WebRTCJoin',
            room: msg.room,
            userName: msg.user.name
        });
    }

    canonical_WebRTCOffer = (msg: WebRTCOffer): string => {
        return this.getCanonicalJSON({
            clz: 'WebRTCOffer',
            targetUserName: msg.target.name,
            room: msg.room,
            type: msg.offer.type,
            sdp: msg.offer.sdp
        });
    }
}

export const canon = new Canonicalizer();