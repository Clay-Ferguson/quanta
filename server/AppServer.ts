import express, { Request, Response } from 'express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import pinoHttp from 'pino-http';
import { logInit, getLogger } from './ServerLogger.js';
import { config } from './Config.js'; 
import { svrUtil, asyncHandler } from './ServerUtil.js';
import { httpServerUtil } from './HttpServerUtil.js';
import pgdb from './db/PGDB.js';
import { dbUsers } from './DBUsers.js';
import { runAllTests } from './app.test.js';

logInit();

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error: Error) => {
    console.error('UNCAUGHT EXCEPTION - Server will continue running:', error);
    console.error('Stack trace:', error.stack);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('UNHANDLED PROMISE REJECTION:', reason);
    console.error('Promise:', promise);
});

// this HOST will be 'localhost' or else if on prod 'quanta.wiki'
const HOST = config.get("host"); 
const PORT = config.get("port");
const CLIENT_HOST = config.get("clientHost"); // This is the host for the web app, used in the client-side code

// This is the port for the web app. It will be 'https' for prod, or 'http' for dev on localho
const SECURE = config.get("secure");
const ADMIN_PUBLIC_KEY = config.get("adminPublicKey");

if (process.env.POSTGRES_HOST) {
    await pgdb.initDb();
}

const app = express();

// Initialize HTTP request/response logging with Pino
const logger = getLogger();
if (logger) {
    // Use type assertion to work around TypeScript import issues
    const pinoHttpLogger = (pinoHttp as any)({
        logger,
        autoLogging: true
    });

    app.use(pinoHttpLogger);
}
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Global error handling middleware for Express
app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
    console.error('EXPRESS ERROR HANDLER:', err);
    console.error('Request URL:', req.url);
    console.error('Request method:', req.method);
    console.error('Stack trace:', err.stack);

    // Don't send response if headers are already sent
    if (res.headersSent) {
        return next(err);
    }

    // Send appropriate error response
    const isApiRequest = req.url.startsWith('/api/');
    if (isApiRequest) {
        res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred while processing your request',
        });
    } else {
        const errorHtml = `
            <html>
                <head><title>Server Error</title></head>
                <body>
                    <h1>Server Error</h1>
                    <p>An unexpected error occurred while processing your request. Please try again later.</p>
                    <p>Error ID: ${Date.now()}</p>
                </body>
            </html>
        `;
        res.status(500).contentType('text/html').send(errorHtml);
    }
});

// Add HTTP to HTTPS redirect if using HTTPS
if (SECURE === 'y') {
    app.use((req, res, next) => {
        // Check if the request is already secure
        if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
            next();
        } else {
            // Redirect to HTTPS
            res.redirect(`https://${HOST}:${PORT}${req.url}`);
        }
    });
}

const plugins = config.get("plugins") || [];
// get commma delimited list of plugin 'key' values into a string
const pluginKeys = plugins.map((plugin: any) => plugin.key).join(','); 
console.log(`Plugins loaded: ${pluginKeys}`);

const serveIndexHtml = (page: string) => (req: Request, res: Response) => {
    fs.readFile("./dist/server/index.html", 'utf8', async (err, data) => {
        if (err) {
            console.error('Error reading index.html:', err);
            return res.status(500).send('Error loading page');
        }
        
        try {
            console.log(`Serving index.html for page: ${page}`);

            for (const plugin of svrUtil.pluginsArray) {
                data = await plugin.preProcessHtml(data, req);
            }

            // Replace the placeholders with actual values
            const result = data
                .replace('{{HOST}}', HOST)
                .replace('{{CLIENT_HOST}}', CLIENT_HOST)
                .replace('{{PORT}}', PORT)
                .replace('{{SECURE}}', SECURE)
                .replace('{{ADMIN_PUBLIC_KEY}}', ADMIN_PUBLIC_KEY)
                .replace(`{{PAGE}}`, page)
                .replace('{{DESKTOP_MODE}}', config.get("desktopMode"))
                .replace('{{PLUGINS}}', pluginKeys)
                .replace('{{DEFAULT_PLUGIN}}', config.get("defaultPlugin") || "");

            // Set the content type and send the modified HTML
            res.contentType('text/html');
            res.send(result);
        } catch (error) {
            console.error('Error processing page request:', error);
            const errorMessage = `
                <html>
                    <head><title>Server Error</title></head>
                    <body>
                        <h1>Server Error</h1>
                        <p>An error occurred while processing your request. Please try again later.</p>
                    </body>
                </html>
            `;
            res.status(500).contentType('text/html').send(errorMessage);
        }
    });
};

app.post('/api/admin/run-cmd/', httpServerUtil.verifyAdminHTTPSignature, asyncHandler(svrUtil.runAdminCommand)); 
app.post('/api/users/info', httpServerUtil.verifyReqHTTPSignatureAllowAnon, asyncHandler(dbUsers.saveUserProfile)); 
app.get('/api/users/:pubKey/info', asyncHandler(dbUsers.getUserProfileReq));
app.get('/api/users/:pubKey/avatar', asyncHandler(dbUsers.serveAvatar));

if (process.env.POSTGRES_HOST) {
    // NOTE: This MUST be called before 'initPlugins'
    await pgdb.loadAdminUser();
}

// NOTE: It's important to initialize plugins before defining the other routes below.
await svrUtil.initPlugins(plugins, {app, serveIndexHtml});

// Serve static files from the dist directory, but disable index serving
app.use(express.static("./dist", { index: false }));

let server = null;

// PRODUCTION: run on 'https' with certificates
if (SECURE === 'y') {
    try {
        const CERT_PATH = config.get("certPath");
        const key = fs.readFileSync(`${CERT_PATH}/privkey.pem`, 'utf8');
        const cert = fs.readFileSync(`${CERT_PATH}/fullchain.pem`, 'utf8');
        server = https.createServer({key, cert}, app);
    } catch (error: any) {
        console.error('Error setting up HTTPS:', error.message);
        throw error;
    }
}
// LOCALHOST: For development/testing, run on 'http', without certificates
else {
    server = http.createServer(app);
}

server.listen(PORT, () => {
    console.log(`Web Server running on ${HOST}:${PORT}`);
});

await svrUtil.notifyPlugins(plugins, server);

// Graceful shutdown function
const gracefulShutdown = async () => {
    console.log('Shutting down gracefully...');
    
    try {
        // Close the HTTP/HTTPS server
        if (server) {
            await new Promise<void>((resolve, reject) => {
                server.close((err) => {
                    if (err) {
                        console.error('Error closing server:', err);
                        reject(err);
                    } else {
                        console.log('Server closed successfully');
                        resolve();
                    }
                });
            });
        }

        // Close database connections if they exist
        if (process.env.POSTGRES_HOST && pgdb) {
            await pgdb.close();
            console.log('Database connections closed');
        }

        console.log('Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Run tests if configured and in development environment ONLY
if (config.get("runTests") === "y" && process.env.QUANTA_ENV === "dev") {
    await runAllTests();

    // Check if any tests failed and shutdown if so, or if explicitly configured to exit
    if (config.get("exitAfterTest") === "y") {
        await gracefulShutdown();
    }
}

console.log("App init complete.");

// Warn if no plugins are installed
if (!plugins || plugins.length === 0) {
    console.warn("WARNING: No plugins are installed. At least one plugin is required for the application to function.");
}

