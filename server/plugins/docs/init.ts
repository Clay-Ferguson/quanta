import { config } from "../../Config.js";
import { httpServerUtil } from "../../HttpServerUtil.js";
import { docSvc } from "./DocService.js";
import { ssg } from "./SSGService.js";
import { IAppContext, IServerPlugin } from "../../ServerUtil.js";
import { docUtil } from "./DocUtil.js";
import { docMod } from "./DocMod.js";
import { docBinary } from "./DocBinary.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pgdb from "../../PGDB.js";
import docVFS from "./VFS/DocVFS.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultPlugin = config.get("defaultPlugin");

class DocsServerPlugin implements IServerPlugin {
    pgMode = false;

    async init(context: IAppContext) {
        console.log('init docs plugin...');
        this.initRoutes(context);

        if (process.env.POSTGRES_HOST) {
            this.pgMode = true;
        
            // Initialize database schema
            await this.initializeSchema();

            // Initialize stored functions
            await this.initializeFunctions();

            // Test PostgreSQL database functionality
            // todo-0: I was working on triggering rollbacks in the 'saveFile' and bizarrely I noticed thos pdgbTest running right after the rollback.
            // try {
            //     await pgdbTest(); 
            // } catch (error) {
            //     console.error('PGDB test failed during plugin initialization:', error);
            // }
        }
        else {
            console.warn('POSTGRES_HOST environment variable is not set. Skipping database initialization.');
        }
    }

    private initRoutes(context: IAppContext) {
        context.app.get('/api/docs/render/:docRootKey/*', docSvc.treeRender); 
        context.app.get('/api/docs/images/:docRootKey/*', docBinary.serveDocImage); 

        // todo-0: research whether we can run 'runTrans' in a middleware instead of in 'saveFile' and do same for all these, in 
        //         other words is there a middleware that can 'wrap' the rest of the chain of calls?
        // For now we only allow admin to access the docs API
        context.app.post('/api/docs/save-file/', httpServerUtil.verifyAdminHTTPSignature, docMod.saveFile); 
        context.app.post('/api/docs/upload', httpServerUtil.verifyAdminHTTPSignature, docBinary.uploadFiles);
        context.app.post('/api/docs/rename-folder/', httpServerUtil.verifyAdminHTTPSignature, docMod.renameFolder); 
        context.app.post('/api/docs/delete', httpServerUtil.verifyAdminHTTPSignature, docMod.deleteFileOrFolder); 
        context.app.post('/api/docs/move-up-down', httpServerUtil.verifyAdminHTTPSignature, docMod.moveUpOrDown); 
        context.app.post('/api/docs/file/create', httpServerUtil.verifyAdminHTTPSignature, docSvc.createFile); 
        context.app.post('/api/docs/folder/create', httpServerUtil.verifyAdminHTTPSignature, docSvc.createFolder); 
        context.app.post('/api/docs/make-folder', httpServerUtil.verifyAdminHTTPSignature, docMod.makeFolder); 
        context.app.post('/api/docs/paste', httpServerUtil.verifyAdminHTTPSignature, docMod.pasteItems);
        context.app.post('/api/docs/join', httpServerUtil.verifyAdminHTTPSignature, docMod.joinFiles);
        context.app.post('/api/docs/file-system-open', httpServerUtil.verifyAdminHTTPSignature, docUtil.openFileSystemItem);
        context.app.post('/api/docs/search-binaries', httpServerUtil.verifyAdminHTTPSignature, docSvc.searchBinaries);
        context.app.post('/api/docs/search-text', httpServerUtil.verifyAdminHTTPSignature, docSvc.searchTextFiles);
        context.app.post('/api/docs/search-vfs', httpServerUtil.verifyAdminHTTPSignature, docVFS.searchVFSFiles);
        context.app.post('/api/docs/ssg', httpServerUtil.verifyAdminHTTPSignature, ssg.generateStaticSite);

        context.app.get('/doc/:docRootKey', context.serveIndexHtml("TreeViewerPage"));

        if (defaultPlugin === "docs") {
            console.log('Docs plugin is the default plugin, serving index.html at root path(/).');
            context.app.get('/', context.serveIndexHtml("TreeViewerPage"));
        }
    }

    finishRoute(context: IAppContext) {
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

    /**
         * Initialize database schema by reading and executing schema.sql
         */
    private async initializeSchema(): Promise<void> {
        const client = await pgdb.getClient();
        try {
            // Read schema.sql file from dist directory (copied during build)
            const schemaPath = path.join(__dirname, 'VFS/SQL', 'schema.sql');
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
    
    /**
     * Initialize PostgreSQL functions by reading and executing functions.sql
     */
    private async initializeFunctions(): Promise<void> {
        const client = await pgdb.getClient();
        try {
            // Read functions.sql file from dist directory (copied during build)
            const functionsPath = path.join(__dirname, 'VFS/SQL', 'functions.sql');
            console.log('Reading functions from:', functionsPath);
            const functionsSql = fs.readFileSync(functionsPath, 'utf8');
                
            console.log('Creating PostgreSQL functions...');
            await client.query(functionsSql);
            console.log('PostgreSQL functions created successfully');
    
        } catch (error) {
            console.error('Error creating PostgreSQL functions:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

export const plugin = new DocsServerPlugin();