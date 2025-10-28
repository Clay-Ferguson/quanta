import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import { format } from 'date-fns';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let logFile: string | null = null;
let initDone: boolean = false;
let logger: pino.Logger | null = null;

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Export the logger instance for HTTP middleware usage
export function getLogger(): pino.Logger | null {
    return logger;
}

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

    // Initialize Pino logger for file output only
    // Console output is handled by overriding console.log/error below
    logger = pino({
        level: 'info',
        formatters: {
            level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
            pid: process.pid,
            hostname: os.hostname()
        }
    }, fs.createWriteStream(logFile, { flags: 'a' }));

    // Override console methods to use Pino
    console.log = customLog;
    console.error = customError;
}

// Custom implementation for console.log using Pino
function customLog(...args: any[]) {
    // Always output to original console for Docker/terminal visibility
    originalConsoleLog(...args);

    if (!logger) {
        return;
    }

    // Also log to file via Pino
    if (args.length === 1) {
        const arg = args[0];
        if (typeof arg === 'string') {
            logger.info(arg);
        } else if (typeof arg === 'object') {
            logger.info(arg);
        } else {
            logger.info({ value: arg }, String(arg));
        }
    } else {
        // Multiple arguments - treat first as message, rest as context
        const message = String(args[0]);
        const context = args.slice(1).map(arg => {
            if (typeof arg === 'object') {
                return arg;
            }
            return { value: arg };
        });
        
        if (context.length === 1) {
            logger.info(context[0], message);
        } else {
            logger.info({ context }, message);
        }
    }
}

// Custom implementation for console.error using Pino
function customError(...args: any[]) {
    // Always output to original console for Docker/terminal visibility
    originalConsoleError(...args);

    if (!logger) {
        return;
    }

    // Also log to file via Pino
    if (args.length === 1) {
        const arg = args[0];
        if (arg instanceof Error) {
            logger.error({
                err: {
                    name: arg.name,
                    message: arg.message,
                    stack: arg.stack
                }
            }, arg.message);
        } else if (typeof arg === 'string') {
            logger.error(arg);
        } else if (typeof arg === 'object') {
            logger.error(arg);
        } else {
            logger.error({ value: arg }, String(arg));
        }
    } else {
        // Multiple arguments - extract message and error context
        const message = String(args[0]);
        const errorData: any = {};
        
        for (let i = 1; i < args.length; i++) {
            const arg = args[i];
            if (arg instanceof Error) {
                errorData.err = {
                    name: arg.name,
                    message: arg.message,
                    stack: arg.stack
                };
            } else if (typeof arg === 'object') {
                Object.assign(errorData, arg);
            } else {
                errorData[`arg${i}`] = arg;
            }
        }
        
        logger.error(errorData, message);
    }
}

