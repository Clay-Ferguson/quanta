import { AttachmentInfo, ChatMessage, ChatMessageIntf, RoomInfo, TreeNode, UserProfileCompact } from "./CommonTypes.js";

// todo-0: These are incomplete, not consistently used throughout the codebase, and even once done we need to split
// apart to where each plugin has it's own copy of these types rather than having them all in common/types

export interface AuthenticationInfo {
    userProfile?: UserProfileCompact;
    validSignature?: boolean;
}

export interface BaseResponse {
    message?: string;
    error?: string;
}

export type DeleteMessage_ReqInfo = {
    messageId: string;
    roomName: string;
}

export type DeleteMessage_ResInfo = BaseResponse & {
}

export type BlockUser_ReqInfo = {
    publicKey: string;
}

export type BlockUser_ResInfo = BaseResponse & {
}


export type GetMessagesByIds_ReqInfo = {
    ids: string[];
}

export type SendMessages_ReqInfo = {
    messages: ChatMessage[];
}

export type GetMessageIdsForRoom_ReqInfo = {
    daysOfHistory?: number;
}

export type GetMessageIdsForRoom_ResInfo = BaseResponse & {
    messageIds: string[];
}

export type GetMessageHistory_ReqInfo = {
    roomName: string;
    limit?: number;
    offset?: number;
}

export type GetMessageHistory_ResInfo = BaseResponse & {
    messages: ChatMessageIntf[];
}

export type GetRoomInfo_ReqInfo = Record<string, never>;

export type GetRoomInfo_ResInfo = BaseResponse & {
    rooms: RoomInfo[];
}

export type DeleteRoom_ReqInfo = {
    roomName: string;
}

export type DeleteRoom_ResInfo = BaseResponse & {
    message?: string;
}

export type GetRecentAttachments_ReqInfo = Record<string, never>;

export type GetRecentAttachments_ResInfo = {
    attachments: AttachmentInfo[]
}

export type GetMessagesByIds_Response = {
    messages: ChatMessageIntf[];
}

export type TreeRender_Response = {
    user_id: number | null;
    treeNodes: TreeNode[];
    rootNode: TreeNode;
    treeFolder?: string;
}

export type TagCategory = {
    heading: string;
    tags: string[];
}

export type ExtractTags_ReqInfo = Record<string, never>;

export type ExtractTags_ResInfo = BaseResponse & {
    success: boolean;
    tags: string[];
    categories?: TagCategory[];
}

export type ScanTags_ReqInfo = Record<string, never>;

export type ScanTags_ResInfo = BaseResponse & {
    success: boolean;
    existingTags: number;
    newTags: number;
    totalTags: number;
}

export type Delete_ReqInfo = { 
    fileOrFolderName?: string;
    fileNames?: string[];
    treeFolder: string;
}

export type Delete_ResInfo = BaseResponse & {
    deletedCount?: number;
    errors?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type UploadFiles_ReqInfo = {
}

export type UploadFiles_ResInfo = BaseResponse & {
    
}

export type MoveUpDown_ReqInfo = {
    direction: string;
    filename: string;
    treeFolder: string;
}

export type MoveUpDown_ResInfo = BaseResponse & {
    file1?: string;
    file2?: string;
}

export type SetPublic_ReqInfo = {
    is_public: boolean;
    filename: string;
    treeFolder: string;
    recursive?: boolean;
}

export type SetPublic_ResInfo = BaseResponse & {
}

export type SaveFile_ReqInfo = {
    filename: string;
    content: string;
    treeFolder: string;
    newFileName?: string;
    split?: boolean;
}

export type SaveFile_ResInfo = BaseResponse & {
}

export type CreateFile_ReqInfo = {
    fileName: string;
    treeFolder: string;
    insertAfterNode: string;
}

export type CreateFile_ResInfo = BaseResponse & {
    fileName?: string;
}

export type CreateFolder_ReqInfo = {
    folderName: string;
    treeFolder: string;
    insertAfterNode: string;
}

export type CreateFolder_ResInfo = BaseResponse & {
    folderName?: string;
}

export type BuildFolder_ReqInfo = {
    filename: string;
    folderName: string;
    remainingContent: string;
    treeFolder: string;
}

export type BuildFolder_ResInfo = BaseResponse & {
    folderName?: string;
    fileName?: string;
}

export type RenameFolder_ReqInfo = {
    oldFolderName: string;
    newFolderName: string;
    treeFolder: string;
}

export type RenameFolder_ResInfo = BaseResponse & {
}

export type PasteItems_ReqInfo = {
    targetFolder: string;
    pasteItems: string[];
    targetOrdinal?: number;
}

export type PasteItems_ResInfo = BaseResponse & {
    pastedCount?: number;
    totalItems?: number;
    errors?: string[];
}

export type JoinFiles_ReqInfo = {
    filenames: string[];
    treeFolder: string;
}

export type JoinFiles_ResInfo = BaseResponse & {
    joinedFile?: string;
    deletedFiles?: string[];
}

export type Search_ReqInfo = {
    query?: string;
    treeFolder: string;
    searchMode?: string;
    searchOrder?: string;
}

export type Search_ResInfo = BaseResponse & {
    query?: string;
    searchPath?: string;
    searchMode?: string;
    resultCount?: number;
    results?: any[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type DeleteAttachment_ReqInfo = {
}

export type DeleteAttachment_ResInfo = BaseResponse & {
}

