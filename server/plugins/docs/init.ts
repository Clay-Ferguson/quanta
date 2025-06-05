import { config } from "../../../common/Config.js";
import { httpServerUtil } from "../../../common/HttpServerUtil.js";
import { docSvc } from "./DocService.js";
import { ssg } from "./SSGService.js";

const defaultPlugin = config.get("defaultPlugin");

export function init(context: any) {
    console.log('init docs plugin...');
    initRoutes(context.app, context.serveIndexHtml);
}

function initRoutes(app: any, serveIndexHtml: any) {
    app.get('/api/docs/render/:docRootKey/*', docSvc.treeRender);
    app.get('/api/docs/images/:docRootKey/*', docSvc.serveDocImage);

    // For now we only allow admin to access the docs API
    app.post('/api/docs/save-file/', httpServerUtil.verifyAdminHTTPSignature, docSvc.saveFile); 
    app.post('/api/docs/rename-folder/', httpServerUtil.verifyAdminHTTPSignature, docSvc.renameFolder); 
    app.post('/api/docs/delete', httpServerUtil.verifyAdminHTTPSignature, docSvc.deleteFileOrFolder); 
    app.post('/api/docs/move-up-down', httpServerUtil.verifyAdminHTTPSignature, docSvc.moveUpOrDown); 
    app.post('/api/docs/file/create', httpServerUtil.verifyAdminHTTPSignature, docSvc.createFile); 
    app.post('/api/docs/folder/create', httpServerUtil.verifyAdminHTTPSignature, docSvc.createFolder); 
    app.post('/api/docs/paste', httpServerUtil.verifyAdminHTTPSignature, docSvc.pasteItems);
    app.post('/api/docs/join', httpServerUtil.verifyAdminHTTPSignature, docSvc.joinFiles);
    app.post('/api/docs/file-system-open', httpServerUtil.verifyAdminHTTPSignature, docSvc.openFileSystemItem);
    app.post('/api/docs/search', httpServerUtil.verifyAdminHTTPSignature, docSvc.search);
    app.post('/api/docs/ssg', httpServerUtil.verifyAdminHTTPSignature, ssg.generateStaticSite);

    app.get('/doc/:docRootKey', serveIndexHtml("TreeViewerPage"));

    if (defaultPlugin === "docs") {
        console.log('Docs plugin is the default plugin, serving index.html at root path(/).');
        app.get('/', serveIndexHtml("TreeViewerPage"));
    }
}

export function finishRoute(context: any) {
    console.log('finishRoute docs plugin...');
    if (defaultPlugin === "docs") {
        console.log('Docs plugin is the default plugin, serving index.html at root path(*).');
        context.app.get('*', context.serveIndexHtml("TreeViewerPage"));
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function notify(server: any) {
    // not used 
}