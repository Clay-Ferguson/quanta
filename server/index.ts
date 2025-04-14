import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import http from 'http';

// NOTE: In Node.js (non-bundled ESM) we use ".js" extension for imports. This is correct.
import WebRTCSigServer from './WebRTCSigServer.js';
import WebRTCSigServer_Legacy from './WebRTCSigServer_Legacy.js';
import { DBManager } from './DBManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// this HOST will be 'localhost' or else if on prod 'chat.quanta.wiki'
const HOST = process.env.QUANTA_CHAT_HOST;
if (!HOST) {
    throw new Error('QUANTA_CHAT_HOST environment variable is not set');
}

// This is the port for the web app. It will be 443 for prod, or 80 for dev on localhost
const PORT = process.env.QUANTA_CHAT_PORT;
if (!PORT) {
    throw new Error('QUANTA_CHAT_PORT environment variable is not set');
}

// This is the port for the web app. It will be 'https' for prod, or 'http' for dev on localho
const SECURE = process.env.QUANTA_CHAT_SECURE;
if (!SECURE) {
    throw new Error('QUANTA_CHAT_SECURE environment variable is not set');
}

// print out all env vars above that we just used
console.log(`Environment Variables:
    QUANTA_CHAT_HOST: ${HOST}
    QUANTA_CHAT_PORT: ${PORT}
    QUANTA_CHAT_SECURE: ${SECURE}
`);

app.use(express.json());

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

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// API endpoint to get message history
app.get('/api/messages', async (req, res) => {
    console.log('getMessageHistory');
    const ret = await db.getMessageHistory(req, res);
    res.json(ret);
});

const distPath = path.join(__dirname, '../../dist');

const serveIndexHtml = (req: Request, res: Response) => {
    const filePath = path.resolve(distPath, 'index.html');

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading index.html:', err);
            return res.status(500).send('Error loading page');
        }

        // Replace the placeholders with actual values
        const result = data
            .replace('{{HOST}}', process.env.QUANTA_CHAT_HOST || '')
            .replace('{{PORT}}', process.env.QUANTA_CHAT_PORT || '')
            .replace('{{SECURE}}', process.env.QUANTA_CHAT_SECURE || '');

        // Set the content type and send the modified HTML
        res.contentType('text/html');
        res.send(result);
    });
};

// Define HTML routes BEFORE static middleware
// Explicitly serve index.html for root path
app.get('/', serveIndexHtml);

// Serve static files from the dist directory, but disable index serving
app.use(express.static(distPath, { index: false }));

// Fallback for any other routes not handled above
app.get('*', serveIndexHtml);

let server = null;

if (SECURE === 'y') {
    console.log('HTTPS in use. (secure)');
    // --- HTTPS Configuration ---
    // todo-0: put the path to these in an env var
    const privateKeyPath = '/etc/letsencrypt/live/chat.quanta.wiki/privkey.pem';
    const certificatePath = '/etc/letsencrypt/live/chat.quanta.wiki/fullchain.pem';

    try {
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        const certificate = fs.readFileSync(certificatePath, 'utf8');

        const credentials = {
            key: privateKey,
            cert: certificate
        };

        server = https.createServer(credentials, app);
    } catch (error: any) {
        console.error('Error setting up HTTPS:', error.message);
        throw error;
    }
}
else {
    console.log('HTTP in use. (insecure)');
    server = http.createServer(app);
}

server.listen(PORT, () => {
    console.log(`Web Server running on ${HOST}:${PORT}`);
});

// WARNING: This same variable exists on Client and Server and must match, to determine which WebRTC implementation to use, and these
// need to both match. That is, if you change to Legacy version you need to change on both server code and client code.
const useLegacyWebRTC = false;

const dbPath: string | undefined = process.env.QUANTA_CHAT_DB_FILE_NAME;
if (!dbPath) {
    throw new Error('Database path is not set');
}

const db = await DBManager.getInstance(dbPath);

// Initialize WebRTCSigServer signaling server
if (useLegacyWebRTC) {
    await WebRTCSigServer_Legacy.getInst(HOST, PORT);
}
else {
    await WebRTCSigServer.getInst(db, HOST, PORT, server);
}
