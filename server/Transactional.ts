import { config } from "./Config.js";
import pgdb from "./PGDB.js";
import { AsyncLocalStorage } from 'async_hooks';
import { PoolClient } from 'pg';

// Store transaction context per async execution context
interface TransactionContext {
    client: PoolClient;
    transactionCount: number;
}

// Store "single transaction" context per async execution context
interface SingleTransactionContext {
    client: PoolClient;
    entryCount: number;
}

const tranStore = new AsyncLocalStorage<TransactionContext>();
const singleTranStore = new AsyncLocalStorage<SingleTransactionContext>();

/**
 * Get the current transaction client. This should be used by DBManager methods
 * when they are called within a transaction to ensure they use the same client.
 */
export function getTransactionClient(): PoolClient | null {
    // First check if we're in a single transaction context
    const singleContext = singleTranStore.getStore();
    if (singleContext?.client) {
        return singleContext.client;
    }
    
    // Then check if we're in a regular transaction context
    const context = tranStore.getStore();
    return context?.client || null;
}

/**
 * Run a function within a database transaction.
 * Supports nested transactions (using savepoints) and ensures proper resource cleanup.
 * 
 * NOTE: This version is unused and kept for reference.
 * 
 * @param fn The function to execute within the transaction
 * @returns The result of the function execution
 *
 */
export async function runTrans__unused<T>(fn: () => Promise<T>): Promise<T> {
    // If database is not active, just run the function without transaction
    if (!config.dbActive) {
        return await fn();
    }
    
    // Check if we're already in a transaction context
    const context = tranStore.getStore();
    
    if (context) {
        // We're in a nested transaction - use savepoints
        const { client, transactionCount } = context;
        const savepointName = `sp_${transactionCount}`;
        
        // Create a savepoint for this nested transaction
        await client.query(`SAVEPOINT ${savepointName}`);
        
        // Increment transaction counter in context
        const newContext: TransactionContext = { 
            client, 
            transactionCount: transactionCount + 1 
        };
        
        // Execute function within the updated transaction context
        return await tranStore.run(newContext, async () => {
            try {
                const result = await fn();
                // Release savepoint on success
                await client.query(`RELEASE SAVEPOINT ${savepointName}`);
                return result;
            } catch (error) {
                // Roll back to savepoint on error
                await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                throw error;
            }
        });
    }
    
    // Start a new top-level transaction
    let client: PoolClient | null = null;
    
    try {
        // Get a client from the pool
        client = await pgdb.getClient();
        
        // Create new transaction context
        const newContext: TransactionContext = { 
            client, 
            transactionCount: 1 
        };
        
        // Execute within transaction context
        return await tranStore.run(newContext, async () => {
            try {
                await client!.query('BEGIN');
                const result = await fn();
                await client!.query('COMMIT');
                return result;
            } catch (error) {
                // Attempt rollback on error
                try {
                    if (client) await client.query('ROLLBACK');
                } catch (rollbackError) {
                    console.error('Rollback error:', rollbackError);
                    // Continue with the original error even if rollback fails
                }
                throw error;
            } finally {
                // Always release the client in the finally block
                if (client) client.release();
                client = null;
            }
        });
    } catch (error) {
        // If any error occurs outside the transaction context
        if (client) {
            // Ensure client is always released even if setting up the transaction context fails
            client.release();
        }
        throw error;
    }
}

/**
 * Run a function within a single database transaction that's only committed at the outermost level.
 * Inner calls reuse the same transaction, and commit only happens when exiting the outermost call.
 * A rollback at any level will roll back the entire transaction.
 * 
 * @param fn The function to execute within the single transaction
 * @returns The result of the function execution
 */
export async function runTrans<T>(fn: () => Promise<T>): Promise<T> {
    // If database is not active, just run the function without transaction
    if (!config.dbActive) {
        return await fn();
    }
    
    // Check if we're already in a single transaction context
    const context = singleTranStore.getStore();
    
    if (context) {
        // We're already in a transaction, increment entry count
        const { client, entryCount } = context;
        
        // Increment entry counter in context
        const newContext: SingleTransactionContext = { 
            client, 
            entryCount: entryCount + 1 
        };
        
        // Execute function within the updated transaction context
        return await singleTranStore.run(newContext, async () => {
            // Run the function in the existing transaction
            return await fn();
        });
    }
    
    // Start a new transaction (we're at the outermost level)
    let client: PoolClient | null = null;
    
    try {
        // Get a client from the pool
        client = await pgdb.getClient();
        
        // Create new transaction context
        const newContext: SingleTransactionContext = { 
            client, 
            entryCount: 1 
        };
        
        // Execute within transaction context
        return await singleTranStore.run(newContext, async () => {
            try {
                // Begin the transaction
                await client!.query('BEGIN');
                
                // Execute the function
                const result = await fn();
                
                // Commit the transaction only at the outermost level
                await client!.query('COMMIT');
                
                return result;
            } catch (error) {
                // Attempt rollback on any error
                try {
                    if (client) await client.query('ROLLBACK');
                } catch (rollbackError) {
                    console.error('Rollback error:', rollbackError);
                    // Continue with the original error even if rollback fails
                }
                throw error;
            } finally {
                // Always release the client in the finally block
                if (client) client.release();
                client = null;
            }
        });
    } catch (error) {
        // If any error occurs outside the transaction context
        if (client) {
            // Ensure client is always released even if setting up the transaction context fails
            client.release();
        }
        throw error;
    }
}
