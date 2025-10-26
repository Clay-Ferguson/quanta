import { Request } from 'express';
import { AuthenticationInfo } from '../common/types/CommonTypes.js';

// todo-0: These are incomplete, not consistently used throughout the codebase, and even once done we need to split
// apart to where each plugin has it's own copy of these types rather than having them all in common/types

export type AuthenticatedRequest = Request & AuthenticationInfo; 



