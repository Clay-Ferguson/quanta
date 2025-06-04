import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from "../../../components/MarkdownComp";
import LogoBlockComp from '../../../components/LogoBlockComp';
import BackButtonComp from '../../../components/BackButtonComp';
import { scrollEffects } from '../../../ScrollEffects';
import { util } from '../../../Util';
import { httpClientUtil } from '../../../HttpClientUtil';
import { useGlobalState, gd } from '../../../GlobalState';
import { TreeRender_Response } from '../../../../common/types/EndpointTypes';
import { TreeNode } from '../../../../common/types/CommonTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faEdit, faTrash, faArrowUp, faArrowDown, faPlus, faLevelUpAlt, faSync, faPaste, faFolderOpen, faFile, faExclamationTriangle, faSearch, faCubes } from '@fortawesome/free-solid-svg-icons';
import { DBKeys, PageNames } from '../../../AppServiceTypes';
import { setFullSizeImage } from '../../../components/ImageViewerComp';
import ImageViewerComp from '../../../components/ImageViewerComp';
import { formatDisplayName, formatFullPath, handleCancelClick, handleCheckboxChange, handleDeleteClick, handleEditClick, handleEditModeToggle, handleFileClick, handleFolderClick, handleMetaModeToggle, handleNamesModeToggle, handleMoveDownClick, handleMoveUpClick, handleParentClick, handleRenameClick, handleSaveClick, handleSaveSplitClick, insertFile, insertFolder, onCut, onDelete, onJoin, onPaste, onPasteIntoFolder, openItemInFileSystem, createValidId, stripOrdinal, handleMasterCheckboxChange, getMasterCheckboxState } from './TreeViewerPageOps';
import { idb } from '../../../IndexedDB';
import { app } from '../../../AppService';

declare const PAGE: string;
declare const ADMIN_PUBLIC_KEY: string;
declare const DESKTOP_MODE: string;

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
                className="text-blue-400 text-lg mr-3 h-5 w-5" 
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
                <div className="flex gap-2 mt-2 mb-3">
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
    reRenderTree: () => Promise<TreeNode[]>;
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
    reRenderTree,
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
                placeholder="Filename (optional)"
            />
            <textarea
                ref={contentTextareaRef}
                value={gs.editingContent || ''}
                onChange={handleContentChange}
                rows={10}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-gray-200 font-mono resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    onClick={() => handleSaveSplitClick(gs, treeNodes, setTreeNodes, reRenderTree)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                Split
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
    numNodes: number;
    gs: any;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    reRenderTree: () => Promise<TreeNode[]>;
    showEditButton?: boolean;
    containerClass?: string;
}

/**
 * Component for rendering edit icons (Edit, Delete, Move Up, Move Down, Paste Into Folder)
 */
function EditIcons({ node, index, numNodes, gs, treeNodes, setTreeNodes, reRenderTree, showEditButton = true, containerClass = "flex items-center gap-2 ml-4" }: EditIconsProps) {
    const isImage = node.type === 'image';
    const isFolder = node.type === 'folder';
    const hasCutItems = gs.cutItems && gs.cutItems.size > 0;

    return (
        <div className={containerClass}>
            {showEditButton && !isImage && 
            <button 
                onClick={(e) => { e.stopPropagation(); handleEditClick(node); }}
                className="text-gray-400 hover:text-blue-400 transition-colors p-0 border-0 bg-transparent"
                title="Edit"
            >
                <FontAwesomeIcon icon={faEdit} className="h-5 w-5" />
            </button>}
            <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(gs, treeNodes, setTreeNodes, node, index); }}
                className="text-gray-400 hover:text-red-400 transition-colors p-0 border-0 bg-transparent"
                title="Delete"
            >
                <FontAwesomeIcon icon={faTrash} className="h-5 w-5" />
            </button>
            {index > 0 && 
                <button 
                    onClick={(e) => { e.stopPropagation(); handleMoveUpClick(gs, treeNodes, setTreeNodes, node); }}
                    className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                    title="Move Up"
                >
                    <FontAwesomeIcon icon={faArrowUp} className="h-5 w-5" />
                </button>
            }
            {index < numNodes - 1 &&
                <button 
                    onClick={(e) => { e.stopPropagation(); handleMoveDownClick(gs, treeNodes, setTreeNodes, node); }}
                    className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                    title="Move Down"
                >
                    <FontAwesomeIcon icon={faArrowDown} className="h-5 w-5" />
                </button>}
            {isFolder && hasCutItems &&
                <button 
                    onClick={(e) => { e.stopPropagation(); onPasteIntoFolder(gs, reRenderTree, node); }}
                    className="text-gray-400 hover:text-blue-400 transition-colors p-0 border-0 bg-transparent"
                    title="Paste Into Folder"
                >
                    <FontAwesomeIcon icon={faPaste} className="h-5 w-5" />
                </button>}
        </div>
    );
}

