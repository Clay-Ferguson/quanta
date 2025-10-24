## Architectural Pattern for HTTP/REST Calls

This document describes the architectural pattern we use to achieve type safety across client and server REST/HTTP communications. All API endpoints should follow this pattern for consistency, maintainability, and type safety.

## Client & Server Types 

In `EndpointTypes.ts` we define the types that can work in both client and server. (Note that the client cannot use "Express" server stuff):

**Base Response Interface:**
All API response types must extend this base interface to ensure consistency:

```typescript
// Base response interface that all API response types should extend
export interface BaseResponse {
    message?: string; // Success message
    error?: string; // Error message if operation failed
}
```

**Request and Response Types Example:**

```typescript
// HTTP Request info
export type Delete_ReqInfo = {
    fileOrFolderName?: string; // Single item mode
    fileNames?: string[]; // Multiple items mode  
    treeFolder: string; // Parent directory path
}

// HTTP Response info - extends BaseResponse for common properties
export type Delete_ResInfo = BaseResponse & {
    deletedCount?: number; // Present in multiple items mode
    errors?: string[]; // Present if there were errors in multiple items mode
}
```

**Additional Examples:**

```typescript
// Move up/down operation
export type MoveUpDown_ReqInfo = {
    direction: string; // "up" or "down"
    filename: string; // Name of the file or folder to move
    treeFolder: string; // Parent directory path
}

export type MoveUpDown_ResInfo = BaseResponse & {
    file1?: string; // First file involved in the swap
    file2?: string; // Second file involved in the swap
}

// Set public operation
export type SetPublic_ReqInfo = {
    is_public: boolean; // Target public accessibility status
    filename: string; // Name of the file or folder to modify
    treeFolder: string; // Relative path to the parent directory
    recursive?: boolean; // Optional flag for recursive operation
}

export type SetPublic_ResInfo = BaseResponse & {
    // No additional properties beyond base response
}
```

## Server-only Types

In `HttpTypes.ts` we have the server-only types that combine Express types with our endpoint types:

```typescript
import { Request, Response } from 'express';
import { 
    AuthenticationInfo, 
    Delete_ReqInfo, Delete_ResInfo,
    MoveUpDown_ReqInfo, MoveUpDown_ResInfo,
    SetPublic_ReqInfo, SetPublic_ResInfo 
} from "../common/types/EndpointTypes.js";

export type AuthenticatedRequest = Request & AuthenticationInfo;

// Delete operation types
export type DeleteRequest = Request<any, any, Delete_ReqInfo> & AuthenticationInfo;
export type DeleteResponse = Response<Delete_ResInfo>;

// Move up/down operation types
export type MoveUpDownRequest = Request<any, any, MoveUpDown_ReqInfo> & AuthenticationInfo;
export type MoveUpDownResponse = Response<MoveUpDown_ResInfo>;

// Set public operation types
export type SetPublicRequest = Request<any, any, SetPublic_ReqInfo> & AuthenticationInfo;
export type SetPublicResponse = Response<SetPublic_ResInfo>;
```

## Client Call (i.e. runs in web browser)

All client calls must use the typed request/response pattern with generic parameters:

```typescript
const deleteFileOrFolderOnServer = async (gs: DocsGlobalState, fileOrFolderName: string) => {
    try {
        const req: Delete_ReqInfo = {
            fileOrFolderName,
            treeFolder: gs.docsFolder || '/',
        };
        await httpClientUtil.secureHttpPost<Delete_ReqInfo, Delete_ResInfo>('/api/docs/delete', req);
    } catch (error) {
        console.error('Error deleting file or folder on server:', error);
        throw error; // Re-throw to be handled by the caller
    }
}

const moveFileOrFolder = async (direction: 'up' | 'down', filename: string, treeFolder: string) => {
    try {
        const req: MoveUpDown_ReqInfo = {
            direction,
            filename,
            treeFolder,
        };
        const response = await httpClientUtil.secureHttpPost<MoveUpDown_ReqInfo, MoveUpDown_ResInfo>('/api/docs/move-up-down', req);
        
        // Access response properties with full type safety
        if (response && response.file1 && response.file2) {
            console.log(`Swapped ${response.file1} with ${response.file2}`);
        }
    } catch (error) {
        console.error('Error moving file or folder:', error);
        throw error;
    }
}

const setPublicStatus = async (filename: string, treeFolder: string, is_public: boolean, recursive?: boolean) => {
    try {
        const req: SetPublic_ReqInfo = {
            is_public,
            filename,
            treeFolder,
            recursive
        };
        const response = await httpClientUtil.secureHttpPost<SetPublic_ReqInfo, SetPublic_ResInfo>('/api/docs/set-public', req);
        
        if (response?.message) {
            console.log(response.message);
        }
    } catch (error) {
        console.error('Error setting public status:', error);
        throw error;
    }
}
```

## Server Implementation

Server methods must use the strongly typed request and response parameters:

```typescript
delete = async (req: DeleteRequest, res: DeleteResponse): Promise<void> => {
    const owner_id = svrUtil.getOwnerId(req, res);
    if (owner_id == null) return;
    
    // Access request body with full type safety
    const { fileOrFolderName, fileNames, treeFolder } = req.body;
    
    // ... implementation logic ...
    
    // Return typed response
    res.json({
        message: 'Files deleted successfully',
        deletedCount: 5,
        errors: []
    });
}

moveUpOrDown = async (req: MoveUpDownRequest, res: MoveUpDownResponse): Promise<void> => {
    const owner_id = svrUtil.getOwnerId(req, res);
    if (owner_id == null) return;
    
    const { direction, filename, treeFolder } = req.body;
    
    // ... implementation logic ...
    
    res.json({
        message: 'Files moved successfully',
        file1: 'file1.txt',
        file2: 'file2.txt'
    });
}

setPublic = async (req: SetPublicRequest, res: SetPublicResponse): Promise<void> => {
    const owner_id = svrUtil.getOwnerId(req, res);
    if (owner_id == null) return;
    
    const { is_public, filename, treeFolder, recursive } = req.body;
    
    // ... implementation logic ...
    
    res.json({
        message: 'Public status updated successfully'
    });
}
```

## Express Route on Server

Express routes follow a consistent pattern with authentication and async error handling:

```typescript
// In plugin.ts or similar route registration file
context.app.post('/api/docs/delete', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.delete)); 
context.app.post('/api/docs/move-up-down', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.moveUpOrDown));   
context.app.post('/api/docs/set-public', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.setPublic));
```

## Implementation Checklist

When implementing a new API endpoint, follow this checklist:

1. **Create Request/Response Types in `EndpointTypes.ts`:**
   - `<Operation>_ReqInfo` for request parameters
   - `<Operation>_ResInfo` that extends `BaseResponse` for response data

2. **Create Server Types in `HttpTypes.ts`:**
   - `<Operation>Request` combining Express Request with your req info type
   - `<Operation>Response` combining Express Response with your response info type

3. **Update Server Method:**
   - Use the strongly typed request/response parameters
   - Import the new types from `HttpTypes.ts`

4. **Update Client Call:**
   - Use typed request object with proper interface
   - Use `secureHttpPost<ReqType, ResType>` with generic parameters
   - Import types from `EndpointTypes.ts`

5. **Register Express Route:**
   - Use standard pattern with authentication and async error handling

This pattern ensures:
- **Type Safety:** Full TypeScript checking across client and server
- **Consistency:** All endpoints follow the same structure
- **Maintainability:** Common response properties managed in one place
- **Developer Experience:** IntelliSense and compile-time error catching

