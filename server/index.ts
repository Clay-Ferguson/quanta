import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import http from 'http';
import {crypt} from '../common/Crypto.js'

// NOTE: In Node.js (non-bundled ESM) we use ".js" extension for imports. This is correct.
import WebRTCSigServer from './WebRTCSigServer.js';
import { DBManager } from './DBManager.js';
import { adminServices } from './AdminServices.js';

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

const ADMIN_PUBLIC_KEY = process.env.QUANTA_CHAT_ADMIN_PUBLIC_KEY;
if (!ADMIN_PUBLIC_KEY) {
    console.warn('QUANTA_CHAT_ADMIN_PUBLIC_KEY environment variable is not set. Admin features will be disabled.');
}
crypt.setAdminPublicKey(ADMIN_PUBLIC_KEY);

// print out all env vars above that we just used
console.log(`Environment Variables:
    QUANTA_CHAT_HOST: ${HOST}
    QUANTA_CHAT_PORT: ${PORT}
    QUANTA_CHAT_SECURE: ${SECURE}
    QUANTA_CHAT_ADMIN_PUBLIC_KEY: ${ADMIN_PUBLIC_KEY}
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

app.post('/api/admin/create-test-data', crypt.verifyAdminHTTPSignature, async (req, res) => {
    try {
        console.log('Admin request: Creating test data');
        await db.createTestData();
        res.json({ success: true, message: 'Test data created successfully' });
    } catch (error) {
        console.error('Error creating test data:', error);
        res.status(500).json({ error: 'Failed to create test data' });
    }
});

app.post('/api/admin/block-user', crypt.verifyAdminHTTPSignature, async (req: any, res: any) => {
    try {
        const { pub_key } = req.body;
        
        if (!pub_key) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing pub_key parameter' 
            });
        }
        
        console.log('Admin request: Blocking user with public key:', pub_key);
        await db.deleteUserContent(pub_key);
        await db.blockUser(pub_key);
                
        res.json({ 
            success: true, 
            message: `User was blocked successfully.` 
        });

    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error while attempting to block user' 
        });
    }
});

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// API endpoint to get message IDs for a specific room
app.get('/api/rooms/:roomId/message-ids', async (req, res) => {
    console.log('getMessageIdsForRoom', req.params.roomId, 'daysOfHistory:', req.query.daysOfHistory);
    await db.getMessageIdsForRoomHandler(req, res);
});

app.get('/api/attachments/:attachmentId', async (req, res) => {
    await db.serveAttachment(req, res);
});

// API endpoint to get messages by their IDs for a specific room
app.post('/api/rooms/:roomId/get-messages-by-id', async (req, res) => {
    console.log('getMessagesByIds for room', req.params.roomId);
    await db.getMessagesByIdsHandler(req, res);
});

app.post('/api/admin/get-room-info', crypt.verifyAdminHTTPSignature, async (req, res) => {
    try {
        console.log('Admin request: Getting room information');
        const roomsInfo = await db.getAllRoomsInfo();
        res.json({ success: true, rooms: roomsInfo });
    } catch (error) {
        console.error('Error getting room information:', error);
        res.status(500).json({ success: false, error: 'Failed to get room information' });
    }
});

// Keep the original endpoint for backward compatibility
// This can be enhanced later to accept optional roomId parameter
app.get('/api/messages', async (req, res) => {
    console.log('getMessageHistory');
    await db.getMessageHistory(req, res);
});

// This is intentionally not doing any React, but just serving a plain HTML page, as an admin
// monitoring capability, but for now we allow public access to this page.
app.get('/recent-attachments', crypt.verifyAdminHTTPQuerySig, (req: any, res: any) => adminServices.getRecentAttachments(db, req, res));

// add '/api/admin/get-recent-attachments' endpoint that returns just the attachments data so we can render this on the client
app.post('/api/admin/get-recent-attachments', crypt.verifyAdminHTTPSignature, async (req: any, res: any) => {
    try {
        console.log('Admin request: Getting recent attachments');
        const attachments = await db.getRecentAttachments();
        res.json({ success: true, attachments });
    } catch (error) {
        console.error('Error getting recent attachments:', error);
        res.status(500).json({ success: false, error: 'Failed to get recent attachments' });
    }
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
            .replace('{{SECURE}}', process.env.QUANTA_CHAT_SECURE || '')
            .replace('{{ADMIN_PUBLIC_KEY}}', process.env.QUANTA_CHAT_ADMIN_PUBLIC_KEY || '');

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
    try {
        const CERT_PATH = process.env.QUANTA_CHAT_CERT_PATH;
        if (!CERT_PATH) {
            throw new Error('QUANTA_CHAT_CERT_PATH environment variable is not set');
        }
        const key = fs.readFileSync(`${CERT_PATH}/privkey.pem`, 'utf8');
        const cert = fs.readFileSync(`${CERT_PATH}/fullchain.pem`, 'utf8');
        server = https.createServer({key, cert}, app);
    } catch (error: any) {
        console.error('Error setting up HTTPS:', error.message);
        throw error;
    }
}
else {
    server = http.createServer(app);
}

server.listen(PORT, () => {
    console.log(`Web Server running on ${HOST}:${PORT}`);
});

const dbPath: string | undefined = process.env.QUANTA_CHAT_DB_FILE_NAME;
if (!dbPath) {
    throw new Error('Database path is not set');
}

const db = await DBManager.getInstance(dbPath);
await WebRTCSigServer.getInst(db, HOST, PORT, server);
