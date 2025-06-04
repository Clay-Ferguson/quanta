import express, { Request, Response } from 'express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { logInit } from './ServerLogger.js';
import { config } from '../common/Config.js'; 
import { initPlugins, notifyPlugins } from '../common/CommonUtil.js';

logInit();

// this HOST will be 'localhost' or else if on prod 'chat.quanta.wiki'
const HOST = config.get("host"); 
const PORT = config.get("port");

// This is the port for the web app. It will be 'https' for prod, or 'http' for dev on localho
const SECURE = config.get("secure");
const ADMIN_PUBLIC_KEY = config.get("adminPublicKey");

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

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

// DO NOT DELETE. Keep this as an example of how to implement a secure GET endpoint
// app.get('/recent-attachments', httpServerUtil.verifyAdminHTTPQuerySig, (req: any, res: any) => ...return some HTML);

const serveIndexHtml = (page: string = "QuantaChatPage") => (req: Request, res: Response) => {
    fs.readFile("./dist/index.html", 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading index.html:', err);
            return res.status(500).send('Error loading page');
        }

        // Replace the placeholders with actual values
        const result = data
            .replace('{{HOST}}', HOST)
            .replace('{{PORT}}', PORT)
            .replace('{{SECURE}}', SECURE)
            .replace('{{ADMIN_PUBLIC_KEY}}', ADMIN_PUBLIC_KEY)
            .replace(`{{PAGE}}`, page)
            .replace('{{DOC_ROOT_KEY}}', req.params.docRootKey || "")
            .replace('{{DESKTOP_MODE}}', config.get("desktopMode"))

        // Set the content type and send the modified HTML
        res.contentType('text/html');
        res.send(result);
    });
};

// NOTE: It's important to initialize plugins before defining the other routes below.
const plugins = config.get("plugins");
await initPlugins(plugins, {app, serveIndexHtml});

// Serve static files from the dist directory, but disable index serving
app.use(express.static("./dist", { index: false }));

// Fallback for any other routes not handled above
// todo-0: we should handle this better by letting config determine WHICH arg of serveIndexHtml to use
app.get('*', serveIndexHtml(""));

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

await notifyPlugins(plugins, server);
console.log("App init complete.");