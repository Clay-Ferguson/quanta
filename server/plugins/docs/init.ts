import { config } from "../../Config.js";
import { httpServerUtil } from "../../HttpServerUtil.js";
import { docSvc } from "./DocService.js";
import { ssg } from "./SSGService.js";
import { IServerPlugin } from "../../ServerUtil.js";
import { docUtil } from "./DocUtil.js";
import { docMod } from "./DocMod.js";
import { docBinary } from "./DocBinary.js";
import { pgdbTest } from "./PGDBTest.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pgdb from "../../PDGB.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultPlugin = config.get("defaultPlugin");

class DocsServerPlugin implements IServerPlugin {
    async init(context: any) {
        console.log('init docs plugin...');
        this.initRoutes(context.app, context.serveIndexHtml);

        if (process.env.POSTGRES_HOST) {
            await pgdb.initDb(); // Ensure the database is initialized
        
            // Initialize database schema
            await this.initializeSchema();

            // Initialize stored functions
            await this.initializeFunctions();

            // Test PostgreSQL database functionality
            try {
                await pgdbTest(); // todo-0: temporary for development.
            } catch (error) {
                console.error('PGDB test failed during plugin initialization:', error);
            }
        }
        else {
            console.warn('POSTGRES_HOST environment variable is not set. Skipping database initialization.');
        }
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
        app.post('/api/docs/search-binaries', httpServerUtil.verifyAdminHTTPSignature, docSvc.searchBinaries);
        app.post('/api/docs/search-text', httpServerUtil.verifyAdminHTTPSignature, docSvc.searchTextFiles);
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

    /**
         * Initialize database schema by reading and executing schema.sql
         */
    private async initializeSchema(): Promise<void> {
        const client = await pgdb.getClient();
        try {
            // Read schema.sql file from dist directory (copied during build)
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
    
    /**
         * Initialize PostgreSQL functions by reading and executing pg_functions.sql
         */
    private async initializeFunctions(): Promise<void> {
        const client = await pgdb.getClient();
        try {
            // Read pg_functions.sql file from dist directory (copied during build)
            const functionsPath = path.join(__dirname, 'pg_functions.sql');
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