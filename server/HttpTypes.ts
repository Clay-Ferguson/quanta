import { Request, Response } from 'express';
import { AuthenticationInfo, GetRoomInfo_ReqInfo, GetRoomInfo_ResInfo, DeleteRoom_ReqInfo, DeleteRoom_ResInfo, GetRecentAttachments_ReqInfo, GetRecentAttachments_ResInfo, DeleteAttachment_ReqInfo, DeleteAttachment_ResInfo } from "../common/types/EndpointTypes.js";
import { GetMessageIdsForRoom_ReqInfo, GetMessageIdsForRoom_ResInfo } from '../plugins/chat/client/EndpointTypes.js';

// todo-0: These are incomplete, not consistently used throughout the codebase, and even once done we need to split
// apart to where each plugin has it's own copy of these types rather than having them all in common/types

export type AuthenticatedRequest = Request & AuthenticationInfo; 


export type GetMessageIdsForRoomRequest = Request<{ roomId: string }, any, any, GetMessageIdsForRoom_ReqInfo>;
export type GetMessageIdsForRoomResponse = Response<GetMessageIdsForRoom_ResInfo>;

export type GetRoomInfoRequest = Request<any, any, GetRoomInfo_ReqInfo> & AuthenticationInfo;
export type GetRoomInfoResponse = Response<GetRoomInfo_ResInfo>;

export type DeleteRoomRequest = Request<any, any, DeleteRoom_ReqInfo> & AuthenticationInfo;
export type DeleteRoomResponse = Response<DeleteRoom_ResInfo>;

export type GetRecentAttachmentsRequest = Request<any, any, GetRecentAttachments_ReqInfo> & AuthenticationInfo;
export type GetRecentAttachmentsResponse = Response<GetRecentAttachments_ResInfo>;

export type DeleteAttachmentRequest = Request<any, any, DeleteAttachment_ReqInfo> & AuthenticationInfo;
export type DeleteAttachmentResponse = Response<DeleteAttachment_ResInfo>;
