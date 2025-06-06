import React from 'react';
import { DBKeys } from "../../AppServiceTypes";
import TreeViewerPage from "./pages/TreeViewerPage";
import SearchViewPage from './SearchViewPage';
import { TreeNode } from '../../../common/types/CommonTypes';
import { DocsGlobalState, DocsPageNames } from './DocsTypes';
import { idb } from '../../IndexedDB';

export async function init(context: any) {
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
    gs.docsSearchMode = 'MATCH_ANY';
    gs.docsHighlightedFolderName = null;
}

export async function restoreSavedValues(gs: DocsGlobalState) {
    const docsViewWidth: 'narrow' | 'medium' | 'wide' = await idb.getItem(DBKeys.docsViewWidth, 'medium');
    const docsEditMode: boolean = await idb.getItem(DBKeys.docsEditMode, false) === true;
    const docsMetaMode: boolean = await idb.getItem(DBKeys.docsMetaMode, false) === true;
    const docsNamesMode: boolean = await idb.getItem(DBKeys.docsNamesMode, false) === true;
    
    gs.docsViewWidth = docsViewWidth;
    gs.docsEditMode = docsEditMode;
    gs.docsMetaMode = docsMetaMode;
    gs.docsNamesMode = docsNamesMode;
}

export function getRoute(pageName: string) {
    switch (pageName) {
    case DocsPageNames.treeViewer:
        return React.createElement(TreeViewerPage);
    case DocsPageNames.searchView:
        return React.createElement(SearchViewPage)
    default:
        return null;
    }
}

export function getSettingsPageComponent() {
    return null; // No specific settings page for chat plugin
}
