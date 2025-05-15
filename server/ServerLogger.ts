import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { format } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let logFile: string | null = null;
let initDone: boolean = false;

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

export function logInit() {
    if (initDone) {
        originalConsoleError('Error: Logger is already initialized');
        return;
    }
    initDone = true;
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Format: server-MM-DD-YY.log
    logFile = path.join(logDir, `server-${format(new Date(), 'MM-dd-yy')}.log`);
   
    // if logFile is not ok show an error message
    if (!logFile) {
        originalConsoleError('Error: logFile is not set');
        return;
    }

    // Override console methods
    console.log = customLog;
    console.error = customError;
}

// Custom implementation for console.log
function customLog(...args: any[]) {
    // Process each argument appropriately
    const processedArgs = args.map(arg => {
        if (arg === null) {
            return 'null';
        } else if (arg === undefined) {
            return 'undefined';
        } else if (typeof arg === 'object') {
            try {
                // For objects, create pretty JSON with 4-space indentation
                return '\n' + JSON.stringify(arg, null, 4);
            } 
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            catch (err) {
                return String(arg); // Fallback if JSON stringification fails
            }
        } else {
            return String(arg);
        }
    });
    
    const message = processedArgs.join(' ');
    const logMessage = `${format(new Date(), 'MM-dd-yy h:mm:ss a')}: ${message}`;
    
    // Output to original console.log
    originalConsoleLog(logMessage);
    
    // Write to log file
    if (logFile) {
        fs.appendFileSync(logFile, logMessage + '\n');
    }
}

// Custom implementation for console.error
function customError(...args: any[]) {    
    // Extract message and error if available
    let message: string;
    let error: any = null;
    
    if (args.length >= 2 && args[1] instanceof Error || typeof args[1] === 'object') {
        message = String(args[0]);
        error = args[1];
    } else {
        message = args.map(arg => String(arg)).join(' ');
    }
    
    let logMessage = `${format(new Date(), 'MM-dd-yy h:mm:ss a')}: *** ERROR *** ${message}`;
    
    // Format the error for the log file if it exists
    if (error) {
        if (error instanceof Error) {
            logMessage += `\n  ${error.message}`;

            // if stack is empty or contains no newlines, add a new stack trace
            if (!error.stack || error.stack.indexOf('\n') === -1) { 
                logMessage += `\n  Stack: ${new Error().stack}`;
            }
            else {
                logMessage += `\n  Stack: ${error.stack}`;
            }
        } else if (typeof error === 'object') {
            try {
                logMessage = `\n  ${JSON.stringify(error, null, 2)}`;
            } catch {
                logMessage = `\n  ${String(error)}`;
            }
        } else {
            logMessage = `\n  ${String(error)}`;
        }
    }

    // Output to original console.error
    originalConsoleError(logMessage);
    
    // Write to log file
    if (logFile) {
        fs.appendFileSync(logFile, logMessage + '\n');
    }
}

