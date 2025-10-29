import { config } from "../../../server/Config.js";
import { Request } from 'express';
import { runTests as runVfsTests } from './test/vfs.test.js';
import { runRESTEndpointsTests } from './test/rest.test.js';
import { httpServerUtil } from "../../../server/HttpServerUtil.js";
import { docSvc } from "./DocService.js";
import { IAppContext, IServerPlugin, asyncHandler } from "../../../server/ServerUtil.js";
import { docMod } from "./DocMod.js";
import { docBinary } from "./DocBinary.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pgdb from "../../../server/db/PGDB.js";
import { UserProfileCompact } from "../../../common/types/CommonTypes.js";
import vfs from "./VFS.js";
import { docTags } from "./DocTags.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultPlugin = config.get("defaultPlugin");

class DocsServerPlugin implements IServerPlugin {
    pgMode = false;

    async init(context: IAppContext) {
        console.log('init docs plugin...');
        this.initRoutes(context);
        this.pgMode = true;
        
        const folder = "SQL";
        console.log(`Initializing database for folder: ${folder}`);
        await this.initializeSchema(folder);

        // Initialize stored functions
        await this.initializeFunctions(folder);

        if (!pgdb.adminProfile) {
            throw new Error('Admin profile not loaded. Please ensure the database is initialized and the admin user is created.');
        }
        await vfs.createUserFolder(pgdb.adminProfile);
    }

    // todo-1: we need to retest everything related to creating other users other than admin
    onCreateNewUser = async (userProfile: UserProfileCompact): Promise<UserProfileCompact> => {
        console.log('Docs onCreateNewUser: ', userProfile);
        await vfs.createUserFolder(userProfile);
        return userProfile;
    }

    private initRoutes(context: IAppContext) {  
        context.app.get('/api/docs/images/*',httpServerUtil.verifyReqHTTPQuerySig, asyncHandler(docBinary.serveDocImage));

        // For now we only allow admin to access the docs API
        context.app.post('/api/docs/render/*', httpServerUtil.verifyReqHTTPSignatureAllowAnon, asyncHandler(docSvc.treeRender)); 
        
        context.app.post('/api/docs/upload', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docBinary.uploadFiles)); 
        context.app.post('/api/docs/delete', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.delete)); 
        context.app.post('/api/docs/move-up-down', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.moveUpOrDown));   
        context.app.post('/api/docs/set-public', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.setPublic)); 

        context.app.post('/api/docs/file/save', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.saveFile)); 
        context.app.post('/api/docs/file/create', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docSvc.createFile)); 
        context.app.post('/api/docs/folder/create', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docSvc.createFolder));  
        context.app.post('/api/docs/folder/build', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.buildFolder)); 
        context.app.post('/api/docs/folder/rename', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.renameFolder));  

        context.app.post('/api/docs/paste', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.pasteItems)); 
        context.app.post('/api/docs/join', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.joinFiles)); 
        context.app.post('/api/docs/search', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.search)); 
        context.app.post('/api/docs/tags', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docTags.extractTags));
        context.app.post('/api/docs/tags/scan', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docTags.scanAndUpdateTags));
        
        // Removed until there's a docker+Postres version of this
        // context.app.post('/api/docs/ssg', httpServerUtil.verifyReqHTTPSignature, asyncHandler(ssg.generateStaticSite));

        context.app.get('/doc', context.serveIndexHtml("TreeViewerPage"));
        context.app.get('/doc/id/:uuid', context.serveIndexHtml("TreeViewerPage"));
        context.app.get('/doc/path/:path', context.serveIndexHtml("TreeViewerPage"));
        context.app.get('/doc/*', context.serveIndexHtml("TreeViewerPage"));

        if (defaultPlugin === "docs") {
            // console.log('Docs plugin is the default plugin, serving index.html at root path(/).');
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
    private async initializeSchema(folder: string): Promise<void> {
        console.log('Initializing database schema...');
        const client = await pgdb.getClient(); 
        try {
            // Read schema.sql file from dist directory (copied during build)
            const schemaPath = path.join(__dirname, folder, 'schema.sql');
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
    private async initializeFunctions(folder: string): Promise<void> {
        const client = await pgdb.getClient();
        try {
            // Read functions.sql file from dist directory (copied during build)
            const functionsPath = path.join(__dirname, folder, 'functions.sql');
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async preProcessHtml(html: string, req: Request): Promise<string> {
        return html;
    }

    async runAllTests(): Promise<void> {
        console.log("Running embedded tests...");
        await runVfsTests();
        await runRESTEndpointsTests();
        
        return Promise.resolve();
    }    
}

export const plugin = new DocsServerPlugin();