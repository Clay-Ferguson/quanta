import { Request } from 'express';
import { AuthenticationInfo } from "../common/types/EndpointTypes.js";

export type AuthenticatedRequest = Request & AuthenticationInfo;
