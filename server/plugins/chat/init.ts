import { config } from "../../../common/Config.js";
import { httpServerUtil } from "../../../common/HttpServerUtil.js";
import { chatSvc } from "./ChatService.js";
import { rtc } from "./WebRTCServer.js";

// this HOST will be 'localhost' or else if on prod 'chat.quanta.wiki'
const HOST = config.get("host"); 
const PORT = config.get("port");

export function init(context: any) {
    console.log('init chat plugin...');
    initRoutes(context.app, context.serveIndexHtml);
}

function initRoutes(app: any, serveIndexHtml: any) {

    app.get('/api/rooms/:roomId/message-ids', chatSvc.getMessageIdsForRoom);
    app.get('/api/attachments/:attachmentId', chatSvc.serveAttachment);
    app.get('/api/messages', chatSvc.getMessageHistory);
    app.get('/api/users/:pubKey/info', chatSvc.getUserProfile);
    app.get('/api/users/:pubKey/avatar', chatSvc.serveAvatar);

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

    // Define HTML routes BEFORE static middleware
    // Explicitly serve index.html for root path
    // NOTE: This is a bit tricky because we're generating a closure function by making these calls here, when
    // normally we would just pass the function reference directly.
    app.get('/', serveIndexHtml(""));
}

export function notify(server: any) {
    rtc.init(HOST, PORT, server);
}
