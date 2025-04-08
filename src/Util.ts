class Util {
    private static inst: Util | null = null;

    constructor() {
        console.log('Util singleton created');
    }

    static getInst() {
        if (!Util.inst) {
            Util.inst = new Util();
        }
        return Util.inst;
    }

    log(message: string) {
        console.log(message);
    }

    // Utility function to get URL parameters
    getUrlParameter(name: string) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    fileToBase64(file: File): Promise<{
        name: string;
        type: string;
        size: number;
        data: string;
    }> {
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
}

export default Util;
