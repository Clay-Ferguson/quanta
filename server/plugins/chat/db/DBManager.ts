import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {DBManagerIntf} from '../../../../common/types/CommonTypes.js';
import pgdb from '../../../PDGB.js';
import { getTransactionClient } from './Transactional.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DBManager implements DBManagerIntf {

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        if (!process.env.POSTGRES_HOST) {
            throw new Error('POSTGRES_HOST environment variable is not set');
        }

        const client = await pgdb.getClient();
        try {
            // Read schema.sql file relative to this script
            const schemaPath = path.join(__dirname, '..', 'schema.sql');
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

    async get<T = any>(sql: any, ...params: any[]): Promise<T | undefined> {
        const transactionClient = getTransactionClient();
        if (transactionClient) {
            const result = await transactionClient.query(sql, params);
            return result.rows[0] as T;
        }
        
        const client = await pgdb.getClient();
        try {
            const result = await client.query(sql, params);
            return result.rows[0] as T;
        } finally {
            client.release();
        }
    }

    async all<T = any[]>(sql: any, ...params: any[]): Promise<T> {
        const transactionClient = getTransactionClient();
        if (transactionClient) {
            const result = await transactionClient.query(sql, params);
            return result.rows as T;
        }
        
        const client = await pgdb.getClient();
        try {
            const result = await client.query(sql, params);
            return result.rows as T;
        } finally {
            client.release();
        }
    }

    async run(sql: any, ...params: any[]): Promise<any> {
        const transactionClient = getTransactionClient();
        if (transactionClient) {
            const result = await transactionClient.query(sql, params);
            return result;
        }
        
        const client = await pgdb.getClient();
        try {
            const result = await client.query(sql, params);
            return result;
        } finally {
            client.release();
        }
    }
}

export const dbMgr = new DBManager();

