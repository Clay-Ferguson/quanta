import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from "../components/MarkdownComp";
import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import { scrollEffects } from '../ScrollEffects';
import { util } from '../Util';
import { httpClientUtil } from '../HttpClientUtil';
import { useGlobalState, gd } from '../GlobalState';
import { TreeRender_Response } from '../../common/types/EndpointTypes';
import { TreeNode } from '../../common/types/CommonTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faEdit, faTrash, faArrowUp, faArrowDown, faPlus, faLevelUpAlt, faSync } from '@fortawesome/free-solid-svg-icons';
import { PageNames } from '../AppServiceTypes';
import { setFullSizeImage } from '../components/ImageViewerComp';
import ImageViewerComp from '../components/ImageViewerComp';
import { handleCheckboxChange, handleDeleteClick, handleEditClick, handleEditModeToggle, handleFolderClick, handleMetaModeToggle, handleMoveDownClick, handleMoveUpClick, handleParentClick, handleRenameClick, handleSaveClick, insertFile, insertFolder, onCut, onDelete, onPaste, stripOrdinal } from './TreeViewerPageOps';

declare const PAGE: string;
declare const ADMIN_PUBLIC_KEY: string;

interface EditFolderProps {
    gs: any;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    handleFolderNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleCancelClick: () => void;
}

/**
 * Component for editing folder name
 */
function EditFolder({ 
    gs, 
    treeNodes, 
    setTreeNodes, 
    handleFolderNameChange, 
    handleCancelClick 
}: EditFolderProps) {
    return (
        <div className="flex items-center flex-grow">
            <FontAwesomeIcon 
                icon={faFolder} 
                className="text-blue-400 text-lg mr-3" 
            />
            <div className="flex-grow">
                <input
                    type="text"
                    value={gs.newFolderName || ''}
                    onChange={handleFolderNameChange}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg text-gray-200 text-lg font-medium px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter folder name..."
                    autoFocus
                />
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => handleRenameClick(gs, treeNodes, setTreeNodes)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                    Rename
                    </button>
                    <button
                        onClick={handleCancelClick}
                        className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                    >
                    Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

interface EditFileProps {
    gs: any;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    handleFileNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleContentChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleCancelClick: () => void;
    contentTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Component for editing file content and filename
 */
function EditFile({ 
    gs, 
    treeNodes, 
    setTreeNodes, 
    handleFileNameChange, 
    handleContentChange, 
    handleCancelClick, 
    contentTextareaRef 
}: EditFileProps) {
    return (
        <div>
            <input
                type="text"
                value={gs.newFileName || ''}
                onChange={handleFileNameChange}
                className="w-full mb-3 p-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter filename..."
            />
            <textarea
                ref={contentTextareaRef}
                value={gs.editingContent || ''}
                onChange={handleContentChange}
                rows={10}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 font-mono text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter content here..."
            />
            <div className="flex gap-2 mt-3">
                <button
                    onClick={() => handleSaveClick(gs, treeNodes, setTreeNodes)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                Save
                </button>
                <button
                    onClick={handleCancelClick}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                Cancel
                </button>
            </div>
        </div>
    );
}

interface EditIconsProps {
    node: TreeNode;
    index: number;
    gs: any;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    showEditButton?: boolean;
    containerClass?: string;
}

/**
 * Component for rendering edit icons (Edit, Delete, Move Up, Move Down)
 */
function EditIcons({ node, index, gs, treeNodes, setTreeNodes, showEditButton = true, containerClass = "flex items-center gap-2 ml-4" }: EditIconsProps) {
    const isImage = node.mimeType.startsWith('image/');
    
    return (
        <div className={containerClass}>
            {showEditButton && !isImage && 
            <button 
                onClick={(e) => { e.stopPropagation(); handleEditClick(node); }}
                className="text-gray-400 hover:text-blue-400 transition-colors p-0 border-0 bg-transparent"
                title="Edit"
            >
                <FontAwesomeIcon icon={faEdit} className="h-4 w-4" />
            </button>}
            <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(gs, treeNodes, setTreeNodes, node, index); }}
                className="text-gray-400 hover:text-red-400 transition-colors p-0 border-0 bg-transparent"
                title="Delete"
            >
                <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); handleMoveUpClick(gs, treeNodes, setTreeNodes, node); }}
                className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                title="Move Up"
            >
                <FontAwesomeIcon icon={faArrowUp} className="h-4 w-4" />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); handleMoveDownClick(gs, treeNodes, setTreeNodes, node); }}
                className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                title="Move Down"
            >
                <FontAwesomeIcon icon={faArrowDown} className="h-4 w-4" />
            </button>
        </div>
    );
}

