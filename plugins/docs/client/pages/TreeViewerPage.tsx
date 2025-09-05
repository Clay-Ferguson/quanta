import { useCallback, useEffect, useRef, useState } from 'react';
import LogoBlockComp from '../../../../client/components/LogoBlockComp';
import BackButtonComp from '../../../../client/components/BackButtonComp';
import { scrollEffects } from '../../../../client/ScrollEffects';
import { util } from '../../../../client/Util';
import { httpClientUtil } from '../../../../client/HttpClientUtil';
import { TreeRender_Response } from '../../../../common/types/EndpointTypes';
import { TreeNode } from '../../../../common/types/CommonTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLevelUpAlt } from '@fortawesome/free-solid-svg-icons';
import ImageViewerComp from '../../../../client/components/ImageViewerComp';
import { handleCancelClick, createValidId, handleParentClick } from './TreeViewerPageOps';
import { useGlobalState, gd, DocsGlobalState, DocsPageNames } from '../DocsTypes';
import { formatDisplayName } from '../../../../common/CommonUtils';
import SharingDialog from '../SharingDialog';
import { idb } from '../../../../client/IndexedDB';
import { DBKeys } from '../../../../client/AppServiceTypes';
import ClickableBreadcrumb from './comps/ClickableBreadcrumb';
import ViewWidthDropdown from './comps/ViewWidthDropdown';
import TopRightComps from './comps/TopRightComps';
import InsertItemsRow from './comps/InsertItemsRow';
import TreeNodeComponent from './comps/TreeNodeComponent';

declare const PAGE: string;
declare const DESKTOP_MODE: boolean;
declare const ADMIN_PUBLIC_KEY: string;

/**
 * Recursive function to render tree nodes and their children.
 * 
 * Whenever we do have children here it means the folder was a 'pullup' (i.e. folder name ends in underscore) and so this designates
 * to the renderer that it should not render the parent node, but only the children, and render them inline.
 */
function renderTreeNodes(
    nodes: TreeNode[], 
    gs: DocsGlobalState, 
    treeNodes: TreeNode[], 
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>, 
    isNodeSelected: (node: TreeNode) => boolean, 
    handleCancelClick: () => void, 
    handleFolderNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void, 
    formatDisplayName: (name: string) => string, 
    contentTextareaRef: React.RefObject<HTMLTextAreaElement | null>, 
    reRenderTree: () => Promise<TreeNode[]>,
    baseIndex: number = 0
): React.ReactElement[] {
    const elements: React.ReactElement[] = [];
    let currentIndex = baseIndex;

    nodes.forEach((node) => {
        // console.log("Rendering node:", node.name, "at index:", currentIndex);
        // If this node has children, render only the children (pullup behavior)
        if (node.children && node.children.length > 0) {
            // Recursively render children inline without showing the container node
            const childElements = renderTreeNodes(
                node.children, 
                gs, 
                treeNodes, 
                setTreeNodes, 
                isNodeSelected, 
                handleCancelClick, 
                handleFolderNameChange, 
                formatDisplayName, 
                contentTextareaRef, 
                reRenderTree,
                currentIndex
            );
            elements.push(...childElements);
            currentIndex += node.children.length;
        } else {
            // Render the node normally if it has no children
            const validId = createValidId(node.name);

            elements.push(
                <TreeNodeComponent
                    key={validId}
                    validId={validId}
                    node={node}
                    index={currentIndex}
                    numNodes={nodes.length}
                    gs={gs}
                    treeNodes={treeNodes}
                    setTreeNodes={setTreeNodes}
                    isNodeSelected={isNodeSelected}
                    handleCancelClick={handleCancelClick}
                    handleFolderNameChange={handleFolderNameChange}
                    formatDisplayName={formatDisplayName}
                    contentTextareaRef={contentTextareaRef}
                    reRenderTree={reRenderTree}
                />
            );
            currentIndex++;
        }
    });

    return elements;
}

/**
 * Page for displaying a tree viewer that shows server-side folder contents as an array of Markdown elements and images.
 * Fetches file content from the server and displays each file as a separate component based on its MIME type.
 */
