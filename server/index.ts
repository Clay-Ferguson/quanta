import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import WebRTCSigServer from './WebRTCSigServer.js';

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

// Initialize WebRTCSigServer signaling server
WebRTCSigServer.getInst(HOST, PORT);


