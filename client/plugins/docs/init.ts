import React from 'react';
import { PageNames } from "../../AppServiceTypes";
import TreeViewerPage from "./pages/TreeViewerPage";
import SearchViewPage from './SearchViewPage';

export async function init() {
    console.log('Initializing Quanta Docs plugin...');
}

export function getRoute(pageName: string) {
    switch (pageName) {
    case PageNames.treeViewer:
        return React.createElement(TreeViewerPage);
    case PageNames.searchView:
        return React.createElement(SearchViewPage)
    default:
        return null;
    }
}