export default function TreeViewerPage() {
    // -------------------
    // NOTE: I'm leaving the isLoading state commented out for now, because I might change my mind. Right now when it
    // shows up it's only for a fraction of a second and it creates a flicker as it shows the progress spinner during that time.
    // If we pring this back we can use some kind of animated CSS to make sure the progress fades in slow enough to only be seen when
    // the page is actually loading, and not just for a fraction of a second.
    // const [isLoading, setIsLoading] = useState<boolean>(true);
    // -------------------
    const isLoading = false; // Disable loading state for now

    const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
    const [rootNode, setRootNode] = useState<TreeNode | null>(null);

    const [error, setError] = useState<string | null>(null);
    const gs = useGlobalState();
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
    
    useEffect(() => util.resizeEffect(), []);

    // Focus the content textarea when starting to edit a file
    useEffect(() => {
        if (gs.docsEditNode && !gs.docsEditNode.is_directory && contentTextareaRef.current) {
            // Use setTimeout to ensure the textarea is rendered before focusing
            setTimeout(() => {
                contentTextareaRef.current?.focus();
            }, 100);
        }
    }, [gs.docsEditNode]);

    // Check if a node is selected
    const isNodeSelected = (node: TreeNode): boolean => {
        return gs.docsSelItems?.has(node) || false;
    };

    const handleFolderNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        gd({ type: 'setNewFolderName', payload: { 
            docsNewFolderName: event.target.value
        }});
    };

    // We have to wrap this in a useCallback in order to be able to use it in
    // the useEffect below
    const reRenderTree = useCallback(async () => {
        // if 'gs.docsRootKey' is not set, then we cannot render the tree
        if (!gs.docsRootKey) {
            setError('No root key set for document tree.');
            setTreeNodes([]);
            return [];
        }
        let folder = gs.docsFolder || '';
        if (!folder.startsWith('/')) {
            folder = `/${folder}`;
        }
        // console.log(`Re-rendering tree for folder: ${folder} with rootKey: ${gs.docsRootKey}`);
        try {
            // setIsLoading(true);
            setError(null);
            if (!DESKTOP_MODE) {
                if (folder=== '/' || folder === '') {
                    if (gs.userProfile && gs.userProfile.name) {
                        const isAdmin = ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey;

                        // if this is not the admin user we limit them to where an attempt to access root just sends them to their own folder instead.
                        if (!isAdmin) {
                            console.log(`Setting docsFolder to root for user ${gs.userProfile?.name}`);
                            folder = "/"+gs.userProfile!.name; 
                        }
                    }
                    else {
                        // todo-2: we need to document this behaviour where we default users to the public folder, expecting it to exist.
                        console.log(`Setting docsFolder to public/admin. No user profile saved.`);
                        folder = "/admin/public";
                    }

                    // console.log(`Setting docsFolder to [${folder}]`);
                    gd({ type: 'setUserProfile', payload: { 
                        docsFolder: folder
                    }});
                }
            }

            // console.log(`Refreshing tree for folder [${folder}] with rootKey=[${gs.docsRootKey}]`);
            const url = `/api/docs/render/${gs.docsRootKey}${folder}${!gs.docsEditMode ? '?pullup=true' : ''}`;
            const treeResponse: TreeRender_Response | null = await httpClientUtil.secureHttpPost(url, {});
            // console.log(`DocsFolder server response: ${treeResponse!.treeFolder}`);
            
            if (treeResponse) {
                // ================================================
                // Update browser URL to reflect the current folder
                // ***** DO NOT DELETE *****
                // This works perfectly to keep the URL updated with every folder change, but for now I just don't want this because it 
                // is a very long URL in most cases. Instead of showing it always I'll just add a "link" icon to the breadcrumbs that
                // will allow it to be copied to the clipboard.
                // if (treeResponse.treeFolder) {
                //     const newUrl = `/doc/${gs.docsRootKey}${folder}`;
                //     console.log(`Updating browser URL to: ${newUrl}`);
                //     if (window.location.pathname !== newUrl) {
                //         window.history.replaceState({}, '', newUrl);
                //     }
                // }
                //==================================================

                // Update user_id from the response if it's provided
                if (treeResponse?.user_id && treeResponse.user_id !== gs.userProfile!.userId) {
                    await idb.setItem(DBKeys.userId, treeResponse.user_id);
                    gd({ type: 'setUserProfile', payload: { 
                        userProfile: {...gs.userProfile, userId: treeResponse.user_id }, 
                        docsFolder: treeResponse.treeFolder } 
                    });
                }
                else {
                    // ensure docsFolder is what we got back from the server, because it might have been changed by the server
                    if (treeResponse?.treeFolder) {
                        gd({ type: 'setDocsFolder', payload: {
                            docsFolder: treeResponse.treeFolder} 
                        });
                    }
                }
            }

            // JSON pretty print the entire tree response
            // console.log('Tree response:', JSON.stringify(treeResponse, null, 2));
        
            if (treeResponse) {
                setTreeNodes(treeResponse.treeNodes);
                setRootNode(treeResponse.rootNode);
                if (!treeResponse.rootNode) {
                    throw new Error('Root node is missing in the tree response');
                }
                return treeResponse.treeNodes;
            }
            else {
                setTreeNodes([]);
                setRootNode(null);
                return [];
            }
        } catch (fetchError) {
            setError(`Sorry, we encountered an error refreshing the tree for "${folder}" with rootKey="${gs.docsRootKey}".`);
            console.error('Error refreshing tree after file creation:', fetchError);
            return [];
        }
        finally {
            // setIsLoading(false);
        }
    }, [gs.docsEditMode, gs.docsFolder, gs.docsRootKey, gs.userProfile, gs.keyPair?.publicKey]);

    useEffect(() => {
        const fetchTree = async () => {
            // setIsLoading(true);
            setError(null);
            try {
                await reRenderTree();
            } catch (error) {
                console.error('Error loading tree:', error);
                setError(`Sorry, we encountered an error loading the tree for "${gs.docsFolder || '/'}".`);
            } finally {
                // setIsLoading(false);
            }
        };
        fetchTree();
    }, [gs.docsFolder, gs.docsEditMode, reRenderTree]);

    const elmRef = useRef<HTMLDivElement>(null);
    // useLayoutEffect(() => scrollEffects.layoutEffect(elmRef, false), [docContent]);
    useEffect(() => scrollEffects.effect(elmRef), []);

    const itemsAreSelected = gs.docsSelItems && gs.docsSelItems?.size > 0;
    const isOurRootNode = rootNode!=null && rootNode!.owner_id === gs.userProfile?.userId;
    
    // Filter out cut items by comparing full paths
    const currentFolder = gs.docsFolder || '/';
    const normalizedFolder = currentFolder === '/' ? '' : currentFolder;
    const filteredTreeNodes = treeNodes.filter(node => {
        const fullPath = `${normalizedFolder}/${node.name}`;
        return !gs.docsCutItems?.has(fullPath);
    });
    let lastPathPart = gs.docsFolder ? gs.docsFolder.split('/').filter(Boolean).pop() || null : null;
    if (lastPathPart) {
        lastPathPart = formatDisplayName(lastPathPart);
    }

    // show parent button if we're the admin or if the current folder is not a folder in the root.
    const showParentButton = DESKTOP_MODE || ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey || gs.docsFolder?.indexOf('/') !== -1;
    
    // Determine width class based on viewWidth setting
    const getWidthClass = () => {
        switch (gs.docsViewWidth) {
        case 'narrow': return 'max-w-xl';
        case 'wide': return 'max-w-5xl';
        case 'full': return 'max-w-none w-full px-4';
        case 'medium':
        default: return 'max-w-3xl';
        }
    };
   
    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText=""/>
                <div className="flex items-center space-x-4">
                    <ViewWidthDropdown gs={gs} />
                    
                    <TopRightComps 
                        gs={gs} 
                        rootNode={rootNode!}
                        itemsAreSelected={itemsAreSelected} 
                        reRenderTree={reRenderTree} 
                        treeNodes={treeNodes} 
                        setTreeNodes={setTreeNodes} 
                        isLoading={isLoading} 
                    />
                    
                    {showParentButton && gs.docsFolder && gs.docsFolder.length > 1 && 
                        <button 
                            onClick={() => handleParentClick(gs)}
                            className="p-2 bg-gray-600 text-white rounded-md flex items-center justify-center"
                            title="Go to parent folder"
                        >
                            <FontAwesomeIcon icon={faLevelUpAlt} className="h-5 w-5 mr-1" />Parent
                        </button>}
                    {PAGE!=DocsPageNames.treeViewer && <BackButtonComp/>}
                </div>
            </header>
            <div id="treeViewContent" ref={elmRef}  className="flex-grow overflow-y-auto bg-gray-900 flex justify-center">
                <div className={`${getWidthClass()} w-full`}>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-4 text-blue-300">Loading document...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                            <h2 className="text-red-400 text-lg font-semibold mb-2">Error</h2>
                            <p className="text-red-300">{error}</p>
                        </div>
                    ) : (
                        <div className="mt-4">
                            <ClickableBreadcrumb gs={gs} rootNode={rootNode}/>

                            {gs.docsEditMode && isOurRootNode && (
                                <InsertItemsRow gs={gs} reRenderTree={reRenderTree} node={null} filteredTreeNodes={filteredTreeNodes} />
                            )}
                            {renderTreeNodes(filteredTreeNodes, gs, treeNodes, setTreeNodes, isNodeSelected, 
                                () => handleCancelClick(gs), handleFolderNameChange, 
                                formatDisplayName, contentTextareaRef, reRenderTree)}
                        </div>
                    )}
                    <div className="h-20"></div> {/* Empty div for bottom spacing */}
                </div>
            </div>
            <ImageViewerComp />
            
            {/* Sharing Dialog */}
            {gs.docsShowSharingDialog && 
                <SharingDialog reRenderTree={reRenderTree}/>
            }
        </div>
    );
}
