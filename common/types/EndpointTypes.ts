import { AttachmentInfo, ChatMessage, ChatMessageIntf, RoomInfo, TreeNode, UserProfileCompact } from "./CommonTypes.js";

// Authentication properties that can be mixed into any Request type
export interface AuthenticationInfo {
    userProfile?: UserProfileCompact;
    validSignature?: boolean; // Indicates if the request has a valid signature
}

// Base response interface that all API response types should extend
export interface BaseResponse {
    message?: string; // Success message
    error?: string; // Error message if operation failed
}

export type DeleteRoom_Request = {
    roomName: string;
}

export type DeleteMessage_Request = {
    messageId: string;
    roomName: string;
}

export type BlockUser_Request = {
    publicKey: string;
}

export type GetMessagesByIds_Request = {
    ids: string[];
}

export type SendMessages_Request = {
    messages: ChatMessage[];
}

export type GetMessageIdsForRoom_Response = {
    messageIds: string[];
}

export type GetMessageHistory_Response = {
    messages: ChatMessageIntf[];
}

export type GetRoomInfo_Response = {
    rooms: RoomInfo[];
}

export type DeleteRoom_Response = {
    message: string;
}

export type GetRecentAttachments_Response = {
    attachments: AttachmentInfo[]
}

export type GetMessagesByIds_Response = {
    messages: ChatMessageIntf[];
}

export type TreeRender_Response = {
    user_id: number | null;
    treeNodes: TreeNode[];
    rootNode: TreeNode;
    treeFolder?: string; // Returns proper ordinal path for root node being viewed.
}

export type TagCategory = {
    heading: string;
    tags: string[];
}

// HTTP Request info for extractTags
export type ExtractTags_ReqInfo = Record<string, never>; // No request parameters needed - reads from .TAGS.md file

// HTTP Response info for extractTags
export type ExtractTags_ResInfo = BaseResponse & {
    success: boolean;
    tags: string[]; // Kept for backward compatibility, will be deprecated
    categories?: TagCategory[]; // New categorized format
}

// HTTP Request info for scanAndUpdateTags  
export type ScanTags_ReqInfo = Record<string, never>; // No request parameters needed - scans all markdown files

// HTTP Response info for scanAndUpdateTags
export type ScanTags_ResInfo = BaseResponse & {
    success: boolean;
    existingTags: number;
    newTags: number;
    totalTags: number;
}

// HTTP Request info
export type Delete_ReqInfo = { 
    fileOrFolderName?: string; // Single item mode
    fileNames?: string[]; // Multiple items mode  
    treeFolder: string; // Parent directory path
}

// HTTP Response info
export type Delete_ResInfo = BaseResponse & {
    deletedCount?: number; // Present in multiple items mode
    errors?: string[]; // Present if there were errors in multiple items mode
}

// HTTP Request info for move up/down operation
export type MoveUpDown_ReqInfo = {
    direction: string; // "up" or "down"
    filename: string; // Name of the file or folder to move
    treeFolder: string; // Parent directory path
}

// HTTP Response info for move up/down operation
export type MoveUpDown_ResInfo = BaseResponse & {
    file1?: string; // First file involved in the swap
    file2?: string; // Second file involved in the swap
}

// HTTP Request info for set public operation
export type SetPublic_ReqInfo = {
    is_public: boolean; // Target public accessibility status (true=public, false=private)
    filename: string; // Name of the file or folder to modify
    treeFolder: string; // Relative path to the parent directory
    recursive?: boolean; // Optional flag to apply changes recursively to all nested content
}

// HTTP Response info for set public operation
export type SetPublic_ResInfo = BaseResponse & {
    // No additional properties beyond base response
}

// HTTP Request info for save file operation
export type SaveFile_ReqInfo = {
    filename: string; // Name of the file to save
    content: string; // File content to save
    treeFolder: string; // Relative path to the parent directory
    newFileName?: string; // Optional new name for the file (triggers rename)
    split?: boolean; // Whether to split content on '\n~\n' delimiter
}

// HTTP Response info for save file operation
export type SaveFile_ResInfo = BaseResponse & {
    // No additional properties beyond base response
}

// HTTP Request info for create file operation
export type CreateFile_ReqInfo = {
    fileName: string; // Name of the file to create
    treeFolder: string; // Relative path to the parent directory
    insertAfterNode: string; // Name of the file/folder after which to insert the new file
}

// HTTP Response info for create file operation
export type CreateFile_ResInfo = BaseResponse & {
    fileName?: string; // Name of the created file (may differ from requested name if collision occurred)
}

// HTTP Request info for create folder operation
export type CreateFolder_ReqInfo = {
    folderName: string; // Name of the folder to create
    treeFolder: string; // Relative path to the parent directory
    insertAfterNode: string; // Name of the file/folder after which to insert the new folder
}

// HTTP Response info for create folder operation
export type CreateFolder_ResInfo = BaseResponse & {
    folderName?: string; // Name of the created folder
}

// HTTP Request info for build folder operation (convert file to folder)
export type BuildFolder_ReqInfo = {
    filename: string; // Name of the existing file to convert to folder
    folderName: string; // Desired name for the new folder
    remainingContent: string; // Optional content to save in a new file inside the folder
    treeFolder: string; // Relative path to the parent directory
}

// HTTP Response info for build folder operation
export type BuildFolder_ResInfo = BaseResponse & {
    folderName?: string; // Name of the created folder
    fileName?: string; // Name of the file created inside the folder (if remainingContent provided)
}

// HTTP Request info for rename folder operation
export type RenameFolder_ReqInfo = {
    oldFolderName: string; // Current name of the folder to rename
    newFolderName: string; // New name for the folder
    treeFolder: string; // Relative path to the parent directory
}

// HTTP Response info for rename folder operation
export type RenameFolder_ResInfo = BaseResponse & {
    // No additional properties beyond base response
}

// HTTP Request info for paste items operation
export type PasteItems_ReqInfo = {
    targetFolder: string; // Target folder path where items will be pasted
    pasteItems: string[]; // Array of item names to paste
    targetOrdinal?: number; // Optional target ordinal position for insertion
}

// HTTP Response info for paste items operation
export type PasteItems_ResInfo = BaseResponse & {
    pastedCount?: number; // Number of items successfully pasted
    totalItems?: number; // Total number of items attempted to paste
    errors?: string[]; // Array of error messages for failed paste operations
}

// HTTP Request info for join files operation
export type JoinFiles_ReqInfo = {
    filenames: string[]; // Array of filenames to join together
    treeFolder: string; // Relative path to the parent directory
}

// HTTP Response info for join files operation
export type JoinFiles_ResInfo = BaseResponse & {
    joinedFile?: string; // Name of the resulting joined file
    deletedFiles?: string[]; // Array of deleted file names that were joined
}

// HTTP Request info for search operation
export type Search_ReqInfo = {
    query?: string; // Search query string
    treeFolder: string; // Relative path to search within
    searchMode?: string; // Search mode (e.g., 'MATCH_ANY', 'MATCH_ALL', 'REGEX')
    searchOrder?: string; // Search result ordering (e.g., 'MOD_TIME')
}

// HTTP Response info for search operation
export type Search_ResInfo = BaseResponse & {
    query?: string; // The search query that was executed
    searchPath?: string; // The path that was searched
    searchMode?: string; // The search mode that was used
    resultCount?: number; // Number of results found
    results?: any[]; // Array of search results
}

