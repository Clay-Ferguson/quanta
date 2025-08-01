import { config } from "../../Config.js";
import { httpServerUtil } from "../../HttpServerUtil.js";
import { docSvc } from "./DocService.js";
import { ssg } from "./SSGService.js";
import { IAppContext, IServerPlugin, asyncHandler } from "../../ServerUtil.js";
import { docUtil } from "./DocUtil.js";
import { docMod } from "./DocMod.js";
import { docBinary } from "./DocBinary.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pgdb from "../../PGDB.js";
import docVFS from "./VFS/DocVFS.js";
import { pgdbTest } from "./VFS/test/VFSTest.js";
import { UserProfileCompact } from "../../../common/types/CommonTypes.js";
import vfs from "./VFS/VFS.js";

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

            if (!pgdb.adminProfile) {
                throw new Error('Admin profile not loaded. Please ensure the database is initialized and the admin user is created.');
            }
            await vfs.createUserFolder(pgdb.adminProfile);

            // Test PostgreSQL database functionality
            try {
                await pgdbTest(); 
            } catch (error) {
                console.error('PGDB test failed during plugin initialization:', error);
            }
        }
        else {
            console.warn('POSTGRES_HOST environment variable is not set. Skipping database initialization.');
        }
    }

    onCreateNewUser = async (userProfile: UserProfileCompact): Promise<UserProfileCompact> => {
        if (process.env.POSTGRES_HOST) {
            console.log('Docs onCreateNewUser: ', userProfile);
            await vfs.createUserFolder(userProfile);
        }
        return userProfile;
    }

    private initRoutes(context: IAppContext) {
        context.app.get('/api/docs/images/:docRootKey/*',httpServerUtil.verifyReqHTTPQuerySig, asyncHandler(docBinary.serveDocImage)); 

        // For now we only allow admin to access the docs API
        context.app.post('/api/docs/render/:docRootKey/*', httpServerUtil.verifyReqHTTPSignatureAllowAnon, asyncHandler(docSvc.treeRender)); 
        
        context.app.post('/api/docs/upload', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docBinary.uploadFiles)); 
        context.app.post('/api/docs/delete', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.deleteFileOrFolder)); 
        context.app.post('/api/docs/move-up-down', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.moveUpOrDown)); 
        context.app.post('/api/docs/set-public', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.setPublic)); 

        context.app.post('/api/docs/file/save', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.saveFile)); 
        context.app.post('/api/docs/file/create', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docSvc.createFile)); 
        context.app.post('/api/docs/folder/create', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docSvc.createFolder)); 
        context.app.post('/api/docs/folder/build', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.buildFolder));
        context.app.post('/api/docs/folder/rename', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.renameFolder)); 

        context.app.post('/api/docs/paste', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.pasteItems));
        context.app.post('/api/docs/join', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.joinFiles));
        context.app.post('/api/docs/file-system-open', httpServerUtil.verifyAdminHTTPSignature, asyncHandler(docUtil.openFileSystemItem));
        context.app.post('/api/docs/search-binaries', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docSvc.searchBinaries));
        context.app.post('/api/docs/search-text', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docSvc.searchTextFiles));
        context.app.post('/api/docs/search-vfs', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docVFS.searchVFSFiles));
        context.app.post('/api/docs/ssg', httpServerUtil.verifyReqHTTPSignature, asyncHandler(ssg.generateStaticSite));

        context.app.get('/doc/:docRootKey', context.serveIndexHtml("TreeViewerPage"));
        context.app.get('/doc/:docRootKey/id/:uuid', context.serveIndexHtml("TreeViewerPage"));
        context.app.get('/doc/:docRootKey/*', context.serveIndexHtml("TreeViewerPage"));

        if (defaultPlugin === "docs") {
            console.log('Docs plugin is the default plugin, serving index.html at root path(/).');
            context.app.get('/', context.serveIndexHtml("TreeViewerPage"));
        }
        context.app.get('/docs', context.serveIndexHtml("TreeViewerPage"));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async notify(server: any): Promise<void> {
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