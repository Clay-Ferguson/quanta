/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.scss'; 
import QuantaChatPage from './pages/QuantaChatPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import ContactsPage from './pages/ContactsPage.tsx';
import DocViewerPage from './pages/DocViewerPage.tsx'; 
import { GlobalStateProvider, useGlobalDispatch, useGlobalState } from './GlobalState'; 
import {AppService} from './AppService';

// Create a component that connects AppService to the global state
function AppServiceConnector() {
    const gd = useGlobalDispatch();
    const gs = useGlobalState();
    
    useEffect(() => {
        const appService = AppService.getInst();
        appService.setGlobals(gd, gs);
        
        return () => {
            // Optional cleanup if needed
        };
    }, [gd, gs]);
    
    return null; // This component doesn't render anything
}

// Component to handle conditional page rendering
function PageRouter() {
    const { page, userName } = useGlobalState();

    // Until user enters a username, show the settings page, which will tell them why they're seeing it.
    if (!userName) {
        console.log('No username set, in PageRouter, showing settings page');
        return <SettingsPage />;
    }
    
    switch (page) {
    case 'SettingsPage':
        return <SettingsPage />;
    case 'ContactsPage':
        return <ContactsPage />;
    case 'UserGuidePage':
        return <DocViewerPage filename="/user-guide.md" title="User Guide" />;
    case 'QuantaChat':
    default:
        return <QuantaChatPage />;
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