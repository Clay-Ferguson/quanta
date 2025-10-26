import { UserProfileCompact } from "./CommonTypes.js";

export interface AuthenticationInfo {
    userProfile?: UserProfileCompact;
    validSignature?: boolean; 
}

export interface BaseResponse {
    message?: string;
    error?: string;
}



