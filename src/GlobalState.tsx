import React, { createContext, useContext, useReducer } from 'react';
import { KeyPairHex } from '../common/CryptoIntf';
import { ChatMessage, Contact, PageNames, RoomHistoryItem } from './AppServiceTypes';
import { User } from '../common/CommonTypes';

const GlobalStateContext = createContext<GlobalState | undefined>(undefined);
const GlobalDispatchContext = createContext<React.Dispatch<GlobalAction> | undefined>(undefined); 
export interface GlobalState {
    keyPair?: KeyPairHex;
    page?: string,
    connecting?: boolean;
    connected?: boolean;
    roomName?: string; 
    userName?: string;
    contacts?: Array<Contact>; 
    messages?: Array<ChatMessage>; 
    participants?: Map<string, User> | null;
    fullSizeImage?: {src: string, name: string} | null;
    appInitialized?: boolean;
    saveToServer?: boolean;
    daysOfHistory?: number;
    roomHistory?: Array<RoomHistoryItem>;
    userDescription?: string;
    userAvatar?: any; // todo-0: what kind is this?
}

const initialState: GlobalState = {
    keyPair: { privateKey: '', publicKey: '' },
    page: PageNames.quantaChat,
    connecting: false,
    connected: false, 
    roomName: '',
    userName: '', 
    messages: [], 
    participants: new Map<string, User>(),
    contacts: [],
    fullSizeImage: null,
    appInitialized: false,
    saveToServer: true,
    daysOfHistory: 30,
    roomHistory: [],
    userDescription: '',
    userAvatar: null
};

export type GlobalAction = { type: string, payload: any};

const globalReducer = (state: GlobalState, action: GlobalAction): GlobalState => {
    console.log('Dispatching action: '+ action.type);
    return {
        ...state,
        ...action.payload
    };
};

interface GlobalStateProviderProps {
  children: React.ReactNode;
}

const GlobalStateProvider: React.FC<GlobalStateProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(globalReducer, initialState);

    return (
        <GlobalDispatchContext.Provider value={dispatch}>
            <GlobalStateContext.Provider value={state}>
                {children}
            </GlobalStateContext.Provider>
        </GlobalDispatchContext.Provider>
    );
};

const useGlobalState = (): GlobalState => {
    const context = useContext(GlobalStateContext);
    if (!context) {
        throw new Error('useGlobalState must be used within a GlobalStateProvider');
    }
    return context;
};

const useGlobalDispatch = (): React.Dispatch<GlobalAction> => {
    const context = useContext(GlobalDispatchContext);
    if (!context) {
        throw new Error('useGlobalDispatch must be used within a GlobalStateProvider');
    }
    return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export { GlobalStateProvider, useGlobalState, useGlobalDispatch};