interface ViewWidthDropdownProps {
    gs: any;
}

/**
 * Component for selecting view width (narrow, medium, wide)
 */
function ViewWidthDropdown({ gs }: ViewWidthDropdownProps) {
    const handleWidthChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newWidth = event.target.value as 'narrow' | 'medium' | 'wide';
        
        // Update global state
        gd({ type: 'setViewWidth', payload: { 
            viewWidth: newWidth
        }});
        
        // Persist to IndexedDB
        await idb.setItem(DBKeys.viewWidth, newWidth);
    };

    return (
        <div className="flex items-center">
            <select
                value={gs.viewWidth || 'medium'}
                onChange={handleWidthChange}
                className="bg-gray-700 border border-gray-600 rounded text-gray-200 text-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Content width"
            >
                <option value="narrow">Narrow</option>
                <option value="medium">Medium</option>
                <option value="wide">Wide</option>
            </select>
        </div>
    );
}

interface TopRightAdminCompsProps {
    gs: any;
    itemsAreSelected: boolean | undefined;
    reRenderTree: () => Promise<TreeNode[]>;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    isLoading: boolean;
}

/**
 * Component for rendering the admin controls in the top right of the header
 */
function TopRightAdminComps({ gs, itemsAreSelected, reRenderTree, treeNodes, setTreeNodes, isLoading }: TopRightAdminCompsProps) {
    return (
        <div className="flex items-center gap-2">
            <label className="flex items-center cursor-pointer">
                <input 
                    type="checkbox"
                    checked={gs.editMode || false}
                    onChange={async () => await handleEditModeToggle(gs)}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-300">Edit</span>
            </label>
            <label className="flex items-center cursor-pointer">
                <input 
                    type="checkbox"
                    checked={gs.metaMode || false}
                    onChange={async () => await handleMetaModeToggle(gs)}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-300">Meta</span>
            </label>
            <label className="flex items-center cursor-pointer">
                <input 
                    type="checkbox"
                    checked={gs.namesMode || false}
                    onChange={async () => await handleNamesModeToggle(gs)}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-300">Names</span>
            </label>
            {gs.editMode && 
                <div className="flex items-center space-x-2">
                    {itemsAreSelected && 
                        <button 
                            onClick={() => onCut(gs)}
                            className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            title="Cut selected items"
                        >
                        Cut
                        </button>}
                    {itemsAreSelected && 
                        <button 
                            onClick={() => onDelete(gs, treeNodes, setTreeNodes)}
                            className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            title="Delete selected items"
                        >
                        Delete
                        </button>}
                    {gs.selectedTreeItems && gs.selectedTreeItems.size >= 2 && 
                     (Array.from(gs.selectedTreeItems) as TreeNode[]).every(node => node.type === 'text') && 
                        <button 
                            onClick={() => onJoin(gs, reRenderTree)}
                            className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            title="Join selected files"
                        >
                        Join
                        </button>}
                </div>
            }
            
            {DESKTOP_MODE=="y" && <button 
                onClick={() => openItemInFileSystem(gs, "explore")}
                className="btn-icon"
                title="Open folder in file system"
                disabled={isLoading}
            >
                <FontAwesomeIcon icon={faFolderOpen} className="h-5 w-5" />
            </button>}

            <button 
                onClick={() => openItemInFileSystem(gs, "edit")}
                className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                title="Open File system Editor"
            >
                <FontAwesomeIcon icon={faEdit} className="h-5 w-5" />
            </button>

            <button 
                onClick={reRenderTree}
                className="btn-icon"
                title="Refresh tree"
                disabled={isLoading}
            >
                <FontAwesomeIcon icon={faSync} className="h-5 w-5" />
            </button>

            <button 
                onClick={() => app.goToPage(PageNames.searchView)}
                className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                title="Search documents"
            >
                <FontAwesomeIcon icon={faSearch} className="h-5 w-5" />
            </button>

            <button 
                onClick={async () => {
                    try {
                        const response = await httpClientUtil.secureHttpPost(`/api/docs/ssg`, { 
                            treeFolder: gs.docFolder,
                            docRootKey: gs.docRootKey 
                        });
                        console.log('SSG completed:', response);
                    } catch (error) {
                        console.error('SSG failed:', error);
                    }
                }}
                className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                title="Generate Static Site"
                disabled={isLoading}
            >
                <FontAwesomeIcon icon={faCubes} className="h-5 w-5" />
            </button>
        </div>
    );
}

