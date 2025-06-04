import QuantaChatPage from './plugins/chat/pages/QuantaChatPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import ContactsPage from './plugins/chat/pages/ContactsPage.tsx';
import DocViewerPage from './pages/DocViewerPage.tsx'; 
import TreeViewerPage from './plugins/docs/pages/TreeViewerPage.tsx';
import RoomInfoPage from './plugins/chat/pages/RoomInfoPage.tsx';    
import RoomsPage from './plugins/chat/pages/RoomsPage.tsx';
import RoomsAdminPage from './plugins/chat/pages/RoomsAdminPage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import RecentAttachmentsPage from './plugins/chat/pages/RecentAttachmentsPage.tsx';
import { useGlobalState } from './GlobalState.tsx'; 
import { PageNames } from './AppServiceTypes.ts';
import LoadingIndicator from './components/LoadingIndicatorComp.tsx';
import UserProfilePage from './pages/UserProfilePage.tsx';
import LogViewerPage from './pages/LogViewerPage.tsx';
import SearchViewPage from './pages/SearchViewPage.tsx';

declare const DOC_ROOT_KEY: string;

/**
 * Component to handle conditional page rendering based on the current page. This is a SPA and so we don't have the url updating controlling
 * which page is shown, but rather we use a global state variable to track which page is currently being shown, which is actually a stack of pages
 * so that we can do back navigation. The last page in the stack is the current page, and we pop it off when the user navigates back.
*/
export default function PageRouter() {
    const gs = useGlobalState();
    const topPage = gs.pages![gs.pages!.length - 1];
    console.log('PageRouter, topPage:'+topPage+" DOC_ROOT_KEY:"+DOC_ROOT_KEY+" gs.userName:"+gs.userName);

    // Show loading indicator while app is initializing
    if (!gs.appInitialized) {
        return <LoadingIndicator />;
    }

    // Until user enters a username, show the settings page, which will tell them why they're seeing it, unless th
    // DOC_ROOT_KEY is set, in which case we assume the user is using the app just to view documents and not necessarily to chat.
    if (!gs.userName && !(DOC_ROOT_KEY && topPage === PageNames.treeViewer)) {
        console.log('No username set, in PageRouter, showing settings page');
        return <SettingsPage />;
    }
    
    switch (topPage) {
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
    case PageNames.searchView:
        return <SearchViewPage />;
    case PageNames.quantaChat: // fall thru. to default
    default:
        return <QuantaChatPage />;
    }
}

