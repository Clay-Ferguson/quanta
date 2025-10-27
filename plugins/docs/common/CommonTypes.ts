import { BaseResponse } from "../../../common/types/CommonTypes.js";

export type CompactTreeNode = {
    uuid: string;
    parent_path: string;
    filename: string;
    ordinal: number;
}

export type TreeNode = {
    uuid?: string; // unique identifier for the node, used for VFS
    owner_id?: number; // owner user ID, if applicable
    is_directory?: boolean; 
    is_public?: boolean; 
    name: string; // filename
    url?: string; // this will be the FULL url independent of currently viewed root, so we can show 'pull up' images in the tree easier.
    createTime: number;
    modifyTime: number;
    content: string;
    children?: TreeNode[] | null; // subdirectories or files (pullups only)
    fsChildren?: boolean; // true if this node has children in the file system
    ordinal?: number; // ordinal value for file/folder ordering (used in VFS)
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type TreeRender_ReqInfo = { 
}

export type TreeRender_ResInfo = BaseResponse & {
    user_id: number | null;
    treeNodes: TreeNode[];
    rootNode: TreeNode;
    treeFolder?: string;
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

