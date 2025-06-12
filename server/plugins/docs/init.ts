import { config } from "../../Config.js";
import { httpServerUtil } from "../../HttpServerUtil.js";
import { docSvc } from "./DocService.js";
import { ssg } from "./SSGService.js";
import { IServerPlugin } from "../../ServerUtil.js";
import { docUtil } from "./DocUtil.js";
import { docMod } from "./DocMod.js";
import { docBinary } from "./DocBinary.js";

const defaultPlugin = config.get("defaultPlugin");

class DocsServerPlugin implements IServerPlugin {
    init(context: any) {
        console.log('init docs plugin...');
        this.initRoutes(context.app, context.serveIndexHtml);
    }

    private initRoutes(app: any, serveIndexHtml: any) {
        app.get('/api/docs/render/:docRootKey/*', docSvc.treeRender); 
        app.get('/api/docs/images/:docRootKey/*', docBinary.serveDocImage); 

        // For now we only allow admin to access the docs API
        app.post('/api/docs/save-file/', httpServerUtil.verifyAdminHTTPSignature, docMod.saveFile); 
        app.post('/api/docs/upload', httpServerUtil.verifyAdminHTTPSignature, docBinary.uploadFiles);
        app.post('/api/docs/rename-folder/', httpServerUtil.verifyAdminHTTPSignature, docMod.renameFolder); 
        app.post('/api/docs/delete', httpServerUtil.verifyAdminHTTPSignature, docMod.deleteFileOrFolder); 
        app.post('/api/docs/move-up-down', httpServerUtil.verifyAdminHTTPSignature, docMod.moveUpOrDown); 
        app.post('/api/docs/file/create', httpServerUtil.verifyAdminHTTPSignature, docSvc.createFile); 
        app.post('/api/docs/folder/create', httpServerUtil.verifyAdminHTTPSignature, docSvc.createFolder); 
        app.post('/api/docs/make-folder', httpServerUtil.verifyAdminHTTPSignature, docMod.makeFolder); 
        app.post('/api/docs/paste', httpServerUtil.verifyAdminHTTPSignature, docMod.pasteItems);
        app.post('/api/docs/join', httpServerUtil.verifyAdminHTTPSignature, docMod.joinFiles);
        app.post('/api/docs/file-system-open', httpServerUtil.verifyAdminHTTPSignature, docUtil.openFileSystemItem);
        app.post('/api/docs/search', httpServerUtil.verifyAdminHTTPSignature, docSvc.search);
        app.post('/api/docs/ssg', httpServerUtil.verifyAdminHTTPSignature, ssg.generateStaticSite);

        app.get('/doc/:docRootKey', serveIndexHtml("TreeViewerPage"));

        if (defaultPlugin === "docs") {
            console.log('Docs plugin is the default plugin, serving index.html at root path(/).');
            app.get('/', serveIndexHtml("TreeViewerPage"));
        }
    }

    finishRoute(context: any) {
        console.log('finishRoute docs plugin...');
        if (defaultPlugin === "docs") {
            console.log('Docs plugin is the default plugin, serving index.html at root path(*).');
            context.app.get('*', context.serveIndexHtml("TreeViewerPage"));
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    notify(server: any) {
        // not used 
    }
}

export const plugin = new DocsServerPlugin();