import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// NOTE: In Node.js (non-bundled ESM) we use ".js" extension for imports. This is correct.
import WebRTCSigServer from './WebRTCSigServer.js';
import WebRTCSigServer_Legacy from './WebRTCSigServer_Legacy.js';
import { DBManager } from './DBManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const HOST = process.env.QUANTA_CHAT_HOST || 'localhost';
const PORT = process.env.QUANTA_CHAT_PORT || '8080';
const HTTP_PORT = process.env.QUANTA_CHAT_HTTP_PORT || 8000;

app.use(express.json());

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
            .replace('{{HOST}}', process.env.QUANTA_CHAT_HOST || 'localhost')
            .replace('{{PORT}}', process.env.QUANTA_CHAT_PORT || '8080');
    
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

// Start the server
app.listen(HTTP_PORT, () => {
    console.log(`Server running on http://${HOST}:${HTTP_PORT}`);
});

// WARNING: This same variable exists on Client and Server and must match, to determine which WebRTC implementation to use, and these
// need to both match. That is, if you change to Legacy version you need to change on both server code and client code.
const useLegacyWebRTC = false;

const db = await DBManager.getInstance();

// Initialize WebRTCSigServer signaling server
if (useLegacyWebRTC) {
    await WebRTCSigServer_Legacy.getInst(HOST, PORT);}
else {
    await WebRTCSigServer.getInst(db, HOST, PORT);
}


