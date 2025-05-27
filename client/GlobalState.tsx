import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { PageNames, PanelKeys, RoomHistoryItem } from './AppServiceTypes';
import { ChatMessage, Contact, FileBase64Intf, KeyPairHex, User, UserProfile } from '../common/types/CommonTypes';

const GlobalStateContext = createContext<GlobalState | undefined>(undefined);
const GlobalDispatchContext = createContext<React.Dispatch<GlobalAction> | undefined>(undefined); 

let applyStateRules: ((gs: GlobalState) => void) | null = null;

// This function allows us to set a callback that will be called whenever the global state is updated.
// eslint-disable-next-line react-refresh/only-export-components
export function setApplyStateRules(apply: (gs: GlobalState) => void) {
    applyStateRules = apply;
}

export interface GlobalState {
    keyPair?: KeyPairHex;
    // page history so we can go back (we generally don's support going forward tho)
    pages?: Array<string>; 
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
    userAvatar?: FileBase64Intf | null;
    // Note this userProfile is not necessarily OURS, but is just the one we are looking at
    userProfile?: UserProfile | null;
    modalMessage?: string | null;
    showModalButton?: boolean;
    confirmMessage?: string | null;
    promptMessage?: string | null;
    promptDefaultValue?: string | null;
    headerExpanded?: boolean;
    collapsedPanels?: Set<string>;
    devMode?: boolean;
    treeFolder?: string;
    editMode?: boolean; 
}

const initialState: GlobalState = {
    keyPair: { privateKey: '', publicKey: '' },
    pages: [PageNames.quantaChat],
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
    userAvatar: null,
    userProfile: null,
    modalMessage: null,
    showModalButton: true,
    confirmMessage: null,
    promptMessage: null,
    promptDefaultValue: null,
    headerExpanded: false,
    devMode: false,
    treeFolder: '/Quanta-User-Guide', //todo-0: make this not hardcoded
    editMode: false,

    collapsedPanels: new Set<string>([
        PanelKeys.settings_storageSpace,
        PanelKeys.settings_options,
        PanelKeys.settings_identityKeys,
        PanelKeys.settings_dangerZone,
        PanelKeys.settings_Diagnostics,
    ]),
};

export type GlobalAction = { type: string, payload: any};

const globalReducer = (state: GlobalState, action: GlobalAction): GlobalState => {
    console.log('Dispatching action: '+ action.type);
    const ret = {
        ...state,
        ...action.payload
    };

    // Callback to allow domain specific rules to be applied.
    if (applyStateRules) {
        applyStateRules(ret);
    }
    return ret;
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

let globalDispatch: React.Dispatch<GlobalAction> | null = null;
let globalStateRef: React.RefObject<GlobalState> | null = null;

// Create a getter for the global state that always accesses the latest state
function gs(): GlobalState {
    if (!globalStateRef || !globalStateRef.current) {
        throw new Error('Global state ref not initialized');
    }
    return globalStateRef.current;
}
    
// Create a dispatch method that automatically updates both React state and our ref
function gd(action: GlobalAction): GlobalState {
    if (!globalDispatch) {
        throw new Error('Global dispatch not initialized');
    }
      
    // First, update our local state ref with the expected new state
    if (globalStateRef && globalStateRef.current) {
        globalStateRef.current = {
            ...globalStateRef.current,
            ...action.payload
        };
    }
      
    // Then dispatch to React's state management
    globalDispatch(action);
    if (globalStateRef) {
        return globalStateRef.current;
    }
    else throw new Error('Global state ref not initialized');
}

// Component that connects AppService to the global state
function AppServiceConnector() {
    const gd = useGlobalDispatch();
    const gs = useGlobalState();
    
    // Create a ref that always points to the latest state
    const stateRef = useRef<GlobalState>(gs);
    
    // Keep the ref updated with the latest state
    useEffect(() => {
        stateRef.current = gs;
    }, [gs]);
    
    useEffect(() => {
        globalDispatch = gd;
        globalStateRef = stateRef;
        return () => {
            // Optional cleanup if needed
        };
    }, [gd]);
    
    return null; // This component doesn't render anything
}


// eslint-disable-next-line react-refresh/only-export-components
export { GlobalStateProvider, useGlobalState, useGlobalDispatch, gs, gd, AppServiceConnector};