import { config } from "../../Config.js";
import { httpServerUtil } from "../../HttpServerUtil.js";
import { chatSvc } from "./ChatService.js";
import { rtc } from "./WebRTCServer.js";
import { IAppContext, IServerPlugin } from "../../ServerUtil.js";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pgdb from '../../PGDB.js';
import { UserProfileCompact } from "../../../common/types/CommonTypes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// this HOST will be 'localhost' or else if on prod 'chat.quanta.wiki'
const HOST = config.get("host"); 
const PORT = config.get("port");
const defaultPlugin = config.get("defaultPlugin");

class ChatServerPlugin implements IServerPlugin {
    async init(context: IAppContext) {
        console.log('init chat plugin...');
        this.initRoutes(context); 
        await this.initializeSchema();
    }

    private async initializeSchema() {
        if (!process.env.POSTGRES_HOST) {
            throw new Error('POSTGRES_HOST environment variable is not set');
        }

        const client = await pgdb.getClient();
        try {
            // Read schema.sql file relative to this script
            const schemaPath = path.join(__dirname, 'schema.sql');
            console.log('Reading schema from:', schemaPath);
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
                
            console.log('Executing database schema...');
            await client.query(schemaSql);
            console.log('Database schema created successfully');
    
        } catch (error) {
            console.error('Error initializing database schema:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    onCreateNewUser = async (userProfile: UserProfileCompact): Promise<UserProfileCompact> => {
        return userProfile;
    }

    private initRoutes(context: IAppContext) {
        context.app.get('/api/rooms/:roomId/message-ids', chatSvc.getMessageIdsForRoom);
        context.app.get('/api/attachments/:attachmentId', chatSvc.serveAttachment);
        context.app.get('/api/messages', chatSvc.getMessageHistory);

        context.app.post('/api/admin/get-room-info', httpServerUtil.verifyAdminHTTPSignature, chatSvc.getRoomInfo);
        context.app.post('/api/admin/delete-room', httpServerUtil.verifyAdminHTTPSignature, chatSvc.deleteRoom);
        context.app.post('/api/admin/get-recent-attachments', httpServerUtil.verifyAdminHTTPSignature, chatSvc.getRecentAttachments);
        context.app.post('/api/admin/create-test-data', httpServerUtil.verifyAdminHTTPSignature, chatSvc.createTestData);
        context.app.post('/api/admin/block-user', httpServerUtil.verifyAdminHTTPSignature, chatSvc.blockUser);

        context.app.post('/api/attachments/:attachmentId/delete', httpServerUtil.verifyAdminHTTPSignature, chatSvc.deleteAttachment);
        context.app.post('/api/rooms/:roomId/get-messages-by-id', chatSvc.getMessagesByIds);
        context.app.post('/api/rooms/:roomId/send-messages',  httpServerUtil.verifyReqHTTPSignature, chatSvc.sendMessages); 
        context.app.post('/api/delete-message', httpServerUtil.verifyReqHTTPSignature, chatSvc.deleteMessage); 

        // We serve the index.html page for the chat plugin at the root path, if 'chat' is the default plugin.
        // NOTE: This is a bit tricky because we're generating a closure function by making these calls here, when
        // normally we would just pass the function reference directly.
        if (defaultPlugin === "chat") {
            console.log('Chat plugin is the default plugin, serving index.html at root path(/).');
            context.app.get('/', context.serveIndexHtml("QuantaChatPage"));
        }
    }

    // convert these to IAppContext
    finishRoute(context: IAppContext) {
        console.log('finishRoute chat plugin...');
        if (defaultPlugin === "chat") {
            console.log('Chat plugin is the default plugin, serving index.html at root path(*).');
            context.app.get('*', context.serveIndexHtml("QuantaChatPage"));
        }
    }

    notify(server: any) {
        rtc.init(HOST, PORT, server);
    }
}

export const plugin = new ChatServerPlugin();
