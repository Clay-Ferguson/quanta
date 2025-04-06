class Util {
    private static inst: Util | null = null;

    constructor() {
        console.log('Util singleton created');
    }

    static getInst() {
        // Create instance if it doesn't exist
        if (!Util.inst) {
            Util.inst = new Util();
        }

        return Util.inst;
    }

    log(message: string) {
        console.log(message);
    }

    // todo-0: used to set innerHTML, needs to be sanitized to protect against injection attacks.
    renderContent(content: string) {
        return content; // todo-0: add marked here, from an import
        // return (typeof marked !== 'undefined')
        //     ? marked.parse(content)
        //     : content.replace(/\n/g, '<br>')
    }

    // Utility function to get URL parameters
    getUrlParameter(name: string) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // Convert file to base64 for storage
    // todo-0: need better typesafety on 'file' here.
    fileToBase64(file: any) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                data: reader.result
            });
            reader.onerror = error => reject(error);
        });
    }

    // Helper function to format file size
    formatFileSize(bytes: number) {
        if (bytes < 1024) return bytes + ' bytes';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

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
