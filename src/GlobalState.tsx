import React, { createContext, useContext, useReducer } from 'react';
import { KeyPairHex } from './CryptoIntf';
import { Contact } from './AppServiceIntf';

const GlobalStateContext = createContext<GlobalState | undefined>(undefined);
const GlobalDispatchContext = createContext<React.Dispatch<GlobalAction> | undefined>(undefined); 
interface GlobalState {
    keyPair: KeyPairHex;
    page: string,
    connected?: boolean;
    roomName: string; 
    userName: string;

    contacts?: Array<Contact>; 

    // todo-0: Here and probably many other places we haven't yet used the new ChatMessage type
    messages: Array<{ content: string; sender: string, timestamp: number, attachments: [] }>; 
    participants: Set<string>;
}

const initialState: GlobalState = {
    keyPair: { privateKey: '', publicKey: '' },
    page: 'QuantaChat',
    connected: false, 
    roomName: '',
    userName: '', 
    messages: [], 
    participants: new Set<string>(),
};

type GlobalAction = { type: string, payload: any};

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
export { GlobalStateProvider, useGlobalState, useGlobalDispatch };