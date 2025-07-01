import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Pool, PoolClient } from 'pg';
import { getTransactionClient } from './Transactional.js';
import { UserProfile, UserProfileCompact } from '../common/types/CommonTypes.js';
import { dbUsers } from './DBUsers.js';
import { config } from './Config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PostgresConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

class PGDB {
    private pool: Pool | null = null;
    private isInitialized: boolean = false;

    // todo-1: admin panel needs to be able to flip this on/off
    public logEnabled: boolean = false; 
    public adminProfile: UserProfileCompact | null = null;

    constructor() {}

    /**
     * Initialize the PostgreSQL database connection and create tables/functions
     */
    async initDb(): Promise<void> {
        if (!process.env.POSTGRES_HOST) {
            throw new Error('POSTGRES_HOST environment variable is not set');
        }
        if (this.isInitialized) {
            return;
        }
        try {
            console.log('Initializing PostgreSQL Database...');

            // Get database configuration from environment variables
            const config: PostgresConfig = this.getDbConfig();
            
            // Create connection pool
            this.pool = new Pool({
                host: config.host,
                port: config.port,
                database: config.database,
                user: config.user,
                password: config.password,
                max: 20, // Maximum number of clients in the pool
                idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
                connectionTimeoutMillis: 2000, // How long to wait when connecting
            });

            // Test the connection
            await this.testConnection();

            this.isInitialized = true;
            console.log('PostgreSQL Database initialized successfully');

        } catch (error) {
            console.error('Failed to initialize PostgreSQL Database:', error);
            throw error;
        }

        await this.initSchema();
    }

    // Returns id or 0 of it's admin. Postgres functions know to treat 0 as admin.
    public authId(id: number): number {  
        if (!this.adminProfile || !this.adminProfile.id) {
            throw new Error('Admin profile not loaded or invalid, authId');
        }
        return this.adminProfile.id==id ? 0 : id;
    }

    async loadAdminUser(): Promise<void> {
        const adminPubKey = config.get("adminPublicKey");
        this.adminProfile = await dbUsers.getUserProfileCompact(adminPubKey);
        if (!this.adminProfile) {
            // if we don't find the admin profile we need to create it!
            console.warn(`Admin user with public key ${adminPubKey} not found. Creating default admin user...`);
            const defaultAdminProfile: UserProfile = {
                name: 'admin',
                avatar: null,
                description: 'Admin user',
                publicKey: adminPubKey
            };  
            await dbUsers.saveUserInfo(defaultAdminProfile, null);

            // now read it back.
            this.adminProfile = await dbUsers.getUserProfileCompact(adminPubKey);
            if (!this.adminProfile) {
                console.error('Failed to create default admin user. Please check your database configuration.');
                throw new Error('Failed to create default admin user');
            }
            else {
                console.log('Default admin user created successfully:', this.adminProfile);
            }
        }
    }

    private async initSchema(): Promise<void> {
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
    
    /**
     * Get database configuration from environment variables or defaults
     */
    private getDbConfig(): PostgresConfig {
        return {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DB || 'quanta',
            user: process.env.POSTGRES_USER || 'quanta',
            password: process.env.POSTGRES_PASSWORD || 'pwd'
        };
    }

    /**
     * Test the database connection
     */
    private async testConnection(): Promise<void> {
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }

        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT NOW()');
            console.log('Database connection test successful:', result.rows[0].now);
        } finally {
            client.release();
        }
    }

    checkDb() {
        if (!this.isInitialized) {
            throw new Error('Database not initialized. Call initDb() first.');
        }
        if (!this.pool) {
            throw new Error('Database not initialized. Call initDb() first.');
        }
    }

    /**
     * Get a client from the connection pool
     */
    async getClient(): Promise<PoolClient> {
        this.checkDb();
        return this.pool!.connect();
    }

    /**
     * Execute a database query using transaction client if available, otherwise use the pool
     */
    async query(sql: string, ...params: any[]): Promise<any> {
        this.checkDb();
        let result = null;
        if (this.logEnabled) {
            // Log the SQL query and parameters
            console.log('Executing SQL query:');
            console.log(sql);
            if (params && params.length > 0) {
                console.log('  Parameters:');
                params.forEach((param, index) => {
                    console.log(`    [${index}]: ${param}`);
                });
            }
        }

        try {
            const transactionClient = getTransactionClient();
            if (transactionClient) {
                result = await transactionClient.query(sql, params.length > 0 ? params : undefined);
            }
            else {
                result = await this.pool!.query(sql, params && params.length > 0 ? params : undefined); 
            }
        }
        catch (error) {
            console.error('Error executing SQL query:', sql, error);
            throw error;
        }

        if (this.logEnabled) {
            // Log the query results
            console.log('  Query result:');
            console.log(`    Rows returned: ${result.rows.length}`);
            if (result.rows.length > 0) {
                console.log('    Data:');
                result.rows.forEach((row, index) => {
                    console.log(`      Row ${index}:`, JSON.stringify(row, null, 2));
                });
            }
        }
        
        return result;
    }

    async get<T = any>(sql: any, ...params: any[]): Promise<T | undefined> {
        const result = await this.query(sql, ...params);
        return result.rows[0] as T;
    }

    async all<T = any[]>(sql: any, ...params: any[]): Promise<T> {
        const result = await this.query(sql, ...params);
        return result.rows as T;
    }

    /**
     * Check if the database is initialized
     */
    isReady(): boolean {
        return this.isInitialized && this.pool !== null;
    }

    /**
     * Close the database connection pool
     */
    async close(): Promise<void> {
        this.checkDb();
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.isInitialized = false;
            console.log('Database connection pool closed');
        }
    }
}

const pgdb = new PGDB();
export default pgdb;