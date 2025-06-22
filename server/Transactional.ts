import pgdb from "./PGDB.js";
import { AsyncLocalStorage } from 'async_hooks';

// Store transaction context per async execution context
interface TransactionContext {
    client: any;
    counter: number;
}

const transactionStorage = new AsyncLocalStorage<TransactionContext>();

/**
 * Transactional decorator for methods that require database transactions. We simply can put
 * '@Transactional()' before the method name and it will be wrapped in a transaction by this method.
 * 
 * For PostgreSQL, this decorator ensures that all database operations within the decorated method
 * use the same client connection and are wrapped in a transaction.
 */
export function Transactional() {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
      
        descriptor.value = async function(...args: any[]) {
            // 'this' will be the class instance when the decorated method is called
            let ret = null;
        
            // Check if we're already in a transaction context
            const existingContext = transactionStorage.getStore();
            if (existingContext) {
                // console.log("got existing transaction context");
                // We're in a nested transaction - increment counter and call method
                existingContext.counter++;
                try {
                    // console.log("calling original method in existing transaction context");
                    ret = await originalMethod.apply(this, args);
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
                    ret = await originalMethod.apply(this, args);
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
        };
        return descriptor;
    };
}

/**
 * Get the current transaction client. This should be used by DBManager methods
 * when they are called within a transaction to ensure they use the same client.
 */
export function getTransactionClient() {
    const context = transactionStorage.getStore();
    return context?.client || null;
}