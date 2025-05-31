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
import { confirmModal } from '../components/ConfirmModalComp'; 
import { promptModal } from '../components/PromptModalComp';
import { alertModal } from '../components/AlertModalComp';
import { PageNames } from '../AppServiceTypes';
import { setFullSizeImage } from '../components/ImageViewerComp';
import ImageViewerComp from '../components/ImageViewerComp';

declare const PAGE: string;
declare const ADMIN_PUBLIC_KEY: string;

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

    // Handle folder click navigation
    const handleFolderClick = (folderName: string) => {
        let curFolder = gs.treeFolder || '';
        if (curFolder == '/') {
            curFolder = ''; // If we're at root, we want to start with an empty string
        }
        const newFolder = `${curFolder}/${folderName}`;
        
        // Clear selections when navigating to a new folder
        gd({ type: 'setTreeFolder', payload: { 
            treeFolder: newFolder,
            selectedTreeItems: new Set<TreeNode>()
        }});
    };

    // Handle parent navigation (go up one level in folder tree)
    const handleParentClick = () => {
        const curFolder = gs.treeFolder || '/';
        // Remove the last path segment to go up one level
        const lastSlashIdx = curFolder.lastIndexOf('/');
        if (lastSlashIdx > 0) {
            const parentFolder = curFolder.substring(0, lastSlashIdx);
            // Clear selections when navigating to parent
            gd({ type: 'setTreeFolder', payload: { 
                treeFolder: parentFolder,
                selectedTreeItems: new Set<TreeNode>()
            }});
        } else if (lastSlashIdx === 0 && curFolder.length > 1) {
            // If we're in a direct subfolder of root, go to root
            // Clear selections when navigating to parent
            gd({ type: 'setTreeFolder', payload: { 
                treeFolder: '/',
                selectedTreeItems: new Set<TreeNode>()
            }});
        }
    };

    // Removes the prefix from the file name. We find the first occurrence of an underscore and return the substring after it.
    const stripOrdinal = (name: string) => {
        const idx = name.indexOf('_');
        return idx !== -1 ? name.substring(idx + 1) : name;
    }   

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

    // Handle edit mode toggle
    const handleEditModeToggle = () => {
        gd({ type: 'setEditMode', payload: { 
            editMode: !gs.editMode
        }});
    };

    // Handle edit mode toggle
    const handleMetaModeToggle = () => {
        gd({ type: 'setMetaMode', payload: { 
            metaMode: !gs.metaMode
        }});
    };

    // Handle checkbox selection for TreeNodes
    const handleCheckboxChange = (node: TreeNode, checked: boolean) => {
        const curSels = new Set(gs.selectedTreeItems);
        if (checked) {
            curSels.add(node);
        } else {
            curSels.delete(node);
        }
        
        gd({ type: 'setSelectedTreeItems', payload: { 
            selectedTreeItems: curSels
        }});
    };

    // Check if a node is selected
    const isNodeSelected = (node: TreeNode): boolean => {
        return gs.selectedTreeItems?.has(node) || false;
    };

    // Edit mode button handlers
    const handleEditClick = (node: TreeNode) => {     
        // For folders, we're doing rename functionality
        // Strip the numeric prefix from the folder name for editing
        const nameWithoutPrefix = stripOrdinal(node.name);   
        if (node.mimeType === 'folder') {
            gd({ type: 'setFolderEditingState', payload: { 
                editingNode: node,
                newFolderName: nameWithoutPrefix
            }});
        } else {
            gd({ type: 'setFileEditingState', payload: { 
                editingNode: node,
                editingContent: node.content || '',
                newFileName: nameWithoutPrefix
            }});
        }
    };

    const handleDeleteClick = async (node: TreeNode, index: number) => {        
        // Show confirmation dialog
        const confirmText = node.mimeType === 'folder' 
            ? `Delete the folder "${stripOrdinal(node.name)}"? This action cannot be undone.`
            : `Delete the file "${stripOrdinal(node.name)}"? This action cannot be undone.`;
            
        if (!await confirmModal(confirmText)) {
            return;
        }

        try {
            // Call server endpoint to delete the file or folder
            await deleteFileOrFolderOnServer(node.name);
            
            // Remove the node from the UI by updating treeNodes
            const updatedNodes = treeNodes.filter((_, i) => i !== index);
            setTreeNodes(updatedNodes);
            
            console.log(`${node.mimeType === 'folder' ? 'Folder' : 'File'} deleted successfully:`, node.name);
        } catch (error) {
            console.error('Error deleting:', error);
            // TODO: Show error message to user
        }
    };

    const handleMoveUpClick = (node: TreeNode) => {
        moveFileOrFolder(node, 'up');
    };

    const handleMoveDownClick = (node: TreeNode) => {
        moveFileOrFolder(node, 'down');
    };

    // Insert functions for creating new files and folders
    const insertFile = async (node: TreeNode | null) => {
        const fileName = await promptModal("Enter new file name");
        if (!fileName || fileName.trim() === '') {
            return;
        }
        
        try {
            const treeFolder = gs.treeFolder || '/'; 
            const requestBody = {
                fileName: fileName,
                treeFolder: treeFolder,
                insertAfterNode: node ? node.name : '',
                docRootKey: gs.docRootKey
            };
            const response = await httpClientUtil.secureHttpPost('/api/docs/file/create', requestBody);
            
            // Refresh the tree view to show the new file
            if (response && response.success) {
                const updatedNodes = await reRenderTree();
                
                // Automatically start editing the newly created file
                setTimeout(() => {
                    const findStr = `_${fileName}.md`;
                    const newFileNode = updatedNodes.find(n => n.name.endsWith(findStr));
                    if (newFileNode) {
                        // Now let's check to make sure the count of matching files is not more than 1
                        const matchingFiles = updatedNodes.filter(n => n.name.endsWith(findStr));
                        if (matchingFiles.length > 1) {
                            alertModal(`Multiple files found ending with "${findStr}". This is not recommended.`);
                        }

                        const fileNameWithoutPrefix = stripOrdinal(newFileNode.name);
                        gd({ type: 'setFileEditingState', payload: { 
                            editingNode: newFileNode,
                            editingContent: newFileNode.content || '',
                            newFileName: fileNameWithoutPrefix
                        }});
                    }
                    else {
                        console.error('Newly created file node not found in treeNodes:', fileName);
                        // do a JSON pretty print of the treeNodes
                        console.log('Current treeNodes:', JSON.stringify(updatedNodes, null, 2));
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error creating file:', error);
            // TODO: Show error message to user
        }
    };

    const insertFolder = async (node: TreeNode | null) => {
        const name = await promptModal("Enter new folder name");
        if (!name || name.trim() === '') {
            return;
        }
        
        try {
            const treeFolder = gs.treeFolder || '/';
            const requestBody = {
                folderName: name,
                treeFolder: treeFolder,
                insertAfterNode: node ? node.name : '',
                docRootKey: gs.docRootKey
            };
            
            const response = await httpClientUtil.secureHttpPost('/api/docs/folder/create', requestBody);
            console.log('Folder creation request sent successfully:', response);

            // Refresh the tree view to show the new file
            if (response && response.success) {
                await reRenderTree();
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            // TODO: Show error message to user
        }
    };

    const saveToServer = async (filename: string, content: string, newFileName?: string) => {
        try {
            const treeFolder = gs.treeFolder || '/';
            const requestBody = {
                filename: filename,
                content: content,
                treeFolder: treeFolder,
                newFileName: newFileName || filename,
                docRootKey: gs.docRootKey
            };
            await httpClientUtil.secureHttpPost('/api/docs/save-file/', requestBody);
        } catch (error) {
            console.error('Error saving file to server:', error);
            // TODO: Show error message to user
        }
    };

    const renameFolderOnServer = async (oldFolderName: string, newFolderName: string) => {
        try {
            const treeFolder = gs.treeFolder || '/';
            const requestBody = {
                oldFolderName,
                newFolderName,
                treeFolder,
                docRootKey: gs.docRootKey
            };
            await httpClientUtil.secureHttpPost('/api/docs/rename-folder/', requestBody);
        } catch (error) {
            console.error('Error renaming folder on server:', error);
            // TODO: Show error message to user
        }
    };

    const deleteFileOrFolderOnServer = async (fileOrFolderName: string) => {
        try {
            const treeFolder = gs.treeFolder || '/';
            const requestBody = {
                fileOrFolderName,
                treeFolder,
                docRootKey: gs.docRootKey
            };
            await httpClientUtil.secureHttpPost('/api/docs/delete', requestBody);
        } catch (error) {
            console.error('Error deleting file or folder on server:', error);
            throw error; // Re-throw to be handled by the caller
        }
    };

    const moveFileOrFolder = async (node: TreeNode, direction: 'up' | 'down') => {
        try {
            const treeFolder = gs.treeFolder || '/';
            const requestBody = {
                direction,
                filename: node.name,
                treeFolder,
                docRootKey: gs.docRootKey
            };
            
            const response = await httpClientUtil.secureHttpPost('/api/docs/move-up-down', requestBody);
            
            // Update the local tree nodes based on the server response
            if (response && response.oldName1 && response.newName1 && response.oldName2 && response.newName2) {
                const updatedNodes = treeNodes.map(treeNode => {
                    if (treeNode.name === response.oldName1) {
                        // Update the name and also update content if it's an image (content contains file path)
                        const updatedNode = { ...treeNode, name: response.newName1 };
                        if (treeNode.mimeType.startsWith('image/') && treeNode.content) {
                            // Update the file path in content to reflect the new filename
                            updatedNode.content = treeNode.content.replace(response.oldName1, response.newName1);
                        }
                        return updatedNode;
                    } else if (treeNode.name === response.oldName2) {
                        // Update the name and also update content if it's an image (content contains file path)
                        const updatedNode = { ...treeNode, name: response.newName2 };
                        if (treeNode.mimeType.startsWith('image/') && treeNode.content) {
                            // Update the file path in content to reflect the new filename
                            updatedNode.content = treeNode.content.replace(response.oldName2, response.newName2);
                        }
                        return updatedNode;
                    }
                    return treeNode;
                });
                
                // Sort the nodes by filename to maintain proper order
                updatedNodes.sort((a, b) => a.name.localeCompare(b.name));
                setTreeNodes(updatedNodes);
            }
        } catch (error) {
            console.error('Error moving file or folder:', error);
            // TODO: Show error message to user
        }
    };

    const handleSaveClick = () => {
        if (gs.editingNode && gs.editingContent !== null) {
            // Get the original filename and new filename
            const originalName = gs.editingNode.name;
            const newFileName = gs.newFileName || stripOrdinal(originalName);
            
            // Extract the numeric prefix from the original file name
            const underscoreIdx = originalName.indexOf('_');
            const numericPrefix = underscoreIdx !== -1 ? originalName.substring(0, underscoreIdx + 1) : '';
            
            // Create the new full file name with the numeric prefix
            const newFullFileName = numericPrefix + newFileName;
            
            // Find the node in treeNodes and update its content and name
            const updatedNodes = treeNodes.map(node => 
                node === gs.editingNode 
                    ? { ...node, content: gs.editingContent || '', name: newFullFileName }
                    : node
            );
            setTreeNodes(updatedNodes);
            
            // Clear editing state
            gd({ type: 'clearFileEditingState', payload: { 
                editingNode: null,
                editingContent: null,
                newFileName: null
            }});

            // Save to server with a delay to ensure UI updates first
            setTimeout(() => {
                saveToServer(gs.editingNode!.name, gs.editingContent || '', newFullFileName);
            }, 500);
        }
    };

    const handleRenameClick = () => {
        if (gs.editingNode && gs.newFolderName !== null) {
            // Extract the numeric prefix from the original folder name
            const originalName = gs.editingNode.name;
            const underscoreIdx = originalName.indexOf('_');
            const numericPrefix = underscoreIdx !== -1 ? originalName.substring(0, underscoreIdx + 1) : '';
            
            // Create the new full folder name with the numeric prefix
            const newFullFolderName = numericPrefix + gs.newFolderName;
            
            // Find the node in treeNodes and update its name
            const updatedNodes = treeNodes.map(node => 
                node === gs.editingNode 
                    ? { ...node, name: newFullFolderName }
                    : node
            );
            setTreeNodes(updatedNodes);
            
            // Clear editing state
            gd({ type: 'clearFolderEditingState', payload: { 
                editingNode: null,
                newFolderName: null
            }});

            // Rename on server with a delay to ensure UI updates first
            setTimeout(() => {
                renameFolderOnServer(gs.editingNode!.name, newFullFolderName);
            }, 500);
        }
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

    // Header button handlers for Cut, Paste, Delete
    const onCut = () => {
        console.log('Cut button clicked');
        
        if (!gs.selectedTreeItems || gs.selectedTreeItems.size === 0) {
            console.log('No items selected for cut operation');
            return;
        }

        // Get the file names of selected items
        const selectedFileNames = Array.from(gs.selectedTreeItems).map(node => node.name);
        
        // Update global state to set cutItems and clear selectedTreeItems
        gd({ type: 'setCutAndClearSelections', payload: { 
            cutItems: new Set<string>(selectedFileNames),
            selectedTreeItems: new Set<TreeNode>()
        }});        
    };

    const onPaste = async () => {        
        if (!gs.cutItems || gs.cutItems.size === 0) {
            await alertModal("No items to paste.");
            return;
        }
        const cutItemsArray = Array.from(gs.cutItems);
        const targetFolder = gs.treeFolder || '/';

        try {
            const requestBody = {
                targetFolder: targetFolder,
                pasteItems: cutItemsArray,
                docRootKey: gs.docRootKey
            };
            const response = await httpClientUtil.secureHttpPost('/api/docs/paste', requestBody);
            
            // Clear cutItems from global state
            gd({ type: 'clearCutItems', payload: { cutItems: new Set<string>() } });
            await reRenderTree();
            
            // Show success message
            if (response && response.pastedCount !== undefined) {
                await alertModal(`Successfully pasted ${response.pastedCount} items.`);
            } else {
                await alertModal("Items pasted successfully.");
            }
        } catch (error) {
            console.error('Error pasting items:', error);
            await alertModal("Error pasting items. Some items may already exist in this folder.");
        }
    };

    const onDelete = async () => {
        console.log('Delete button clicked');
        
        if (!gs.selectedTreeItems || gs.selectedTreeItems.size === 0) {
            await alertModal("No items selected for deletion.");
            return;
        }

        const selItems = Array.from(gs.selectedTreeItems);
        const itemCount = selItems.length;
        const itemText = itemCount === 1 ? "item" : "items";
        
        // Show confirmation dialog
        const confirmText = `Are you sure you want to delete ${itemCount} selected ${itemText}? This action cannot be undone.`;
        if (!await confirmModal(confirmText)) {
            return;
        }

        try {
            // Prepare the file names for the server
            const fileNames = selItems.map(item => item.name);
            const treeFolder = gs.treeFolder || '/';
            
            // Call server endpoint to delete the items
            const response = await httpClientUtil.secureHttpPost('/api/docs/delete', {
                fileNames: fileNames,
                treeFolder: treeFolder,
                docRootKey: gs.docRootKey
            });
            
            if (response && response.success) {
                // Remove the deleted nodes from the UI
                const remainingNodes = treeNodes.filter(node => !gs.selectedTreeItems!.has(node));
                setTreeNodes(remainingNodes);
                
                // Clear the selections
                gd({ type: 'setSelectedTreeItems', payload: { 
                    selectedTreeItems: new Set<TreeNode>()
                }});
                
                // Show success message
                const deletedCount = response.deletedCount || itemCount;
                const successMessage = `Successfully deleted ${deletedCount} ${deletedCount === 1 ? 'item' : 'items'}.`;
                await alertModal(successMessage);                
            } else {
                console.error('Error response from server:', response);
                await alertModal("Failed to delete items. Please try again.");
            }
        } catch (error) {
            console.error('Error deleting items:', error);
            await alertModal("An error occurred while deleting items. Please try again.");
        }
    };

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
                    <>
                        <label className="flex items-center cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={gs.editMode || false}
                                onChange={handleEditModeToggle}
                                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-300">Edit</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={gs.metaMode || false}
                                onChange={handleMetaModeToggle}
                                className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-300">Meta</span>
                        </label>
                        {gs.editMode && (
                            <div className="flex items-center space-x-2">
                                {itemsAreSelected && <button 
                                    onClick={onCut}
                                    className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                                    title="Cut selected items"
                                >
                                Cut
                                </button>}
                                {itemsAreCut && <button 
                                    onClick={onPaste}
                                    className="p-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                                    title="Paste items"
                                >
                                Paste
                                </button>}
                                {itemsAreSelected && <button 
                                    onClick={onDelete}
                                    className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                                    title="Delete selected items"
                                >
                                Delete
                                </button>}
                            </div>
                        )}
                        <button 
                            onClick={reRenderTree}
                            className="btn-icon"
                            title="Refresh tree"
                            disabled={isLoading}
                        >
                            <FontAwesomeIcon icon={faSync} className="h-5 w-5" />
                        </button>
                    </>}
                    {gs.treeFolder && gs.treeFolder.length > 1 && <button 
                        onClick={handleParentClick}
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
                            {/* Insert icons at top when in edit mode */}
                            {gs.editMode && (
                                
                                <div className="flex justify-center gap-2">
                                    <button 
                                        onClick={() => insertFile(null)}
                                        className="text-gray-400 hover:text-green-400 transition-colors p-1 border-0 bg-transparent"
                                        title="Insert File"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
                                    </button>
                                    <button 
                                        onClick={() => insertFolder(null)}
                                        className="text-gray-400 hover:text-blue-400 transition-colors p-1 border-0 bg-transparent"
                                        title="Insert Folder"
                                    >
                                        <FontAwesomeIcon icon={faFolder} className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                            {treeNodes
                                .filter(node => !gs.cutItems?.has(node.name))
                                .map((node, index) => {
                                    const isImage = node.mimeType.startsWith('image/');
                                    const imgSrc: string | null = isImage ? `/api/docs/images/${gs.docRootKey}${gs.treeFolder ? gs.treeFolder+'/' : ''}${node.name}` : null;

                                    return (
                                        <div key={index}>
                                            <div className={gs.editMode ? "flex items-start gap-3 border-b-2 border-green-400" : "flex items-start gap-3"}>
                                                {/* Checkbox for multi-selection when edit mode is on */}
                                                {gs.editMode && (
                                                    <div className="flex-shrink-0 pt-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={isNodeSelected(node)}
                                                            onChange={(e) => handleCheckboxChange(node, e.target.checked)}
                                                            className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                                                            title="Select this item"
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex-grow">
                                                    {/* Display content based on mimeType */}
                                                    {node.mimeType === 'folder' ? (
                                                        <div className="flex items-center justify-between">
                                                            {/* Check if this folder is currently being edited */}
                                                            {gs.editingNode === node ? (
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
                                                                                onClick={handleRenameClick}
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
                                                            ) : (
                                                                <>
                                                                    <div 
                                                                        className="flex items-center cursor-pointer hover:bg-gray-800/30 rounded-lg mb-4 transition-colors flex-grow"
                                                                        onClick={() => handleFolderClick(node.name)}
                                                                    >
                                                                        <FontAwesomeIcon 
                                                                            icon={faFolder} 
                                                                            className="text-blue-400 text-lg mr-3" 
                                                                        />
                                                                        <span className="text-blue-300 text-lg font-medium hover:text-blue-200">
                                                                            {formatDisplayName(node.name)}
                                                                        </span>
                                                                    </div>
                                                                    {gs.editMode && (
                                                                        <div className="flex items-center gap-2 ml-4">
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleEditClick(node); }}
                                                                                className="text-gray-400 hover:text-blue-400 transition-colors p-0 border-0 bg-transparent"
                                                                                title="Edit"
                                                                            >
                                                                                <FontAwesomeIcon icon={faEdit} className="h-4 w-4" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleDeleteClick(node, index); }}
                                                                                className="text-gray-400 hover:text-red-400 transition-colors p-0 border-0 bg-transparent"
                                                                                title="Delete"
                                                                            >
                                                                                <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleMoveUpClick(node); }}
                                                                                className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                                                                                title="Move Up"
                                                                            >
                                                                                <FontAwesomeIcon icon={faArrowUp} className="h-4 w-4" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleMoveDownClick(node); }}
                                                                                className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                                                                                title="Move Down"
                                                                            >
                                                                                <FontAwesomeIcon icon={faArrowDown} className="h-4 w-4" />
                                                                            </button>
                                                                        </div>
                                                                    )}
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
                                                    // Check if this file is currently being edited
                                                        gs.editingNode === node ? (
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
                                                                        onClick={handleSaveClick}
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
                                                        ) : (
                                                            <Markdown markdownContent={node.content || ''} docMode={true}/>
                                                        )
                                                    )}
                                                
                                                    {/* Display file metadata - only for non-folders */}
                                                    {node.mimeType !== 'folder' && (
                                                        <div className="mt-3 text-s text-gray-500 flex justify-end items-center">
                                                            {gs.metaMode && (<>
                                                                <span className="mr-4">{node.name}</span>
                                                                <span className="mr-4">{new Date(node.modifyTime).toLocaleDateString()}</span>
                                                            </>
                                                            )}
                                                            {gs.editMode && (
                                                                <div className="flex items-center gap-2">
                                                                    {!isImage && <button 
                                                                        onClick={() => handleEditClick(node)}
                                                                        className="text-gray-400 hover:text-blue-400 transition-colors p-0 border-0 bg-transparent"
                                                                        title="Edit"
                                                                    >
                                                                        <FontAwesomeIcon icon={faEdit} className="h-4 w-4" />
                                                                    </button>}
                                                                    <button 
                                                                        onClick={() => handleDeleteClick(node, index)}
                                                                        className="text-gray-400 hover:text-red-400 transition-colors p-0 border-0 bg-transparent"
                                                                        title="Delete"
                                                                    >
                                                                        <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleMoveUpClick(node)}
                                                                        className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                                                                        title="Move Up"
                                                                    >
                                                                        <FontAwesomeIcon icon={faArrowUp} className="h-4 w-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleMoveDownClick(node)}
                                                                        className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                                                                        title="Move Down"
                                                                    >
                                                                        <FontAwesomeIcon icon={faArrowDown} className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Insert icons below each TreeNode when in edit mode */}
                                            {gs.editMode && (
                                                <div className="flex justify-center gap-2">
                                                    <button 
                                                        onClick={() => insertFile(node)}
                                                        className="text-gray-400 hover:text-green-400 transition-colors p-1 border-0 bg-transparent"
                                                        title="Insert File"
                                                    >
                                                        <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => insertFolder(node)}
                                                        className="text-gray-400 hover:text-blue-400 transition-colors p-1 border-0 bg-transparent"
                                                        title="Insert Folder"
                                                    >
                                                        <FontAwesomeIcon icon={faFolder} className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )})}
                        </div>
                    )}
                    <div className="h-20"></div> {/* Empty div for bottom spacing */}
                </div>
            </div>
            <ImageViewerComp />
        </div>
    );
}
