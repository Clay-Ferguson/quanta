import { Request, Response } from 'express';
import { BlockUser_ReqInfo, BlockUser_ResInfo, DeleteAttachment_ReqInfo, DeleteAttachment_ResInfo, DeleteMessage_ReqInfo, DeleteMessage_ResInfo, DeleteRoom_ReqInfo, DeleteRoom_ResInfo, GetMessageHistory_ReqInfo, GetMessageHistory_ResInfo, GetMessageIdsForRoom_ReqInfo, GetMessageIdsForRoom_ResInfo, GetRecentAttachments_ReqInfo, GetRecentAttachments_ResInfo, GetRoomInfo_ReqInfo, GetRoomInfo_ResInfo} from '../common/CommonTypes.js';
import { AuthenticationInfo } from '../../../common/types/CommonTypes.js';

export type DeleteMessageRequest = Request<any, any, DeleteMessage_ReqInfo> & AuthenticationInfo;
export type DeleteMessageResponse = Response<DeleteMessage_ResInfo>;

export type BlockUserRequest = Request<any, any, BlockUser_ReqInfo> & AuthenticationInfo;
export type BlockUserResponse = Response<BlockUser_ResInfo>;

export type GetMessageHistoryRequest = Request<any, any, any, GetMessageHistory_ReqInfo>;
export type GetMessageHistoryResponse = Response<GetMessageHistory_ResInfo>;

export type GetRoomInfoRequest = Request<any, any, GetRoomInfo_ReqInfo> & AuthenticationInfo;
export type GetRoomInfoResponse = Response<GetRoomInfo_ResInfo>;

export type DeleteRoomRequest = Request<any, any, DeleteRoom_ReqInfo> & AuthenticationInfo;
export type DeleteRoomResponse = Response<DeleteRoom_ResInfo>;

export type GetRecentAttachmentsRequest = Request<any, any, GetRecentAttachments_ReqInfo> & AuthenticationInfo;
export type GetRecentAttachmentsResponse = Response<GetRecentAttachments_ResInfo>;

export type DeleteAttachmentRequest = Request<any, any, DeleteAttachment_ReqInfo> & AuthenticationInfo;
export type DeleteAttachmentResponse = Response<DeleteAttachment_ResInfo>;

export type GetMessageIdsForRoomRequest = Request<{ roomId: string }, any, any, GetMessageIdsForRoom_ReqInfo>;
export type GetMessageIdsForRoomResponse = Response<GetMessageIdsForRoom_ResInfo>;
