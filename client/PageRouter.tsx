import QuantaChatPage from './pages/QuantaChatPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import ContactsPage from './pages/ContactsPage.tsx';
import DocViewerPage from './pages/DocViewerPage.tsx'; 
import TreeViewerPage from './pages/TreeViewerPage.tsx';
import RoomInfoPage from './pages/RoomInfoPage.tsx';    
import RoomsPage from './pages/RoomsPage.tsx';
import RoomsAdminPage from './pages/RoomsAdminPage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import RecentAttachmentsPage from './pages/RecentAttachmentsPage.tsx';
import { useGlobalState } from './GlobalState.tsx'; 
import { PageNames } from './AppServiceTypes.ts';
import LoadingIndicator from './components/LoadingIndicatorComp.tsx';
import UserProfilePage from './pages/UserProfilePage.tsx';
import LogViewerPage from './pages/LogViewerPage.tsx';

/**
 * Component to handle conditional page rendering based on the current page. This is a SPA and so we don't have the url updating controlling
 * which page is shown, but rather we use a global state variable to track which page is currently being shown, which is actually a stack of pages
 * so that we can do back navigation. The last page in the stack is the current page, and we pop it off when the user navigates back.
*/
export default function PageRouter() {
    const gs = useGlobalState();

    // Show loading indicator while app is initializing
    if (!gs.appInitialized) {
        return <LoadingIndicator />;
    }

    // Until user enters a username, show the settings page, which will tell them why they're seeing it.
    if (!gs.userName) {
        console.log('No username set, in PageRouter, showing settings page');
        return <SettingsPage />;
    }
    
    switch (gs.pages![gs.pages!.length - 1]) {
    case PageNames.settings:
        return <SettingsPage />;
    case PageNames.contacts:
        return <ContactsPage />;
    case PageNames.userGuide:
        return <DocViewerPage filename="/user-guide.md" title="User Guide" />;
    case PageNames.treeViewer:
        return <TreeViewerPage />;
    case PageNames.recentAttachments:
        return <RecentAttachmentsPage />;
    case PageNames.admin:
        return <AdminPage />;
    case PageNames.roomMembers:
        return <RoomInfoPage />;
    case PageNames.rooms:
        return <RoomsPage />;
    case PageNames.roomsAdmin:
        return <RoomsAdminPage />;
    case PageNames.userProfile:
        return <UserProfilePage />;
    case PageNames.logViewer:
        return <LogViewerPage />;
    case PageNames.quantaChat: // fall thru. to default
    default:
        return <QuantaChatPage />;
    }
}

