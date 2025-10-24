## Architectural Pattern for HTTP/REST Calls

To describe the architectural pattern we're using to achieve type safety across the client and server REST/HTTP call Communications, you can look at the following example for the `delete` endpoint which is currently being done correctly following the correct pattern:

## Client & Server Types

In `EndpointTypes.ts` we define the types that can work in both client and server. (Note that the client cannot use "Express" server stuff):

```
// HTTP Request info
export type Delete_ReqInfo = {
    fileOrFolderName?: string; // Single item mode
    fileNames?: string[]; // Multiple items mode  
    treeFolder: string; // Parent directory path
}

// HTTP Response info
export type Delete_ResInfo = {
    message?: string; // Success message
    error?: string; // Single error message (for validation errors)
    deletedCount?: number; // Present in multiple items mode
    errors?: string[]; // Present if there were errors in multiple items mode
}
```

## Server-only Types

In `HttpTypes.ts` we have the server-only types:

```
import { Request, Response } from 'express';
import { AuthenticationInfo, Delete_ReqInfo, Delete_ResInfo } from "../common/types/EndpointTypes.js";

export type AuthenticatedRequest = Request & AuthenticationInfo;

export type DeleteRequest = Request<any, any, Delete_ReqInfo> & AuthenticationInfo;
export type DeleteResponse = Response<Delete_ResInfo>;
```

## Client Call (i.e. runs in web browser)

```
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
```

## Server Implementation

```
  delete = async (req: DeleteRequest, res: DeleteResponse): 
    Promise<void> => {
    ...the rest omitted
```

## Express Route on Server

```
context.app.post('/api/docs/delete', httpServerUtil.verifyReqHTTPSignature, asyncHandler(docMod.delete)); 
```