interface InsertItemsRowProps {
    gs: any;
    reRenderTree: () => Promise<TreeNode[]>;
    node?: TreeNode | null;
    filteredTreeNodes?: TreeNode[];
}

/**
 * Component for rendering insert file/folder buttons
 */
function InsertItemsRow({ gs, reRenderTree, node = null, filteredTreeNodes = [] }: InsertItemsRowProps) {
    const showMasterCheckbox = node === null && filteredTreeNodes.length > 0;
    const { checked, indeterminate } = showMasterCheckbox ? getMasterCheckboxState(gs, filteredTreeNodes) : { checked: false, indeterminate: false };
    
    return (
        <div className={`relative flex justify-center`}>
            {/* Master checkbox - positioned absolutely to the left */}
            {showMasterCheckbox && (
                <div className="absolute left-0 top-0 flex items-center gap-3 pl-2 border-l-4 border-l-transparent">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            ref={(input) => {
                                if (input) {
                                    input.indeterminate = indeterminate;
                                }
                            }}
                            checked={checked}
                            onChange={(e) => handleMasterCheckboxChange(gs, filteredTreeNodes, e.target.checked)}
                            className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                            title={checked ? "Unselect all items" : "Select all items"}
                        />
                        <span className="ml-2 text-sm font-medium text-gray-300">
                            {indeterminate ? "Some selected" : checked ? "All selected" : "Select all"}
                        </span>
                    </div>
                    {gs.selectedTreeItems && gs.selectedTreeItems.size > 0 && (
                        <span className="text-xs text-gray-400">
                            ({gs.selectedTreeItems.size} of {filteredTreeNodes.length} selected)
                        </span>
                    )}
                </div>
            )}
            
            {/* Insert buttons - always centered */}
            <div className="flex gap-2">
                <button 
                    onClick={() => insertFile(gs, reRenderTree, node)}
                    className="text-gray-400 hover:text-green-400 transition-colors p-1 border-0 bg-transparent"
                    title="Insert File"
                >
                    <FontAwesomeIcon icon={faPlus} className="h-5 w-5" />
                </button>
                <button 
                    onClick={() => insertFolder(gs, reRenderTree, node)}
                    className="text-gray-400 hover:text-blue-400 transition-colors p-1 border-0 bg-transparent"
                    title="Insert Folder"
                >
                    <FontAwesomeIcon icon={faFolder} className="h-5 w-5" />
                </button>
                {gs.cutItems && gs.cutItems.size > 0 && (
                    <button 
                        onClick={() => onPaste(gs, reRenderTree, node)}
                        className="text-gray-400 hover:text-yellow-400 transition-colors p-1 border-0 bg-transparent"
                        title="Paste Here"
                    >
                        <FontAwesomeIcon icon={faPaste} className="h-5 w-5" />
                    </button>
                )}
            </div>
        </div>
    );
}

interface TreeNodeComponentProps {
    node: TreeNode;
    index: number;
    validId: string;
    numNodes: number;
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
    validId,
    numNodes,
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
    const isImage = node.type === 'image';
    // For images, node.content now contains the relative path from root
    // todo-1: It's a bit ugly that we have to use node.content here, but it works for now
    const imgSrc: string | null = isImage ? `/api/docs/images/${gs.docRootKey}/${node.content}` : null;
    
    // todo-1: Eventually we can handle the case where a file is neither an image nor a text file (like PDF, etc.), but for now
    // this tool is used only to edit Markdown files and images, so we can ignore those cases.
    const isTextFile = node.type === 'text';
    const isFolder = node.type === 'folder';
    const isBinary = node.type === 'binary';

    // Check if this is the highlighted folder that we came up from
    // Compare the stripped names (without ordinal prefix) for exact match
    const isHighlightedFolder = isFolder && gs.highlightedFolderName && 
        stripOrdinal(node.name) === gs.highlightedFolderName;
    
