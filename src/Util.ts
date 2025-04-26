import { FileBase64Intf } from "../common/CommonTypes";
import { ChatMessage } from "./AppServiceTypes";

class Util {
    log(message: string) {
        console.log(message);
    }

    // Generate a shorter random ID (about 8-10 characters)
    generateShortId = () => {
        const array = new Uint8Array(6); // 6 bytes = ~8 chars in base64
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
    };
}

export const util = new Util();

