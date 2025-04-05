import React, { createContext, useContext, useReducer } from 'react';

// 1. Define the Contexts
const GlobalStateContext = createContext<GlobalState | undefined>(undefined); // Allow undefined for initial render
const GlobalDispatchContext = createContext<React.Dispatch<GlobalAction> | undefined>(undefined); // Explicitly type the dispatch context

// 2. Define the Initial State (You can customize this based on your app's needs)
interface GlobalState {
    userName: string; // Example property, you can remove or modify it as needed
    messages: Array<{ content: string; sender: string, timestamp: number }>; // Example message structure
    participants: Set<string>; // Set of participant IDs
    // ---------- The rest are from demo  
    someData: string;
    count: number;
    user: { id: number; name: string } | null;
    // Add other global state properties here
}

const initialState: GlobalState = {
    userName: 'clay', // Default username, can be change
    messages: [
        // Example initial messages, you can start with an empty array or some default messages
        // add 10 mssages
        { content: 'Welcome to QuantaChat!', sender: 'clay', timestamp: Date.now() }, // Add timestamp for each message
        { content: 'Feel free to chat!', sender: 'system', timestamp: Date.now() }, // Add timestamp for each message
        { content: 'How can I help you today?', sender: 'clay', timestamp: Date.now() }, // Add timestamp for each message
        { content: 'Enjoy your stay!', sender: 'system', timestamp: Date.now() }, // Add timestamp for each message
        { content: 'Have a great day!', sender: 'clay', timestamp: Date.now()},
        { content: 'Let us know if you have any questions.', sender: 'system', timestamp: Date.now() },
        { content: 'We are here to assist you.', sender: 'system' , timestamp: Date.now()},
        { content: 'Feel free to explore the features.', sender: 'system' , timestamp: Date.now()},
        { content: 'Join the conversation anytime.', sender: 'system' , timestamp: Date.now()},
        { content: 'Thank you for being here!', sender: 'system', timestamp: Date.now() }
    ], // Initialize with an empty array
    participants: new Set<string>(), // Initialize with an empty Set
    // ---------- The rest are from demo
    someData: 'Initial Data',
    count: 0,
    user: null,
};

// 3. Define the Actions Type (Optional but good for type safety)
type GlobalAction =
  | { type: 'SET_SOME_DATA'; payload: string }
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT' }
  | { type: 'LOGIN'; payload: { id: number; name: string } }
  | { type: 'LOGOUT' };

// 4. Define the Reducer Function
const globalReducer = (state: GlobalState, action: GlobalAction): GlobalState => {
    switch (action.type) {
    case 'SET_SOME_DATA':
        return { ...state, someData: action.payload };
    case 'INCREMENT':
        return { ...state, count: state.count + 1 };
    case 'DECREMENT':
        return { ...state, count: state.count - 1 };
    case 'LOGIN':
        return { ...state, user: action.payload };
    case 'LOGOUT':
        return { ...state, user: null };
    default:
        return state;
    }
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