interface TopRightAdminCompsProps {
    gs: any;
    itemsAreSelected: boolean | undefined;
    itemsAreCut: boolean | undefined;
    reRenderTree: () => Promise<TreeNode[]>;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    isLoading: boolean;
}

/**
 * Component for rendering the admin controls in the top right of the header
 */
function TopRightAdminComps({ gs, itemsAreSelected, itemsAreCut, reRenderTree, treeNodes, setTreeNodes, isLoading }: TopRightAdminCompsProps) {
    return (
        <>
            <label className="flex items-center cursor-pointer">
                <input 
                    type="checkbox"
                    checked={gs.editMode || false}
                    onChange={() => handleEditModeToggle(gs)}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-300">Edit</span>
            </label>
            <label className="flex items-center cursor-pointer">
                <input 
                    type="checkbox"
                    checked={gs.metaMode || false}
                    onChange={() => handleMetaModeToggle(gs)}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-300">Meta</span>
            </label>
            {gs.editMode && 
                <div className="flex items-center space-x-2">
                    {itemsAreSelected && 
                        <button 
                            onClick={() => onCut(gs)}
                            className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                            title="Cut selected items"
                        >
                        Cut
                        </button>}
                    {itemsAreCut && 
                        <button 
                            onClick={() => onPaste(gs, reRenderTree)}
                            className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                            title="Paste items"
                        >
                        Paste
                        </button>}
                    {itemsAreSelected && 
                        <button 
                            onClick={() => onDelete(gs, treeNodes, setTreeNodes)}
                            className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                            title="Delete selected items"
                        >
                        Delete
                        </button>}
                </div>
            }
            <button 
                onClick={reRenderTree}
                className="btn-icon"
                title="Refresh tree"
                disabled={isLoading}
            >
                <FontAwesomeIcon icon={faSync} className="h-5 w-5" />
            </button>
        </>
    );
}

interface InsertItemsRowProps {
    gs: any;
    reRenderTree: () => Promise<TreeNode[]>;
    node?: TreeNode | null;
}

/**
 * Component for rendering insert file/folder buttons
 */
function InsertItemsRow({ gs, reRenderTree, node = null }: InsertItemsRowProps) {
    return (
        <div className="flex justify-center gap-2">
            <button 
                onClick={() => insertFile(gs, reRenderTree, node)}
                className="text-gray-400 hover:text-green-400 transition-colors p-1 border-0 bg-transparent"
                title="Insert File"
            >
                <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            </button>
            <button 
                onClick={() => insertFolder(gs, reRenderTree, node)}
                className="text-gray-400 hover:text-blue-400 transition-colors p-1 border-0 bg-transparent"
                title="Insert Folder"
            >
                <FontAwesomeIcon icon={faFolder} className="h-4 w-4" />
            </button>
        </div>
    );
}

interface TreeNodeComponentProps {
    node: TreeNode;
    index: number;
    gs: any;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    isNodeSelected: (node: TreeNode) => boolean;
    handleCancelClick: () => void;
    handleContentChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleFolderNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleFileNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    formatDisplayName: (name: string) => string;
    contentTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
    reRenderTree: () => Promise<TreeNode[]>;
}

/**
 * Component for rendering individual tree nodes (files and folders)
 */
