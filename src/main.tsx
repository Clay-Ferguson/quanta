/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.scss'; 
import QuantaChatPage from './pages/QuantaChatPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import ContactsPage from './pages/ContactsPage.tsx';
import DocViewerPage from './pages/DocViewerPage.tsx'; 
import { GlobalStateProvider, useGlobalDispatch, useGlobalState } from './GlobalState'; 
import {app} from './AppService';
import { PageNames } from './AppServiceTypes.ts';

// Create a component that connects AppService to the global state
function AppServiceConnector() {
    const gd = useGlobalDispatch();
    const gs = useGlobalState();
    
    useEffect(() => {
        app.setGlobals(gd, gs);
        
        return () => {
            // Optional cleanup if needed
        };
    }, [gd, gs]);
    
    return null; // This component doesn't render anything
}

// Loading indicator component
// todo-0: put this in it's own file.
function LoadingIndicator() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
                <div className="inline-block relative">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-400 border-t-transparent animate-spin mb-4"></div>
                </div>
                <h2 className="text-xl font-semibold text-blue-400 mt-4">Loading Quanta Chat</h2>
            </div>
        </div>
    );
}

// Component to handle conditional page rendering
function PageRouter() {
    const { page, userName, appInitialized } = useGlobalState();

    // Show loading indicator while app is initializing
    if (!appInitialized) {
        return <LoadingIndicator />;
    }

    // Until user enters a username, show the settings page, which will tell them why they're seeing it.
    if (!userName) {
        console.log('No username set, in PageRouter, showing settings page');
        return <SettingsPage />;
    }
    
    switch (page) {
    case PageNames.settings:
        return <SettingsPage />;
    case PageNames.contacts:
        return <ContactsPage />;
    case PageNames.userGuide:
        return <DocViewerPage filename="/user-guide.md" title="User Guide" />;
    case PageNames.quantaChat:
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
