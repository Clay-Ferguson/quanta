import express, { Request, Response } from 'express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { logInit } from './ServerLogger.js';
import { config } from './Config.js'; 
import { svrUtil } from './ServerUtil.js';
import { httpServerUtil } from './HttpServerUtil.js';
import { docSvc } from './plugins/docs/DocService.js';
import { docUtil } from './plugins/docs/DocUtil.js';
import pgdb from './PGDB.js';
import { dbUsers } from './DBUsers.js';

logInit();

// this HOST will be 'localhost' or else if on prod 'chat.quanta.wiki'
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

const plugins = config.get("plugins");
// get commma delimited list of plugin 'key' values into a string
const pluginKeys = plugins.map((plugin: any) => plugin.key).join(','); 
console.log(`Plugins loaded: ${pluginKeys}`);

const serveIndexHtml = (page: string) => (req: Request, res: Response) => {
    fs.readFile("./dist/index.html", 'utf8', async (err, data) => {
        if (err) {
            console.error('Error reading index.html:', err);
            return res.status(500).send('Error loading page');
        }
        
        try {
            console.log(`Serving index.html for page: ${page}`);

            let docPath: string | null = req.query.path as string || "";
            if (docPath) {
                // owner_id of 0 always has super powers.
                const ifs = docUtil.getFileSystem(req.params.docRootKey);
                docPath = await docSvc.resolveNonOrdinalPath(0, req.params.docRootKey, docPath, ifs);
                if (!docPath) {
                    console.error(`Failed to resolve docPath for ${req.params.docRootKey} and path ${docPath}`);
                    return res.status(404).send('Document not found');
                }
                console.log(`Resolved docPath: ${docPath}`);
            }

            // use the docRootKey to get the file system type (vfs or lfs), by calling getFileSystemType
            let docRootType = "";
            if (req.params.docRootKey) {
                docRootType = await docUtil.getFileSystemType(req.params.docRootKey);
            }

            // Replace the placeholders with actual values
            const result = data
                .replace('{{HOST}}', HOST)
                .replace('{{CLIENT_HOST}}', CLIENT_HOST)
                .replace('{{PORT}}', PORT)
                .replace('{{SECURE}}', SECURE)
                .replace('{{ADMIN_PUBLIC_KEY}}', ADMIN_PUBLIC_KEY)
                .replace(`{{PAGE}}`, page)
                .replace('{{DOC_ROOT_KEY}}', req.params.docRootKey || "")
                .replace('{{DOC_ROOT_TYPE}}', docRootType)
                .replace('{{DOC_PATH}}', docPath)
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

app.post('/api/admin/run-cmd/', httpServerUtil.verifyAdminHTTPSignature, svrUtil.runAdminCommand); 
app.post('/api/users/info', httpServerUtil.verifyReqHTTPSignatureAllowAnon, dbUsers.saveUserProfile); 
app.get('/api/users/:pubKey/info', dbUsers.getUserProfileReq);
app.get('/api/users/:pubKey/avatar', dbUsers.serveAvatar);

if (process.env.POSTGRES_HOST) {
    // NOTE: This MUST be called before 'initPlugins'
    await pgdb.loadAdminUser();
}

// NOTE: It's important to initialize plugins before defining the other routes below.
await svrUtil.initPlugins(plugins, {app, serveIndexHtml});

// Serve static files from the dist directory, but disable index serving
app.use(express.static("./dist", { index: false }));

// Fallback for any other routes not handled above
await svrUtil.finishRoutes({app, serveIndexHtml});

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

console.log("App init complete.");