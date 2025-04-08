import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
    private static inst: Logger | null = null;
    logFile: string | null = null;

    constructor() {
        console.log('Logger singleton created');
    }

    static getInst() {
        // Create instance if it doesn't exist
        if (!Logger.inst) {
            Logger.inst = new Logger();
            Logger.inst.init();
        }
        return Logger.inst;
    }

    async init() {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this.logFile = path.join(logDir, `server-${new Date().toISOString().split('T')[0]}.log`);
    }

    logInfo = (message: string) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [INFO] ${message}`;
        console.log(logMessage);

        if (this.logFile) {
            fs.appendFileSync(this.logFile, logMessage + '\n');
        }
    }

    logError = (message: string, error: any=null) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [ERROR] ${message}`;
        
        if (error) {
            console.error(logMessage, error);
            
            // Format the error for the log file
            let errorString = '';
            if (error instanceof Error) {
                errorString = `\n  Error: ${error.message}\n  Stack: ${error.stack}`;
            } else if (typeof error === 'object') {
                try {
                    errorString = `\n  ${JSON.stringify(error, null, 2)}`;
                } catch {
                    errorString = `\n  ${String(error)}`;
                }
            } else {
                errorString = `\n  ${String(error)}`;
            }
            
            // Write to log file with error details included
            if (this.logFile) {
                fs.appendFileSync(this.logFile, logMessage + errorString + '\n');
            }
        } else {
            console.error(logMessage);
            
            if (this.logFile) {
                fs.appendFileSync(this.logFile, logMessage + '\n');
            }
        }
    }
}

export default Logger;
