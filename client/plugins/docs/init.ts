import React from 'react';
import { DBKeys, IClientPlugin } from "../../AppServiceTypes";
import TreeViewerPage from "./pages/TreeViewerPage";
import SearchViewPage from './SearchViewPage';
import { TreeNode, UserProfile } from '../../../common/types/CommonTypes';
import { DocsGlobalState, DocsPageNames } from './DocsTypes';
import { GlobalState } from '../../GlobalState';
import { idb } from '../../IndexedDB';
import { app } from '../../AppService';

class DocsClientPlugin implements IClientPlugin {

    getKey(): string {
        return 'docs';
    }

    async init(context: any) {
        console.log('Initializing Quanta Docs plugin...');
        const gs: DocsGlobalState = context.initGs;
        gs.docsFolder = '/'; 
        gs.docsEditMode = false;
        gs.docsMetaMode = false;
        gs.docsNamesMode = false;
        gs.docsEditNode = null;
        gs.docsEditContent = null;
        gs.docsNewFolderName = null;
        gs.docsNewFileName = null;
        gs.docsSelItems = new Set<TreeNode>();
        gs.docsCutItems = new Set<string>();
        gs.docsRootKey = 'root'; // defined in config.yaml
        gs.docsViewWidth = 'medium';
        gs.docsSearch = '';
        gs.docsSearchResults = [];
        gs.docsSearchOriginFolder = '';
        gs.docsLastSearch = '';
        gs.docsSearchMode = 'MATCH_ANY';
        gs.docsHighlightedFolderName = null;
    }

    async notify(): Promise<void> {
        // Docs plugin doesn't need to do anything on startup notification
        console.log('Docs plugin notified of startup completion');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    applyStateRules(_gs: GlobalState): void {
        // Docs plugin doesn't have specific state rules to apply
        // This method is called to allow plugins to modify global state based on business rules
    }

    async restoreSavedValues(gs: DocsGlobalState) {
        const docsViewWidth: 'narrow' | 'medium' | 'wide' = await idb.getItem(DBKeys.docsViewWidth, 'medium');
        const docsEditMode: boolean = await idb.getItem(DBKeys.docsEditMode, false) === true;
        const docsMetaMode: boolean = await idb.getItem(DBKeys.docsMetaMode, false) === true;
        const docsNamesMode: boolean = await idb.getItem(DBKeys.docsNamesMode, false) === true;
    
        gs.docsViewWidth = docsViewWidth;
        gs.docsEditMode = docsEditMode;
        gs.docsMetaMode = docsMetaMode;
        gs.docsNamesMode = docsNamesMode;
    }

    getRoute(_gs: DocsGlobalState, pageName: string) {
        switch (pageName) {
        case DocsPageNames.treeViewer:
            return React.createElement(TreeViewerPage);
        case DocsPageNames.searchView:
            return React.createElement(SearchViewPage)
        default:
            return null;
        }
    }

    getSettingsPageComponent(): React.ReactElement | null {
        return null;
    }

    getAdminPageComponent(): React.ReactElement | null {
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getUserProfileComponent(_profileData: UserProfile): React.ReactElement | null {
        return null;
    }

    goToMainPage() {
        app.goToPage(DocsPageNames.treeViewer);
    }
}

export const plugin = new DocsClientPlugin();