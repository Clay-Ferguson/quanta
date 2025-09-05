import { TreeNode } from "../../../common/types/CommonTypes";
import { GlobalState } from "../../../client/GlobalState";
import { gd as gdBase, gs as gsBase, GlobalAction, useGlobalState as useGlobalStateBase } from "../../../client/GlobalState.tsx";

export enum DocsPageNames {
    treeViewer = 'TreeViewerPage', 
    searchView = "SearchViewPage",
    docsUserGuide = 'DocsUserGuidePage',
}

export interface DocsGlobalState extends GlobalState {
    // Plugin-specific state uses plugin key perfix, e.g. 'docs'
    docsFolder?: string;
    docsEditMode?: boolean; 
    docsMetaMode?: boolean; 
    docsNamesMode?: boolean;
    docsEditNode?: TreeNode | null;
    docsNewFolderName?: string | null;
    docsNewFileName?: string | null;
    docsSelItems?: Set<TreeNode>;
    docsCutItems?: Set<string>;
    docsRootKey?: string | null;
    docsRootType?: 'vfs' | 'lfs' | null;
    docsViewWidth?: 'narrow' | 'medium' | 'wide' | 'full';
    docsSearch?: string;
    docsSearchResults?: Array<{file: string, line: number, content: string}>;
    docsSearchOriginFolder?: string;
    docsLastSearch?: string;
    docsSearchMode?: 'REGEX' | 'MATCH_ANY' | 'MATCH_ALL';
    docsRequireDate?: boolean;
    docsSearchTextOnly?: boolean;
    docsSearchOrder?: 'MOD_TIME' | 'DATE';
    docsHighlightedFolderName?: string | null;
    docsHighlightedFileName?: string | null;
    docsShowSharingDialog?: boolean;
    docsAutoStartSpeech?: boolean;
}

// =============================================
// STATE MANAGEMENT BOLIER PLATE
// Each plugin will have an identical section to this, but with their own GlobalState type. Yes this is
// slightly ugly, but the reason it's worth it is becasue using this pattern allows the rest of the code
// for any given plugin to be very clean and not have to be using parameterized types everywhere a state us 
// used.

// Chat-specific action type that can handle both base and chat-specific properties
export type ChatGlobalAction = { type: string, payload: Partial<DocsGlobalState> };

// Type-safe re-exports of gd and gs that work with ChatGlobalState
export function gd(action: ChatGlobalAction): DocsGlobalState {
    // Cast to GlobalAction for the base function call, but maintain type safety for chat-specific properties
    return gdBase(action as GlobalAction) as DocsGlobalState;
}

export function gs(): DocsGlobalState {
    return gsBase() as DocsGlobalState;
}

// Type-safe re-export of useGlobalState that works with ChatGlobalState
export function useGlobalState(): DocsGlobalState {
    return useGlobalStateBase() as DocsGlobalState;
}
// =============================================
