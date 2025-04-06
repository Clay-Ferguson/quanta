/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.scss'; 
import './index.css';
import QuantaChat from './QuantaChat.tsx';
import { GlobalStateProvider, useGlobalDispatch, useGlobalState } from './GlobalState'; 
import AppService from './AppService';

// Create a component that connects AppService to the global state
function AppServiceConnector() {
    const dispatch = useGlobalDispatch();
    const globalState = useGlobalState();
    
    useEffect(() => {
        const appService = AppService.getInst();
        appService.setGlobals(dispatch, globalState);
        
        return () => {
            // Optional cleanup if needed
        };
    }, [dispatch, globalState]);
    
    return null; // This component doesn't render anything
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <GlobalStateProvider> 
            <AppServiceConnector />
            <QuantaChat />
        </GlobalStateProvider>
    </StrictMode>,
);

const appService = AppService.getInst();
if (appService) {
    console.log('AppService singleton initialized successfully');
}