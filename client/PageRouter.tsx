import SettingsPage from './pages/SettingsPage.tsx';
import DocViewerPage from './pages/DocViewerPage.tsx'; 
import AdminPage from './pages/AdminPage.tsx';
import { useGlobalState } from './GlobalState.tsx'; 
import { PageNames } from './AppServiceTypes.ts';
import LoadingIndicator from './components/LoadingIndicatorComp.tsx';
import UserProfilePage from './pages/UserProfilePage.tsx';
import LogViewerPage from './pages/LogViewerPage.tsx';
import { pluginsArray } from './AppService.ts';

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
    // todo-0: need to delegate the following to the plugins, so that they can decide if they want to show the settings page or not.
    // if (!gs.userName && !(DOC_ROOT_KEY && topPage === PageNames.treeViewer)) {
    //     console.log('No username set, in PageRouter, showing settings page');
    //     return <SettingsPage />;
    // }
    
    // first let any of the plugins handle the page routing
    for (const plugin of pluginsArray) {
        if (plugin.getRoute) {
            // console.log(`PageRouter: checking plugin ${plugin.name} for route for page: ${topPage}`);
            const comp = plugin.getRoute(topPage);
            if (comp) {
                // console.log(`PageRouter: routing to page: ${topPage}`);
                return comp;
            }
        }
    }

    switch (topPage) {
    case PageNames.settings:
        return <SettingsPage />;
    case PageNames.userGuide:
        return <DocViewerPage filename="/user_guide.md" title="User Guide" />;
    case PageNames.admin:
        return <AdminPage />;
    case PageNames.userProfile:
        return <UserProfilePage />;
    case PageNames.logViewer:
        return <LogViewerPage />;
    default:
        console.warn(`PageRouter: No route found for page: ${topPage}`);
        return null; // need to return something visible that just indicates the page is not found
    }
}

