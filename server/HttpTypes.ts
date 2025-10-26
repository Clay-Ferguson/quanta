import { Request } from 'express';
import { AuthenticationInfo } from '../common/types/CommonTypes.js';

export type AuthenticatedRequest = Request & AuthenticationInfo; 



