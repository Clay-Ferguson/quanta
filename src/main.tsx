/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.scss'; 
import QuantaChatPage from './pages/QuantaChatPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import ContactsPage from './pages/ContactsPage.tsx';
import DocViewerPage from './pages/DocViewerPage.tsx'; 
import RoomInfoPage from './pages/RoomInfoPage.tsx';
import RoomsPage from './pages/RoomsPage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import RecentAttachmentsPage from './pages/RecentAttachmentsPage.tsx';
import { GlobalStateProvider, useGlobalDispatch, useGlobalState } from './GlobalState'; 
import {app} from './AppService';
import { PageNames } from './AppServiceTypes.ts';
import LoadingIndicator from './components/LoadingIndicatorComp.tsx';

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
    case PageNames.recentAttachments:
        return <RecentAttachmentsPage />;
    case PageNames.admin:
        return <AdminPage />;
    case PageNames.roomMembers:
        return <RoomInfoPage />;
    case PageNames.rooms:
        return <RoomsPage />;
    case PageNames.quantaChat: // fall thru. to default
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
