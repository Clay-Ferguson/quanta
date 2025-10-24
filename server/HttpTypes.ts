import { Request, Response } from 'express';
import { AuthenticationInfo, Delete_ReqInfo, Delete_ResInfo, MoveUpDown_ReqInfo, MoveUpDown_ResInfo, SetPublic_ReqInfo, SetPublic_ResInfo, SaveFile_ReqInfo, SaveFile_ResInfo, CreateFile_ReqInfo, CreateFile_ResInfo, CreateFolder_ReqInfo, CreateFolder_ResInfo } from "../common/types/EndpointTypes.js";

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