function TreeNodeComponent({ 
    node, 
    index, 
    gs, 
    treeNodes, 
    setTreeNodes, 
    isNodeSelected, 
    handleCancelClick, 
    handleContentChange, 
    handleFolderNameChange, 
    handleFileNameChange, 
    formatDisplayName,
    contentTextareaRef,
    reRenderTree
}: TreeNodeComponentProps) {
    const isImage = node.mimeType.startsWith('image/');
    const imgSrc: string | null = isImage ? `/api/docs/images/${gs.docRootKey}${gs.treeFolder ? gs.treeFolder+'/' : ''}${node.name}` : null;

    return (
        <div key={index}>
            <div className={gs.editMode ? "flex items-start gap-3 border-b-2 border-green-400" : "flex items-start gap-3"}>
                {gs.editMode && 
                    <div className="flex-shrink-0 pt-1">
                        <input
                            type="checkbox"
                            checked={isNodeSelected(node)}
                            onChange={(e) => handleCheckboxChange(gs, node, e.target.checked)}
                            className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                            title="Select this item"
                        />
                    </div>
                }
                <div className="flex-grow">
                    {node.mimeType === 'folder' ? (
                        <div className="flex items-center justify-between">
                            {gs.editingNode === node ? (
                                <EditFolder 
                                    gs={gs} 
                                    treeNodes={treeNodes} 
                                    setTreeNodes={setTreeNodes} 
                                    handleFolderNameChange={handleFolderNameChange} 
                                    handleCancelClick={handleCancelClick} 
                                />
                            ) : (
                                <>
                                    <div 
                                        className="flex items-center cursor-pointer hover:bg-gray-800/30 rounded-lg mb-4 transition-colors flex-grow"
                                        onClick={() => handleFolderClick(gs, node.name)}
                                    >
                                        <FontAwesomeIcon 
                                            icon={faFolder} 
                                            className="text-blue-400 text-lg mr-3" 
                                        />
                                        <span className="text-blue-300 text-lg font-medium hover:text-blue-200">
                                            {formatDisplayName(node.name)}
                                        </span>
                                    </div>
                                    {gs.editMode && 
                                        <EditIcons node={node} index={index} gs={gs} treeNodes={treeNodes} setTreeNodes={setTreeNodes} />
                                    }
                                </>
                            )}
                        </div>
                    ) : isImage ? (
                        <div className="flex justify-center">
                            <img 
                                src={imgSrc!}
                                alt={node.name}
                                className="max-w-full h-auto rounded-lg shadow-lg"
                                onClick={() => setFullSizeImage({src: imgSrc!, name: node.name})}
                                onError={(e) => {
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    const fallback = document.createElement('div');
                                    fallback.className = 'bg-gray-700 border border-gray-600 rounded-lg p-8 text-center text-gray-400';
                                    fallback.innerHTML = `<p>Image not available: ${node.name}</p>`;
                                    target.parentNode?.appendChild(fallback);
                                }}
                            />
                        </div>
                    ) : (
                        gs.editingNode === node ? 
                            <EditFile 
                                gs={gs} 
                                treeNodes={treeNodes} 
                                setTreeNodes={setTreeNodes} 
                                handleFileNameChange={handleFileNameChange} 
                                handleContentChange={handleContentChange} 
                                handleCancelClick={handleCancelClick} 
                                contentTextareaRef={contentTextareaRef} 
                            />
                            : 
                            <Markdown markdownContent={node.content || ''} docMode={true}/>
                    )}
                
                    {node.mimeType !== 'folder' && (
                        <div className="mt-3 text-s text-gray-500 flex justify-end items-center">
                            {gs.metaMode && 
                                <>
                                    <span className="mr-4">{node.name}</span>
                                    <span className="mr-4">{new Date(node.modifyTime).toLocaleDateString()}</span>
                                </>}
                            {gs.editMode && 
                                <EditIcons 
                                    node={node} 
                                    index={index} 
                                    gs={gs} 
                                    treeNodes={treeNodes} 
                                    setTreeNodes={setTreeNodes} 
                                    containerClass="flex items-center gap-2"
                                />}
                        </div>
                    )}
                </div>
            </div>
            {gs.editMode && 
                <InsertItemsRow gs={gs} reRenderTree={reRenderTree} node={node} />
            }
        </div>
    );
}

/**
 * Page for displaying a tree viewer that shows server-side folder contents as an array of Markdown elements and images.
 * Fetches file content from the server and displays each file as a separate component based on its MIME type.
 */
