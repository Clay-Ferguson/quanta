import { format } from 'date-fns';

// Configuration
const MAX_ITEMS = 5000;
const CLEANUP_COUNT = 500;

// Log storage array
export const logMessages: string[] = [];

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

    // Override console methods
    console.log = customLog;
    console.error = customError;
}

// Remove the oldest log entries when the array gets too large
function pruneLogArray() {
    if (logMessages.length > MAX_ITEMS) {
        logMessages.splice(0, CLEANUP_COUNT);
        const pruneMessage = `${format(new Date(), 'MM-dd-yy h:mm:ssa')} INF: Removed oldest ${CLEANUP_COUNT} log entries to prevent memory issues`;
        logMessages.push(pruneMessage);
        originalConsoleLog(pruneMessage);
    }
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
    
    // Add to log array
    logMessages.push(logMessage);
    pruneLogArray();
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
    
    const logMessage = `${format(new Date(), 'MM-dd-yy h:mm:ss a')}: ***ERROR*** ${message}`;
    
    // Output to original console.error
    originalConsoleError(logMessage);
    
    // Format the error for the log array if it exists
    let errorString = '';
    if (error) {
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
    }
    
    // Add to log array
    logMessages.push(logMessage + errorString);
    pruneLogArray();
}

// Reset logger to original console behavior
export function reset() {
    if (initDone) {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        initDone = false;
    }
}

// Get all logs as a string
export function getLogsAsString(): string {
    return logMessages.join('\n');
}

// Clear all logs
export function clearLogs(): void {
    logMessages.length = 0;
}