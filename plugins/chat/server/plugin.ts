import { config } from "../../../server/Config.js";
import { httpServerUtil } from "../../../server/HttpServerUtil.js";
import { chatSvc } from "./ChatService.js";
import { rtc } from "./WebRTCServer.js";
import { IAppContext, IServerPlugin, asyncHandler } from "../../../server/ServerUtil.js";
import { Request } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pgdb from '../../../server/PGDB.js';
import { UserProfileCompact } from "../../../common/types/CommonTypes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// this HOST will be 'localhost' or else if on prod 'quanta.wiki'
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
        context.app.get('/api/rooms/:roomId/message-ids', asyncHandler(chatSvc.getMessageIdsForRoom));
        context.app.get('/api/attachments/:attachmentId', asyncHandler(chatSvc.serveAttachment));
        context.app.get('/api/messages', asyncHandler(chatSvc.getMessageHistory));

        context.app.post('/api/admin/get-room-info', httpServerUtil.verifyAdminHTTPSignature, asyncHandler(chatSvc.getRoomInfo));
        context.app.post('/api/admin/delete-room', httpServerUtil.verifyAdminHTTPSignature, asyncHandler(chatSvc.deleteRoom));
        context.app.post('/api/admin/get-recent-attachments', httpServerUtil.verifyAdminHTTPSignature, asyncHandler(chatSvc.getRecentAttachments));
        context.app.post('/api/admin/create-test-data', httpServerUtil.verifyAdminHTTPSignature, asyncHandler(chatSvc.createTestData));
        context.app.post('/api/admin/block-user', httpServerUtil.verifyAdminHTTPSignature, asyncHandler(chatSvc.blockUser));

        context.app.post('/api/attachments/:attachmentId/delete', httpServerUtil.verifyAdminHTTPSignature, asyncHandler(chatSvc.deleteAttachment));
        context.app.post('/api/rooms/:roomId/get-messages-by-id', asyncHandler(chatSvc.getMessagesByIds));
        context.app.post('/api/rooms/:roomId/send-messages',  httpServerUtil.verifyReqHTTPSignature, asyncHandler(chatSvc.sendMessages)); 
        context.app.post('/api/delete-message', httpServerUtil.verifyReqHTTPSignature, asyncHandler(chatSvc.deleteMessage));
        
        if (defaultPlugin === "chat") {
            console.log('Chat plugin is the default plugin, serving index.html at root path(*).');
            context.app.get('/', context.serveIndexHtml("QuantaChatPage"));
        }

        context.app.get('/chat', context.serveIndexHtml("QuantaChatPage"));
    }

    async notify(server: any): Promise<void> {
        await rtc.init(HOST, PORT, server);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async preProcessHtml(html: string, req: Request): Promise<string> {        
        return html;
    }

    runAllTests(): Promise<void> {
        return Promise.resolve();
    }
}

export const plugin = new ChatServerPlugin();