    // Determine the border class based on whether this is highlighted
    const getBorderClass = () => {
        let classes = "flex items-start gap-3 pl-2"; // Always add left padding
        
        // Add left border highlighting for folders we came up from
        if (isHighlightedFolder) {
            classes += " border-l-4 border-l-green-400";
        } else {
            classes += " border-l-4 border-l-transparent";
        }
        
        // Keep the green underline in edit mode for all items
        if (gs.editMode) {
            classes += " border-b-2 border-b-green-400";
        }
        else if (gs.metaMode) {
            classes += " border-b border-b-gray-600";
        }

        // if not in edit mode and this is a folder then add more padding at bottom
        if (!gs.editMode && isFolder) {
            classes += " pb-2"; // Add padding at the bottom for folders
        }        
        return classes;
    };

    return (
        <div id={validId} key={validId}>
            <div className={getBorderClass()}>
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
                    {isFolder &&
                        <div className="flex items-center justify-between">
                            {gs.editingNode === node &&
                                <EditFolder 
                                    gs={gs} 
                                    treeNodes={treeNodes} 
                                    setTreeNodes={setTreeNodes} 
                                    handleFolderNameChange={handleFolderNameChange} 
                                    handleCancelClick={handleCancelClick} 
                                />
                            } 
                            {gs.editingNode !== node &&
                                <>
                                    <div 
                                        className="flex items-center cursor-pointer hover:bg-gray-800/30 rounded-lg transition-colors flex-grow"
                                        onClick={() => handleFolderClick(gs, node.name)}
                                    >
                                        <FontAwesomeIcon 
                                            icon={faFolder} 
                                            className="text-blue-400 text-lg mr-3 h-5 w-5" 
                                        />
                                        <span className="text-blue-300 text-lg font-medium hover:text-blue-200">
                                            {formatDisplayName(node.name)}
                                        </span>

                                        {!node.fsChildren && 
                                            <FontAwesomeIcon 
                                                icon={faExclamationTriangle} 
                                                className="text-yellow-500 ml-2 h-5 w-5" 
                                                title="This folder has no children in the file system"
                                            />
                                        }
                                    </div>
                                    {gs.editMode && 
                                        <div className="mt-3">
                                            <EditIcons node={node} index={index} numNodes={numNodes} gs={gs} treeNodes={treeNodes} setTreeNodes={setTreeNodes} reRenderTree={reRenderTree} />
                                        </div>
                                    }
                                </>
                            }
                        </div>
                    }
                    
                    {isImage &&
                        <div className="flex justify-center">
                            <img 
                                src={imgSrc!}
                                alt={node.name}
                                className={gs.namesMode ? "max-w-[20%] h-auto rounded-lg shadow-lg pt-4 pb-4" : "max-w-full h-auto rounded-lg shadow-lg pt-4 pb-4"}
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
                    }
                    
                    {isTextFile && (gs.editingNode === node ? 
                        <EditFile 
                            gs={gs} 
                            reRenderTree={reRenderTree}
                            treeNodes={treeNodes} 
                            setTreeNodes={setTreeNodes} 
                            handleFileNameChange={handleFileNameChange} 
                            handleContentChange={handleContentChange} 
                            handleCancelClick={handleCancelClick} 
                            contentTextareaRef={contentTextareaRef} 
                        />
                        : gs.namesMode ?
                            <div 
                                className="flex items-center cursor-pointer hover:bg-gray-800/30 rounded-lg mb-4 transition-colors flex-grow"
                                onClick={() => handleFileClick(gs, node.name)}
                            >
                                <FontAwesomeIcon 
                                    icon={faFile} 
                                    className="text-lg mr-3 h-5 w-5" 
                                />
                                <span className="text-lg font-medium">
                                    {formatDisplayName(node.name)}
                                </span>
                            </div>
                            : 
                            <div className="mb-3">
                                <Markdown markdownContent={node.content || ''} docMode={true}/>
                            </div>
                    )}

                    {isBinary && 
                       <div 
                           className="flex items-center cursor-pointer hover:bg-gray-800/30 rounded-lg mb-4 transition-colors flex-grow"
                           onClick={() => handleFileClick(gs, node.name)}
                       >
                           <FontAwesomeIcon 
                               icon={faFile} 
                               className="text-green-400 text-lg mr-3 h-5 w-5" 
                           />
                           <span className="text-green-300 text-lg font-medium hover:text-green-200">
                               {formatDisplayName(node.name)}
                           </span>
                       </div>
                    }
                
                    {!isFolder && 
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
                                    numNodes={numNodes}
                                    gs={gs} 
                                    treeNodes={treeNodes} 
                                    setTreeNodes={setTreeNodes} 
                                    reRenderTree={reRenderTree}
                                    containerClass="flex items-center gap-2"
                                />}
                        </div>
                    }
                </div>
            </div>
            {gs.editMode && 
                <InsertItemsRow gs={gs} reRenderTree={reRenderTree} node={node} />
            }
        </div>
    );
}

