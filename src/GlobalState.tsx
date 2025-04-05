import React, { createContext, useContext, useReducer } from 'react';

// 1. Define the Contexts
const GlobalStateContext = createContext<GlobalState | undefined>(undefined); // Allow undefined for initial render
const GlobalDispatchContext = createContext<React.Dispatch<GlobalAction> | undefined>(undefined); // Explicitly type the dispatch context

// 2. Define the Initial State (You can customize this based on your app's needs)
interface GlobalState {
  someData: string;
  count: number;
  user: { id: number; name: string } | null;
  // Add other global state properties here
}

const initialState: GlobalState = {
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