export default function TreeViewerPage() {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
    const [error, setError] = useState<string | null>(null);
    const gs = useGlobalState();
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
    
    useEffect(() => util.resizeEffect(), []);

    // Focus the content textarea when starting to edit a file
    useEffect(() => {
        if (gs.editingNode && gs.editingNode.mimeType !== 'folder' && contentTextareaRef.current) {
            // Use setTimeout to ensure the textarea is rendered before focusing
            setTimeout(() => {
                contentTextareaRef.current?.focus();
            }, 100);
        }
    }, [gs.editingNode]);

    const formatDisplayName = (name: string) => {
        name = stripOrdinal(name);
        const endsWithUnderscore = name.endsWith('_');

        // Replace underscores and dashes with spaces
        name = name.replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); 

        // we preserve the display of the final underscore if it exists, because that's important for the user to see
        // becasue it represents a 'pullup'
        if (endsWithUnderscore) {
            // If the name ends with an underscore, we add a space at the end
            name += '_';
        }
        return name;
    }   

    // Check if a node is selected
    const isNodeSelected = (node: TreeNode): boolean => {
        return gs.selectedTreeItems?.has(node) || false;
    };

    const handleCancelClick = () => {
        // Clear editing state without saving
        if (gs.editingNode?.mimeType === 'folder') {
            gd({ type: 'clearFolderEditingState', payload: { 
                editingNode: null,
                newFolderName: null
            }});
        } else {
            gd({ type: 'clearFileEditingState', payload: { 
                editingNode: null,
                editingContent: null,
                newFileName: null
            }});
        }
    };

    const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        gd({ type: 'setEditingContent', payload: { 
            editingContent: event.target.value
        }});
    };

    const handleFolderNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        gd({ type: 'setNewFolderName', payload: { 
            newFolderName: event.target.value
        }});
    };

    const handleFileNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        gd({ type: 'setNewFileName', payload: { 
            newFileName: event.target.value
        }});
    };

    // We have to wrap this in a useCallback in order to be able to use it in
    // the useEffect below
    const reRenderTree = useCallback(async () => {
        const folder = gs.treeFolder || '/';
        try {
            setIsLoading(true);
            setError(null);
            const url = `/api/docs/render/${gs.docRootKey}/${folder}${!gs.editMode ? '?pullup=true' : ''}`;
            const treeResponse: TreeRender_Response | null = await httpClientUtil.httpGet(url);
                
            if (treeResponse && treeResponse.treeNodes) {
                setTreeNodes(treeResponse.treeNodes);
                return treeResponse.treeNodes;
            }
            else {
                setTreeNodes([]);
                return [];
            }
        } catch (fetchError) {
            setError(`Sorry, we encountered an error refreshing the tree for "${folder}".`);
            console.error('Error refreshing tree after file creation:', fetchError);
            return [];
        }
        finally {
            setIsLoading(false);
        }
    }, [gs.editMode, gs.treeFolder, gs.docRootKey]);

    useEffect(() => {
        const fetchTree = async () => {
            setIsLoading(true);
            setError(null);
            try {
                await reRenderTree();
            } catch (error) {
                console.error('Error loading tree:', error);
                setError(`Sorry, we encountered an error loading the tree for "${gs.treeFolder || '/'}".`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTree();
    }, [gs.treeFolder, gs.editMode, reRenderTree]);

    const elmRef = useRef<HTMLDivElement>(null);
    // useLayoutEffect(() => scrollEffects.layoutEffect(elmRef, false), [docContent]);
    useEffect(() => scrollEffects.effect(elmRef), []);

    // This method should split apart path into its components and format it nicely
    // using formatFileName for each component.
    function formatFullPath(path: string): string {
        if (!path || path === '/') {
            return '';
        }
        
        // Split the path by '/' and format each component
        const comps = path.split('/').filter(Boolean); // Filter out empty components
        return comps.map(formatDisplayName).join(' / ');
    }

    const itemsAreSelected = gs.selectedTreeItems && gs.selectedTreeItems?.size > 0;
    const itemsAreCut = gs.cutItems && gs.cutItems.size > 0;
    const isAdmin = ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey;
    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText={formatFullPath(gs.treeFolder || "Doc Viewer")}/>
                <div className="flex items-center space-x-4">
                    {isAdmin && 
                        <TopRightAdminComps 
                            gs={gs} 
                            itemsAreSelected={itemsAreSelected} 
                            itemsAreCut={itemsAreCut} 
                            reRenderTree={reRenderTree} 
                            treeNodes={treeNodes} 
                            setTreeNodes={setTreeNodes} 
                            isLoading={isLoading} 
                        />
                    }
                    {gs.treeFolder && gs.treeFolder.length > 1 && 
                        <button 
                            onClick={() => handleParentClick(gs)}
                            className="btn-icon"
                            title="Go to parent folder"
                        >
                            <FontAwesomeIcon icon={faLevelUpAlt} className="h-5 w-5" />
                        </button>}
                    {PAGE!=PageNames.treeViewer && <BackButtonComp/>}
                </div>
            </header>
            <div id="treeViewContent" ref={elmRef}  className="flex-grow overflow-y-auto p-4 bg-gray-900 flex justify-center">
                <div className="max-w-2xl w-full">
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
                        <div>
                            {gs.editMode && (
                                <InsertItemsRow gs={gs} reRenderTree={reRenderTree} node={null} />
                            )}
                            {treeNodes
                                .filter(node => !gs.cutItems?.has(node.name))
                                .map((node, index) => (
                                    <TreeNodeComponent
                                        key={index}
                                        node={node}
                                        index={index}
                                        gs={gs}
                                        treeNodes={treeNodes}
                                        setTreeNodes={setTreeNodes}
                                        isNodeSelected={isNodeSelected}
                                        handleCancelClick={handleCancelClick}
                                        handleContentChange={handleContentChange}
                                        handleFolderNameChange={handleFolderNameChange}
                                        handleFileNameChange={handleFileNameChange}
                                        formatDisplayName={formatDisplayName}
                                        contentTextareaRef={contentTextareaRef}
                                        reRenderTree={reRenderTree}
                                    />
                                ))}
                        </div>
                    )}
                    <div className="h-20"></div> {/* Empty div for bottom spacing */}
                </div>
            </div>
            <ImageViewerComp />
        </div>
    );
}

