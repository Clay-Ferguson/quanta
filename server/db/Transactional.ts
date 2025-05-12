import { DBManagerIntf } from "../../common/CommonTypes.js";

let dbManager: DBManagerIntf | null = null;
let tranCounter = 0;

export function setDBManager(dbm: DBManagerIntf) {
    dbManager = dbm;
}

/**
 * Transactional decorator for methods that require database transactions. We simply can put
 * '@Transactional()' before the method name and it will be wrapped in a transaction by this method.
 */
export function Transactional() {
    return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
      
        descriptor.value = async function(...args: any[]) {
            // 'this' will be the class instance when the decorated method is called
            dbManager!.checkDb();
            let ret = null;
        
            // Increment counter BEFORE starting transaction
            tranCounter++;
            try {
                // console.log("ENTER TRAN: "+tranCounter);
                if (tranCounter > 1) {
                    console.log('USING CURRENT TRAN');
                    return await originalMethod.apply(this, args); // call wrapped function
                }
          
                await dbManager!.run('BEGIN TRANSACTION');
                ret = await originalMethod.apply(this, args); // call wrapped function
                await dbManager!.run('COMMIT');
            } catch (error) {
                // todo-0: I'm pretty sure there's a bug in this 'error' handling where 'error' doesn't get printed in the console
                console.error('Transaction error:', error);
                console.trace();
                if (tranCounter === 1) {
                    try {
                        await dbManager!.run('ROLLBACK');
                    } catch (rollbackError) {
                        console.error('Transaction error:', rollbackError);
                    }
                }
            } finally {
                tranCounter--;
                // console.log("EXIT TRAN: "+tranCounter);
            }
            return ret;
        };
      
        return descriptor;
    };
}