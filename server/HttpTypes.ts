import { Request, Response } from 'express';
import { AuthenticationInfo, Delete_ReqInfo, Delete_ResInfo, MoveUpDown_ReqInfo, MoveUpDown_ResInfo, SetPublic_ReqInfo, SetPublic_ResInfo, SaveFile_ReqInfo, SaveFile_ResInfo, CreateFile_ReqInfo, CreateFile_ResInfo, CreateFolder_ReqInfo, CreateFolder_ResInfo, BuildFolder_ReqInfo, BuildFolder_ResInfo, RenameFolder_ReqInfo, RenameFolder_ResInfo, PasteItems_ReqInfo, PasteItems_ResInfo, JoinFiles_ReqInfo, JoinFiles_ResInfo, Search_ReqInfo, Search_ResInfo, ExtractTags_ReqInfo, ExtractTags_ResInfo, ScanTags_ReqInfo, ScanTags_ResInfo } from "../common/types/EndpointTypes.js";

export type AuthenticatedRequest = Request & AuthenticationInfo; 

export type DeleteRequest = Request<any, any, Delete_ReqInfo> & AuthenticationInfo;
export type DeleteResponse = Response<Delete_ResInfo>;

export type MoveUpDownRequest = Request<any, any, MoveUpDown_ReqInfo> & AuthenticationInfo;
export type MoveUpDownResponse = Response<MoveUpDown_ResInfo>;

export type SetPublicRequest = Request<any, any, SetPublic_ReqInfo> & AuthenticationInfo;
export type SetPublicResponse = Response<SetPublic_ResInfo>;

export type SaveFileRequest = Request<any, any, SaveFile_ReqInfo> & AuthenticationInfo;
export type SaveFileResponse = Response<SaveFile_ResInfo>;

export type CreateFileRequest = Request<any, any, CreateFile_ReqInfo> & AuthenticationInfo;
export type CreateFileResponse = Response<CreateFile_ResInfo>;

export type CreateFolderRequest = Request<any, any, CreateFolder_ReqInfo> & AuthenticationInfo;
export type CreateFolderResponse = Response<CreateFolder_ResInfo>;

export type BuildFolderRequest = Request<any, any, BuildFolder_ReqInfo> & AuthenticationInfo;
export type BuildFolderResponse = Response<BuildFolder_ResInfo>;

export type RenameFolderRequest = Request<any, any, RenameFolder_ReqInfo> & AuthenticationInfo;
export type RenameFolderResponse = Response<RenameFolder_ResInfo>;

export type PasteItemsRequest = Request<any, any, PasteItems_ReqInfo> & AuthenticationInfo;
export type PasteItemsResponse = Response<PasteItems_ResInfo>;

export type JoinFilesRequest = Request<any, any, JoinFiles_ReqInfo> & AuthenticationInfo;
export type JoinFilesResponse = Response<JoinFiles_ResInfo>;

export type SearchRequest = Request<any, any, Search_ReqInfo> & AuthenticationInfo;
export type SearchResponse = Response<Search_ResInfo>;

export type ExtractTagsRequest = Request<any, any, ExtractTags_ReqInfo> & AuthenticationInfo;
export type ExtractTagsResponse = Response<ExtractTags_ResInfo>;

export type ScanTagsRequest = Request<any, any, ScanTags_ReqInfo> & AuthenticationInfo;
export type ScanTagsResponse = Response<ScanTags_ResInfo>;
