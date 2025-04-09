/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.scss'; 
import QuantaChat from './QuantaChat.tsx';
import SettingsPage from './components/SettingsPage.tsx';
import ContactsPage from './components/ContactsPage.tsx';
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

// Component to handle conditional page rendering
function PageRouter() {
    const { page } = useGlobalState();
    
    switch (page) {
    case 'SettingsPage':
        return <SettingsPage />;
    case 'ContactsPage':
        return <ContactsPage />;
    case 'QuantaChat':
    default:
        return <QuantaChat />;
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <GlobalStateProvider> 
            <AppServiceConnector />
            <PageRouter />
        </GlobalStateProvider>
    </StrictMode>,
);

const appService = AppService.getInst();
if (appService) {
    console.log('AppService singleton initialized successfully');
}