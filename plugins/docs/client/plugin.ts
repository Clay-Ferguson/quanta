import React from 'react';
import { DBKeys, IClientPlugin } from "../../../client/AppServiceTypes";
import TreeViewerPage from "./pages/TreeViewerPage";
import SearchViewPage from './pages/SearchViewPage';
import { TreeNode, UserProfile } from '../../../common/types/CommonTypes';
import { DocsGlobalState, DocsPageNames } from './DocsTypes';
import { GlobalState } from '../../../client/GlobalState';
import { idb } from '../../../client/IndexedDB';
import { app } from '../../../client/AppService';
import DocViewerPage from '../../../client/pages/DocViewerPage';

declare const DOC_PATH: string;
declare const DOC_ROOT_KEY: string | undefined;
declare const DOC_ROOT_TYPE: 'vfs' | 'lfs' | undefined;

class DocsClientPlugin implements IClientPlugin {

    getKey(): string {
        return 'docs';
    }

    async init(context: any) {
        console.log('Initializing Quanta Docs plugin...');
        const gs: DocsGlobalState = context.initGs;
        gs.docsFolder = DOC_PATH ? ('/'+DOC_PATH) : '/'; 
        gs.docsEditMode = false;
        gs.docsMetaMode = false;
        gs.docsNamesMode = false;
        gs.docsEditNode = null;
        gs.docsNewFolderName = null;
        gs.docsNewFileName = null;
        gs.docsSelItems = new Set<TreeNode>();
        gs.docsCutItems = new Set<string>();
        gs.docsRootKey = DOC_ROOT_KEY;
        gs.docsRootType = DOC_ROOT_TYPE;
        gs.docsViewWidth = 'medium';
        gs.docsSearch = '';
        gs.docsSearchResults = [];
        gs.docsSearchOriginFolder = '';
        gs.docsLastSearch = '';
        gs.docsSearchMode = 'MATCH_ANY';
        gs.docsRequireDate = false;
        gs.docsSearchTextOnly = false;
        gs.docsSearchOrder = 'MOD_TIME';
        gs.docsHighlightedFolderName = null;

        if (!DOC_ROOT_KEY) {
            console.error('DOC_ROOT_KEY is not defined in HTML rendered template.');
        }

        if (!DOC_ROOT_TYPE) {
            console.error('DOC_ROOT_TYPE is not defined in HTML rendered template.');
        }
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
        const docsViewWidth: 'narrow' | 'medium' | 'wide' | 'full' = await idb.getItem(DBKeys.docsViewWidth, 'medium');
        const docsEditMode: boolean = await idb.getItem(DBKeys.docsEditMode, false) === true;
        const docsMetaMode: boolean = await idb.getItem(DBKeys.docsMetaMode, false) === true;
        const docsNamesMode: boolean = await idb.getItem(DBKeys.docsNamesMode, false) === true;
        const docsRequireDate: boolean = await idb.getItem(DBKeys.docsRequireDate, false) === true;
        const docsSearchTextOnly: boolean = await idb.getItem(DBKeys.docsSearchTextOnly, false) === true;
        const docsSearchOrder: 'MOD_TIME' | 'DATE' = await idb.getItem(DBKeys.docsSearchOrder, 'MOD_TIME');
    
        gs.docsViewWidth = docsViewWidth;
        gs.docsEditMode = docsEditMode;
        gs.docsMetaMode = docsMetaMode;
        gs.docsNamesMode = docsNamesMode;
        gs.docsRequireDate = docsRequireDate;
        gs.docsSearchTextOnly = docsSearchTextOnly;
        gs.docsSearchOrder = docsSearchOrder;
    }

    getRoute(_gs: DocsGlobalState, pageName: string) {
        switch (pageName) {
        case DocsPageNames.treeViewer:
            return React.createElement(TreeViewerPage);
        case DocsPageNames.searchView:
            return React.createElement(SearchViewPage)
        case DocsPageNames.docsUserGuide:
            return React.createElement(DocViewerPage, { filename: "/docs/extensions/docs/docs_user_guide.md", title: "Quanta User Guide" });
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