import { ChatMessage, Contact, User } from "../../../common/types/CommonTypes";
import { RoomHistoryItem } from "../../../client/AppServiceTypes";
import { GlobalState } from "../../../client/GlobalState";
import { gd as gdBase, gs as gsBase, GlobalAction, useGlobalState as useGlobalStateBase } from "../../../client/GlobalState.tsx";

export enum ChatPageNames {
    contacts = 'ContactsPage',
    quantaChat = 'QuantaChatPage',
    recentAttachments = 'RecentAttachmentsPage',
    roomMembers = 'RoomInfoPage',
    rooms = 'RoomsPage',
    roomsAdmin = 'RoomsAdminPage',
    chatUserGuide = 'ChatUserGuidePage',
}

export interface ChatGlobalState extends GlobalState {
    chatRoom?: string; 
    chatConnecting?: boolean;
    chatConnected?: boolean;  
    chatContacts?: Array<Contact>; 
    chatMessages?: Array<ChatMessage>; 
    chatParticipants?: Map<string, User> | null;
    chatSaveToServer?: boolean;
    chatDaysOfHistory?: number;
    chatRoomHistory?: Array<RoomHistoryItem>;
}

// =============================================
// STATE MANAGEMENT BOLIER PLATE
// Each plugin will have an identical section to this, but with their own GlobalState type. Yes this is
// slightly ugly, but the reason it's worth it is becasue using this pattern allows the rest of the code
// for any given plugin to be very clean and not have to be using parameterized types everywhere a state us 
// used.

// Chat-specific action type that can handle both base and chat-specific properties
export type ChatGlobalAction = { type: string, payload: Partial<ChatGlobalState> };

// Type-safe re-exports of gd and gs that work with ChatGlobalState
export function gd(action: ChatGlobalAction): ChatGlobalState {
    // Cast to GlobalAction for the base function call, but maintain type safety for chat-specific properties
    return gdBase(action as GlobalAction) as ChatGlobalState;
}

export function gs(): ChatGlobalState {
    return gsBase() as ChatGlobalState;
}

// Type-safe re-export of useGlobalState that works with ChatGlobalState
export function useGlobalState(): ChatGlobalState {
    return useGlobalStateBase() as ChatGlobalState;
}
// =============================================

