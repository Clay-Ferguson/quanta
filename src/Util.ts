import { ChatMessage, FileBase64Intf } from "../common/types/CommonTypes";

class Util {
    resizeEffect = () => {
        // Handle viewport height for mobile browsers
        const updateHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
            
        // Set initial height
        updateHeight();
            
        // Update on resize and orientation change
        window.addEventListener('resize', updateHeight);
        window.addEventListener('orientationchange', updateHeight);
            
        // Add extra trigger for iOS Safari - it sometimes needs a delay
        setTimeout(updateHeight, 100);
            
        return () => {
            window.removeEventListener('resize', updateHeight);
            window.removeEventListener('orientationchange', updateHeight);
        };
    }

    stubbornScroll = (elm: any, pos: number) => {
        if (!elm) return;
        elm.scrollTop = pos;
        const scrollFunc = () => {
            elm.scrollTop = pos;
        };
        
        // Additional scroll attempts with increasing delays
        setTimeout(scrollFunc, 0);
        setTimeout(scrollFunc, 1500);
    }

    // Generate a shorter random ID
    generateShortId = () => {
        const array = new Uint8Array(12);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '');
    };

    // Utility function to get URL parameters
    getUrlParameter(name: string) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    formatMessageTime = (msg: ChatMessage) => {
        return new Date(msg.timestamp).toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
        })+" "+
        new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    fileToBase64(file: File): Promise<FileBase64Intf> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                data: reader.result as string
            });
            reader.onerror = error => reject(error);
        });
    };

    onAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        // Replace with icon if image fails to load
        const target = e.currentTarget as HTMLImageElement;
        target.style.display = 'none';
        (target.nextElementSibling! as any).style.display = 'flex';
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    formatStorageSize(bytes: number) {
        if (bytes === 0) return '0 B';

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        // Return with 2 decimal places for MB and above, 0 for KB and B
        if (i >= 2) {
            return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
        } else {
            return (bytes / Math.pow(1024, i)).toFixed(0) + ' ' + units[i];
        }
    }

    downloadFile(attachment: FileBase64Intf) {
        const downloadLink = document.createElement('a');
        downloadLink.href = attachment.data;
        downloadLink.download = attachment.name;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    // Calculate the size of a message object in bytes
    calculateMessageSize(msg: any) {
        let totalSize = 0;
    
        // Text content size
        if (msg.content) {
            totalSize += new Blob([msg.content]).size;
        }
    
        // Metadata size (sender, timestamp, etc.)
        totalSize += new Blob([JSON.stringify({
            sender: msg.sender,
            timestamp: msg.timestamp
        })]).size;
    
        // Attachments size
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach((attachment: any) => {
                // Base64 data URLs are approximately 33% larger than the original binary
                // The actual data portion is after the comma in "data:image/jpeg;base64,..."
                if (attachment.data) {
                    const dataUrl = attachment.data;
                    const base64Index = dataUrl.indexOf(',') + 1;
                    if (base64Index > 0) {
                        const base64Data = dataUrl.substring(base64Index);
                        // Convert from base64 size to binary size (approx)
                        totalSize += Math.floor((base64Data.length * 3) / 4);
                    } else {
                        // Fallback if data URL format is unexpected
                        totalSize += new Blob([dataUrl]).size;
                    }
                }
    
                // Add size of attachment metadata
                totalSize += new Blob([JSON.stringify({
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size
                })]).size;
            });
        }
        return totalSize;
    }
}

export const util = new Util();

