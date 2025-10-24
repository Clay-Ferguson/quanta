import { Request, Response } from 'express';
import { AuthenticationInfo, Delete_ReqInfo, Delete_ResInfo, MoveUpDown_ReqInfo, MoveUpDown_ResInfo } from "../common/types/EndpointTypes.js";

export type AuthenticatedRequest = Request & AuthenticationInfo; 

export type DeleteRequest = Request<any, any, Delete_ReqInfo> & AuthenticationInfo;
export type DeleteResponse = Response<Delete_ResInfo>;

export type MoveUpDownRequest = Request<any, any, MoveUpDown_ReqInfo> & AuthenticationInfo;
export type MoveUpDownResponse = Response<MoveUpDown_ResInfo>;