/**
 * Recursive function to render tree nodes and their children.
 * 
 * Whenever we do have children here it means the folder was a 'pullup' (i.e. folder name ends in underscore) and so this designates
 * to the renderer that it should not render the parent node, but only the children, and render them inline.
 */
function renderTreeNodes(
    nodes: TreeNode[], 
    gs: any, 
    treeNodes: TreeNode[], 
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>, 
    isNodeSelected: (node: TreeNode) => boolean, 
    handleCancelClick: () => void, 
    handleContentChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void, 
    handleFolderNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void, 
    handleFileNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void, 
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
                handleContentChange, 
                handleFolderNameChange, 
                handleFileNameChange, 
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
                    handleContentChange={handleContentChange}
                    handleFolderNameChange={handleFolderNameChange}
                    handleFileNameChange={handleFileNameChange}
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
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
    const [error, setError] = useState<string | null>(null);
    const gs = useGlobalState();
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
    
    useEffect(() => util.resizeEffect(), []);

    // Focus the content textarea when starting to edit a file
    useEffect(() => {
        if (gs.editingNode && gs.editingNode.type !== 'folder' && contentTextareaRef.current) {
            // Use setTimeout to ensure the textarea is rendered before focusing
            setTimeout(() => {
                contentTextareaRef.current?.focus();
            }, 100);
        }
    }, [gs.editingNode]);

    // Check if a node is selected
    const isNodeSelected = (node: TreeNode): boolean => {
        return gs.selectedTreeItems?.has(node) || false;
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
        const folder = gs.docsFolder || '';
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
    }, [gs.editMode, gs.docsFolder, gs.docRootKey]);

    useEffect(() => {
        const fetchTree = async () => {
            setIsLoading(true);
            setError(null);
            try {
                await reRenderTree();
            } catch (error) {
                console.error('Error loading tree:', error);
                setError(`Sorry, we encountered an error loading the tree for "${gs.docsFolder || '/'}".`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTree();
    }, [gs.docsFolder, gs.editMode, reRenderTree]);

    const elmRef = useRef<HTMLDivElement>(null);
    // useLayoutEffect(() => scrollEffects.layoutEffect(elmRef, false), [docContent]);
    useEffect(() => scrollEffects.effect(elmRef), []);

    const itemsAreSelected = gs.selectedTreeItems && gs.selectedTreeItems?.size > 0;
    const isAdmin = ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey;
    const filteredTreeNodes = treeNodes.filter(node => !gs.cutItems?.has(node.name));
    let lastPathPart = gs.docsFolder ? gs.docsFolder.split('/').filter(Boolean).pop() || null : null;
    if (lastPathPart) {
        lastPathPart = formatDisplayName(lastPathPart);
    }

    // Determine width class based on viewWidth setting
    const getWidthClass = () => {
        switch (gs.viewWidth) {
        case 'narrow': return 'max-w-xl';
        case 'wide': return 'max-w-5xl';
        case 'medium':
        default: return 'max-w-3xl';
        }
    };
   
    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText={formatFullPath(gs.docsFolder || "Doc Viewer")}/>
                <div className="flex items-center space-x-4">
                    <ViewWidthDropdown gs={gs} />
                    {isAdmin && 
                        <TopRightAdminComps 
                            gs={gs} 
                            itemsAreSelected={itemsAreSelected} 
                            reRenderTree={reRenderTree} 
                            treeNodes={treeNodes} 
                            setTreeNodes={setTreeNodes} 
                            isLoading={isLoading} 
                        />
                    }
                    {gs.docsFolder && gs.docsFolder.length > 1 && 
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
                        <div>
                            {lastPathPart ? <h1>{lastPathPart}</h1> : <div className="h-6"></div>}
                            {gs.editMode && (
                                <InsertItemsRow gs={gs} reRenderTree={reRenderTree} node={null} filteredTreeNodes={filteredTreeNodes} />
                            )}
                            {renderTreeNodes(filteredTreeNodes, gs, treeNodes, setTreeNodes, isNodeSelected, 
                                () => handleCancelClick(gs), handleContentChange, handleFolderNameChange, 
                                handleFileNameChange, formatDisplayName, contentTextareaRef, reRenderTree)}
                        </div>
                    )}
                    <div className="h-20"></div> {/* Empty div for bottom spacing */}
                </div>
            </div>
            <ImageViewerComp />
        </div>
    );
}

