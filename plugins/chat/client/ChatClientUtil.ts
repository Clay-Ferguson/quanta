import { ChatMessage } from "../common/CommonTypes";

export const formatMessageTime = (msg: ChatMessage) => {
    return new Date(msg.timestamp).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: '2-digit' 
    })+" "+
        new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
