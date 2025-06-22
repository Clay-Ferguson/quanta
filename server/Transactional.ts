import pgdb from "./PGDB.js";
import { AsyncLocalStorage } from 'async_hooks';

// Store transaction context per async execution context
interface TransactionContext {
    client: any;
    counter: number;
}

const transactionStorage = new AsyncLocalStorage<TransactionContext>();

/**
 * Get the current transaction client. This should be used by DBManager methods
 * when they are called within a transaction to ensure they use the same client.
 */
export function getTransactionClient() {
    const context = transactionStorage.getStore();
    return context?.client || null;
}

export async function runTrans(fn: () => Promise<any>) {
    let ret = null;
        
    // Check if we're already in a transaction context
    const existingContext = transactionStorage.getStore();
    if (existingContext) {
        // console.log("got existing transaction context");
        // We're in a nested transaction - increment counter and call method
        existingContext.counter++;
        try {
            // console.log("calling original method in existing transaction context");
            ret = await fn();
            // console.log("original method executed successfully in existing transaction context");
        } finally {
            existingContext.counter--;
        }
        return ret;
    }

    console.log("starting new transaction context");
    // Start a new transaction context
    const client = await pgdb.getClient();
    const context: TransactionContext = { client, counter: 1 };
            
    return await transactionStorage.run(context, async () => {
        try {
            await client.query('BEGIN');
            // console.log('Transaction started');
            ret = await fn();
            // console.log('Transaction method executed successfully');
            await client.query('COMMIT');
            // console.log('Transaction committed successfully');
        } catch (error) {
            console.error('Transaction error:', error);
            try {
                await client.query('ROLLBACK');
                console.error('Rolling back transaction due to error');
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
            throw error; // Re-throw the original error
        } finally {
            client.release();
        }
        return ret;
    });
}
       