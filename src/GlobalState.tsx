import React, { createContext, useContext, useReducer } from 'react';

// 1. Define the Contexts
const GlobalStateContext = createContext<GlobalState | undefined>(undefined); // Allow undefined for initial render
const GlobalDispatchContext = createContext<React.Dispatch<GlobalAction> | undefined>(undefined); // Explicitly type the dispatch context

// 2. Define the Initial State (You can customize this based on your app's needs)
interface GlobalState {
    connected?: boolean; // Optional, not in the GlobalState interface but can be added if needed
    roomName: string; // 
    userName: string; // Example property, you can remove or modify it as needed
    messages: Array<{ content: string; sender: string, timestamp: number, attachments: [] }>; // Example message structure
    participants: Set<string>; // Set of participant IDs
}

const initialState: GlobalState = {
    connected: false, // This property is not in the GlobalState interface but can be added if needed
    roomName: 'romper',
    userName: 'clay', // Default username, can be change
    messages: [], // Initialize with an empty array
    participants: new Set<string>(), // Initialize with an empty Set
};

// 3. Define the Actions Type (Optional but good for type safety)
type GlobalAction = { type: string, payload: any};

// 4. Define the Reducer Function
const globalReducer = (state: GlobalState, action: GlobalAction): GlobalState => {
    console.log('Dispatching action: '+ action.type); // Log the action being dispatched
    return {
        ...state,
        ...action.payload, // Merge the new state into the existing state
    };
};

// 5. Create the Provider Component
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

// 6. Create Custom Hooks to Consume the Context
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

export { GlobalStateProvider, useGlobalState, useGlobalDispatch };