import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen, faSync, faSearch, faGear, faHome, faCubes, faQuestionCircle, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { TreeNode } from '../../../../../common/types/CommonTypes';
import { DocsGlobalState, DocsPageNames } from '../../DocsTypes';
import { PageNames } from '../../../../../client/AppServiceTypes';
import { isTextFile } from '../../../../../common/CommonUtils';
import { handleEditModeToggle, handleMetaModeToggle, handleNamesModeToggle, onCut, onUndoCut, onDelete, onJoin, openItemInFileSystem } from '../TreeViewerPageOps';
import { app } from '../../../../../client/AppService';
import { docsGoHome } from '../../DocsUtils';
import { httpClientUtil } from '../../../../../client/HttpClientUtil';
import { alertModal } from '../../../../../client/components/AlertModalComp';

declare const DESKTOP_MODE: boolean;

interface TopRightCompsProps {
    gs: DocsGlobalState;
    rootNode: TreeNode;
    itemsAreSelected: boolean | undefined;
    reRenderTree: () => Promise<TreeNode[]>;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    isLoading: boolean;
}

/**
 * Component for rendering the admin controls in the top right of the header
 */
export default function TopRightComps({ gs, rootNode, itemsAreSelected, reRenderTree, treeNodes, setTreeNodes, isLoading }: TopRightCompsProps) {
    const hasCutItems = gs.docsCutItems && gs.docsCutItems.size > 0;
    const isOurRootNode = rootNode && rootNode.owner_id === gs.userProfile?.userId;

    return (
        <div className="flex items-center gap-2">
            {isOurRootNode &&
                <label className="flex items-center cursor-pointer">
                    <input 
                        type="checkbox"
                        checked={gs.docsEditMode || false}
                        onChange={async () => await handleEditModeToggle(gs)}
                        className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-300">Edit</span>
                </label>}
            <label className="flex items-center cursor-pointer">
                <input 
                    type="checkbox"
                    checked={gs.docsMetaMode || false}
                    onChange={async () => await handleMetaModeToggle(gs)}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-300">Meta</span>
            </label>
            <label className="flex items-center cursor-pointer">
                <input 
                    type="checkbox"
                    checked={gs.docsNamesMode || false}
                    onChange={async () => await handleNamesModeToggle(gs)}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-300">Names</span>
            </label>
            {gs.docsEditMode && isOurRootNode && 
                <div className="flex items-center space-x-2">
                    {itemsAreSelected && 
                        <button 
                            onClick={() => onCut(gs)}
                            className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            title="Cut selected items"
                        >
                        Cut
                        </button>}
                    {hasCutItems && 
                        <button 
                            onClick={() => onUndoCut(gs, reRenderTree)}
                            className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            title="Undo Cut"
                        >
                        Undo Cut
                        </button>}
                    {!hasCutItems && itemsAreSelected && 
                        <button 
                            onClick={() => onDelete(gs, treeNodes, setTreeNodes)}
                            className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            title="Delete selected items"
                        >
                        Delete
                        </button>}
                    {!hasCutItems && gs.docsSelItems && gs.docsSelItems.size >= 2 && 
                     (Array.from(gs.docsSelItems) as TreeNode[]).every(node => isTextFile(node.name)) && 
                        <button 
                            onClick={() => onJoin(gs, reRenderTree)}
                            className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            title="Join selected files"
                        >
                        Join
                        </button>}
                </div>
            }
            
            {DESKTOP_MODE && gs.docsRootType==='lfs' && <button 
                onClick={() => openItemInFileSystem(gs, "explore")}
                className="btn-icon"
                title="Open folder in file system"
                disabled={isLoading}
            >
                <FontAwesomeIcon icon={faFolderOpen} className="h-5 w-5" />
            </button>}

            {DESKTOP_MODE && gs.docsRootType==='lfs' && <button 
                onClick={() => openItemInFileSystem(gs, "edit")}
                className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                title="Open File system Editor"
            >
                <FontAwesomeIcon icon={faExternalLinkAlt} className="h-5 w-5" />
            </button>}

            <button 
                onClick={reRenderTree}
                className="btn-icon"
                title="Refresh tree"
                disabled={isLoading}
            >
                <FontAwesomeIcon icon={faSync} className="h-5 w-5" />
            </button>

            <button 
                onClick={() => app.goToPage(DocsPageNames.searchView)}
                className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                title="Search documents"
            >
                <FontAwesomeIcon icon={faSearch} className="h-5 w-5" />
            </button>

            <button 
                onClick={() => app.goToPage(PageNames.settings)}
                className="btn-icon"
                title="Settings"
            >
                <FontAwesomeIcon icon={faGear} className="h-5 w-5" />
            </button>

            {!DESKTOP_MODE && 
                <button 
                    onClick={() => docsGoHome(gs)}
                    className="btn-icon"
                    title="Home"
                >
                    <FontAwesomeIcon icon={faHome} className="h-5 w-5" />
                </button>}

            {DESKTOP_MODE && gs.docsRootType==='lfs' && 
                <button 
                    onClick={async () => {
                        try {
                            const response = await httpClientUtil.secureHttpPost(`/api/docs/ssg`, { 
                                treeFolder: gs.docsFolder,
                                docRootKey: gs.docsRootKey 
                            });
                            if (!response) {
                                throw new Error(response?.message || "SSG failed");
                            }
                            alertModal("Static Site Generate Complete.");
                        } catch (error) {
                            console.error('SSG failed:', error);
                        }
                    }}
                    className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                    title="Generate Static Site"
                    disabled={isLoading}
                >
                    <FontAwesomeIcon icon={faCubes} className="h-5 w-5" />
                </button>}

            <button 
                onClick={() => app.goToPage(DocsPageNames.docsUserGuide)}
                className="btn-icon"
                title="Help"
            >
                <FontAwesomeIcon icon={faQuestionCircle} className="h-5 w-5" />
            </button>
        </div>
    );
}
