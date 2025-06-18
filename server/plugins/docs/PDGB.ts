import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

    constructor() {}

    /**
     * Initialize the PostgreSQL database connection and create tables/functions
     */
    async initDb(): Promise<void> {
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

            // Initialize database schema
            await this.initializeSchema();

            // Initialize stored functions
            await this.initializeFunctions();

            this.isInitialized = true;
            console.log('PostgreSQL Database initialized successfully');

        } catch (error) {
            console.error('Failed to initialize PostgreSQL Database:', error);
            throw error;
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
            user: process.env.POSTGRES_USER || 'quanta_user',
            password: process.env.POSTGRES_PASSWORD || 'quanta_password'
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

    /**
     * Initialize database schema by reading and executing schema.sql
     */
    private async initializeSchema(): Promise<void> {
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }

        const client = await this.pool.connect();
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
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }

        const client = await this.pool.connect();
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

    /**
     * Get a client from the connection pool
     */
    async getClient(): Promise<PoolClient> {
        if (!this.pool) {
            throw new Error('Database not initialized. Call initDb() first.');
        }
        return this.pool.connect();
    }

    /**
     * Execute a query using the connection pool
     */
    async query(text: string, params?: any[]): Promise<any> {
        if (!this.pool) {
            throw new Error('Database not initialized. Call initDb() first.');
        }
        return this.pool.query(text, params);
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