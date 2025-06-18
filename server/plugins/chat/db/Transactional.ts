import { dbMgr } from "./DBManager.js";
import pgdb from "../../../PDGB.js";

let tranCounter = 0;

// todo-0: need to validate whether this varible is ok to have one copy of in global scope.
let transactionClient: any = null;

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
            dbMgr.checkDb();
            let ret = null;
        
            // Increment counter BEFORE starting transaction
            tranCounter++;
            try {
                // console.log("ENTER TRAN: "+tranCounter);
                if (tranCounter > 1) {
                    // console.log('USING CURRENT TRAN');
                    return await originalMethod.apply(this, args); // call wrapped function
                }
          
                // Get a dedicated client for this transaction
                transactionClient = await pgdb.getClient();
                await transactionClient.query('BEGIN');
                
                ret = await originalMethod.apply(this, args); // call wrapped function
                
                await transactionClient.query('COMMIT');
            } catch (error) {
                console.error('Transaction error:', error);
                if (tranCounter === 1 && transactionClient) {
                    try {
                        await transactionClient.query('ROLLBACK');
                    } catch (rollbackError) {
                        console.error('Rollback error:', rollbackError);
                    }
                }
                throw error; // Re-throw the original error
            } finally {
                tranCounter--;
                // console.log("EXIT TRAN: "+tranCounter);
                
                // Release the client when the outermost transaction completes
                if (tranCounter === 0 && transactionClient) {
                    transactionClient.release();
                    transactionClient = null;
                }
            }
            return ret;
        };
        return descriptor;
    };
}

/**
 * Get the current transaction client. This should be used by DBManager methods
 * when they are called within a transaction to ensure they use the same client.
 */
export function getTransactionClient() {
    return transactionClient;
}