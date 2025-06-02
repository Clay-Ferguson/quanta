import express, { Request, Response } from 'express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { httpServerUtil } from '../common/HttpServerUtil.js';
import {chatSvc} from './ChatService.js';
import { rtc } from './WebRTCServer.js';
import { logInit } from './ServerLogger.js';
import { docSvc } from './DocService.js';
import { config } from '../common/Config.js'; 

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

app.get('/api/rooms/:roomId/message-ids', chatSvc.getMessageIdsForRoom);
app.get('/api/attachments/:attachmentId', chatSvc.serveAttachment);
app.get('/api/messages', chatSvc.getMessageHistory);
app.get('/api/users/:pubKey/info', chatSvc.getUserProfile);
app.get('/api/users/:pubKey/avatar', chatSvc.serveAvatar);
app.get('/api/docs/render/:docRootKey/*', docSvc.treeRender);
app.get('/api/docs/images/:docRootKey/*', docSvc.serveDocImage);

app.post('/api/admin/get-room-info', httpServerUtil.verifyAdminHTTPSignature, chatSvc.getRoomInfo);
app.post('/api/admin/delete-room', httpServerUtil.verifyAdminHTTPSignature, chatSvc.deleteRoom);
app.post('/api/admin/get-recent-attachments', httpServerUtil.verifyAdminHTTPSignature, chatSvc.getRecentAttachments);
app.post('/api/admin/create-test-data', httpServerUtil.verifyAdminHTTPSignature, chatSvc.createTestData);
app.post('/api/admin/block-user', httpServerUtil.verifyAdminHTTPSignature, chatSvc.blockUser);

app.post('/api/attachments/:attachmentId/delete', httpServerUtil.verifyAdminHTTPSignature, chatSvc.deleteAttachment);
app.post('/api/rooms/:roomId/get-messages-by-id', chatSvc.getMessagesByIds);
app.post('/api/users/info', httpServerUtil.verifyReqHTTPSignature, chatSvc.saveUserProfile);
app.post('/api/rooms/:roomId/send-messages',  httpServerUtil.verifyReqHTTPSignature, chatSvc.sendMessages);
app.post('/api/delete-message', httpServerUtil.verifyReqHTTPSignature, chatSvc.deleteMessage); // check PublicKey

// For now we only allow admin to access the docs API
app.post('/api/docs/save-file/', httpServerUtil.verifyAdminHTTPSignature, docSvc.saveFile); 
app.post('/api/docs/rename-folder/', httpServerUtil.verifyAdminHTTPSignature, docSvc.renameFolder); 
app.post('/api/docs/delete', httpServerUtil.verifyAdminHTTPSignature, docSvc.deleteFileOrFolder); 
app.post('/api/docs/move-up-down', httpServerUtil.verifyAdminHTTPSignature, docSvc.moveUpOrDown); 
app.post('/api/docs/file/create', httpServerUtil.verifyAdminHTTPSignature, docSvc.createFile); 
app.post('/api/docs/folder/create', httpServerUtil.verifyAdminHTTPSignature, docSvc.createFolder); 
app.post('/api/docs/paste', httpServerUtil.verifyAdminHTTPSignature, docSvc.pasteItems);
app.post('/api/docs/file-system-open', httpServerUtil.verifyAdminHTTPSignature, docSvc.openFileSystemItem);

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

// Define HTML routes BEFORE static middleware
// Explicitly serve index.html for root path
// NOTE: This is a bit tricky because we're generating a closure function by making these calls here, when
// normally we would just pass the function reference directly.
app.get('/', serveIndexHtml(""));
app.get('/doc/:docRootKey', serveIndexHtml("TreeViewerPage"));

// Serve static files from the dist directory, but disable index serving
app.use(express.static("./dist", { index: false }));

// Fallback for any other routes not handled above
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

rtc.init(HOST, PORT, server);
