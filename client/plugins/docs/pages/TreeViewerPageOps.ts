import { TreeNode } from "../../../../common/types/CommonTypes";
import { alertModal } from "../../../components/AlertModalComp";
import { confirmModal } from "../../../components/ConfirmModalComp";
import { promptModal } from "../../../components/PromptModalComp";
import { gd, DocsGlobalState } from "../DocsTypes";
import { httpClientUtil } from "../../../HttpClientUtil";
import { DBKeys } from "../../../AppServiceTypes";
import { idb } from "../../../IndexedDB";
import { util } from "../../../Util";
import { stripOrdinal } from "../../../../common/CommonUtils";

declare const ADMIN_PUBLIC_KEY: string;
declare const DESKTOP_MODE: string;

export const handleCancelClick = (gs: DocsGlobalState) => {
    // Clear editing state without saving
    if (gs.docsEditNode?.type === 'folder') {
        gd({ type: 'clearFolderEditingState', payload: { 
            docsEditNode: null,
            docsNewFolderName: null
        }});
    } else {
        gd({ type: 'clearFileEditingState', payload: { 
            docsEditNode: null,
            docsEditContent: null,
            docsNewFileName: null
        }});
    }
};

// Handle folder click navigation
export const handleFolderClick = (gs: DocsGlobalState, folderName: string) => {
    let curFolder = gs.docsFolder || '';
    if (curFolder == '/') {
        curFolder = ''; // If we're at root, we want to start with an empty string
    }
    const newFolder = `${curFolder}/${folderName}`;
        
    // Clear selections and highlighted folder when navigating to a new folder
    gd({ type: 'setTreeFolder', payload: { 
        docsFolder: newFolder,
        docsSelItems: new Set<TreeNode>(),
        docsHighlightedFolderName: null
    }});
};

export const handleFileClick = async (gs: DocsGlobalState, fileName: string) => {
    const isAdmin = ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey;
    if (!isAdmin || DESKTOP_MODE!=="y") {
        return;
    }
    // Construct the full path to the file
    let curFolder = gs.docsFolder || '';
    if (curFolder === '/') {
        curFolder = ''; // If we're at root, we want to start with an empty string
    }
    const filePath = curFolder ? `${curFolder}/${fileName}` : fileName;
    
    // Open the file using the operating system's default application
    await openItemInFileSystem(gs, "explore", filePath);
}

// Handle parent navigation (go up one level in folder tree)
export const handleParentClick = (gs: DocsGlobalState) => {
    const curFolder = gs.docsFolder || '/';
    
    // Remember the current folder name to scroll back to it after navigating up
    let folderToScrollTo: string | null = null;
    
    // Remove the last path segment to go up one level
    const lastSlashIdx = curFolder.lastIndexOf('/');
    if (lastSlashIdx > 0) {
        // Extract the folder name we're currently in (will scroll to this after going up)
        folderToScrollTo = curFolder.substring(lastSlashIdx + 1);
        const parentFolder = curFolder.substring(0, lastSlashIdx);
        
        // Clear selections when navigating to parent and set highlighted folder (without ordinal prefix for matching)
        gd({ type: 'setTreeFolder', payload: { 
            docsFolder: parentFolder,
            docsSelItems: new Set<TreeNode>(),
            docsHighlightedFolderName: stripOrdinal(folderToScrollTo)
        }});
    } else if (lastSlashIdx === 0 && curFolder.length > 1) {
        // If we're in a direct subfolder of root, go to root
        // Extract the folder name we're currently in
        folderToScrollTo = curFolder.substring(1); // Remove leading slash
        
        // Clear selections when navigating to parent and set highlighted folder (without ordinal prefix for matching)
        gd({ type: 'setTreeFolder', payload: { 
            docsFolder: '/',
            docsSelItems: new Set<TreeNode>(),
            docsHighlightedFolderName: stripOrdinal(folderToScrollTo)
        }});
    }
    
    // If we have a folder to scroll to, scroll to it after navigation
    if (folderToScrollTo) {
        scrollToItem(folderToScrollTo);
    }
};

export const handleEditModeToggle = async (gs: DocsGlobalState) => {
    // Remember the current scroll position before toggling edit mode
    const closestElementId = util.findClosestTreeNodeToTop();
    
    const newEditMode = !gs.docsEditMode;
    
    gd({ type: 'setEditMode', payload: { 
        docsEditMode: newEditMode
    }});
    
    // Persist to IndexedDB
    await idb.setItem(DBKeys.docsEditMode, newEditMode);
    
    // Restore scroll position after the page re-renders
    if (closestElementId) {
        util.scrollToElementById(closestElementId);
    }
};

export const handleMetaModeToggle = async (gs: DocsGlobalState) => {
    const newMetaMode = !gs.docsMetaMode;
    
    gd({ type: 'setMetaMode', payload: { 
        docsMetaMode: newMetaMode
    }});
    
    // Persist to IndexedDB
    await idb.setItem(DBKeys.docsMetaMode, newMetaMode);
};

export const handleNamesModeToggle = async (gs: DocsGlobalState) => {
    const newNamesMode = !gs.docsNamesMode;
    
    gd({ type: 'setNamesMode', payload: { 
        docsNamesMode: newNamesMode
    }});
    
    // Persist to IndexedDB
    await idb.setItem(DBKeys.docsNamesMode, newNamesMode);
};

// Handle checkbox selection for TreeNodes
export const handleCheckboxChange = (gs: DocsGlobalState, node: TreeNode, checked: boolean) => {
    const curSels = new Set(gs.docsSelItems);
    if (checked) {
        curSels.add(node);
    } else {
        curSels.delete(node);
    }
        
    gd({ type: 'setSelectedTreeItems', payload: { 
        docsSelItems: curSels
    }});
};

// Master checkbox functionality for select all/unselect all
export const handleMasterCheckboxChange = (gs: DocsGlobalState, treeNodes: TreeNode[], checked: boolean) => {
    if (checked) {
        // Select all available nodes (excluding cut items)
        const availableNodes = treeNodes.filter(node => !gs.docsCutItems?.has(node.name));
        gd({ type: 'setSelectedTreeItems', payload: { 
            docsSelItems: new Set<TreeNode>(availableNodes)
        }});
    } else {
        // Unselect all nodes
        gd({ type: 'setSelectedTreeItems', payload: { 
            docsSelItems: new Set<TreeNode>()
        }});
    }
};

// Helper function to determine master checkbox state
export const getMasterCheckboxState = (gs: DocsGlobalState, treeNodes: TreeNode[]): { checked: boolean, indeterminate: boolean } => {
    const availableNodes = treeNodes.filter(node => !gs.docsCutItems?.has(node.name));
    const selectedCount = gs.docsSelItems?.size || 0;
    const availableCount = availableNodes.length;
    
    if (selectedCount === 0) {
        return { checked: false, indeterminate: false };
    } else if (selectedCount === availableCount && availableCount > 0) {
        return { checked: true, indeterminate: false };
    } else {
        return { checked: false, indeterminate: true };
    }
};

// Edit mode button handlers
export const handleEditClick = (node: TreeNode) => {     
    // For folders, we're doing rename functionality
    // Strip the numeric prefix from the folder name for editing
    const nameWithoutPrefix = stripOrdinal(node.name);   
    if (node.type === 'folder') {
        gd({ type: 'setFolderEditingState', payload: { 
            docsEditNode: node,
            docsNewFolderName: nameWithoutPrefix
        }});
    } else {
        gd({ type: 'setFileEditingState', payload: { 
            docsEditNode: node,
            docsEditContent: node.content || '',
            // nameWithoutPrefix (default to blank works just fine to keep same name and makes it easier to edit a new name when wanted.
            docsNewFileName: '' 
        }});
    }
};

const deleteFileOrFolderOnServer = async (gs: DocsGlobalState, fileOrFolderName: string) => {
    try {
        const requestBody = {
            fileOrFolderName,
            treeFolder: gs.docsFolder || '/',
            docRootKey: gs.docsRootKey
        };
        await httpClientUtil.secureHttpPost('/api/docs/delete', requestBody);
    } catch (error) {
        console.error('Error deleting file or folder on server:', error);
        throw error; // Re-throw to be handled by the caller
    }
};

export const handleDeleteClick = async (gs: DocsGlobalState, treeNodes: TreeNode[], setTreeNodes: any, node: TreeNode, index: number) => {        
    // Show confirmation dialog
    const confirmText = node.type === 'folder' 
        ? `Delete the folder "${stripOrdinal(node.name)}"? This action cannot be undone.`
        : `Delete the file "${stripOrdinal(node.name)}"? This action cannot be undone.`;
            
    if (!await confirmModal(confirmText)) {
        return;
    }

    try {
        // Call server endpoint to delete the file or folder
        await deleteFileOrFolderOnServer(gs, node.name);
            
        // Remove the node from the UI by updating treeNodes
        const updatedNodes = treeNodes.filter((_: any, i: any) => i !== index);
        setTreeNodes(updatedNodes);
            
        console.log(`${node.type === 'folder' ? 'Folder' : 'File'} deleted successfully:`, node.name);
    } catch (error) {
        console.error('Error deleting:', error);
    }
};

export const handleMoveUpClick = (gs: DocsGlobalState, treeNodes: TreeNode[], setTreeNodes: any, node: TreeNode) => {
    moveFileOrFolder(gs, treeNodes, setTreeNodes, node, 'up');
};

export const handleMoveDownClick = (gs: DocsGlobalState, treeNodes: TreeNode[], setTreeNodes: any, node: TreeNode) => {
    moveFileOrFolder(gs, treeNodes, setTreeNodes, node, 'down');
};

const moveFileOrFolder = async (gs: DocsGlobalState, treeNodes: TreeNode[], setTreeNodes: any, node: TreeNode, direction: 'up' | 'down') => {
    try {
        const requestBody = {
            direction,
            filename: node.name,
            treeFolder: gs.docsFolder || '/',
            docRootKey: gs.docsRootKey
        };
            
        const response = await httpClientUtil.secureHttpPost('/api/docs/move-up-down', requestBody);
            
        // Update the local tree nodes based on the server response
        if (response && response.oldName1 && response.newName1 && response.oldName2 && response.newName2) {
            const updatedNodes = treeNodes.map(treeNode => {
                if (treeNode.name === response.oldName1) {
                    // Update the name and also update content if it's an image (content contains file path)
                    const updatedNode = { ...treeNode, name: response.newName1 };
                    if (treeNode.type === 'image' && treeNode.content) {
                        // Update the file path in content to reflect the new filename
                        updatedNode.content = treeNode.content.replace(response.oldName1, response.newName1);
                    }
                    return updatedNode;
                } else if (treeNode.name === response.oldName2) {
                    // Update the name and also update content if it's an image (content contains file path)
                    const updatedNode = { ...treeNode, name: response.newName2 };
                    if (treeNode.type === 'image' && treeNode.content) {
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
    }
};

// Insert functions for creating new files and folders
export const insertFile = async (gs: DocsGlobalState, reRenderTree: any, node: TreeNode | null) => {
    // DO NOT DELETE. Leave this just in case.
    // const fileName = await promptModal("Enter new file name");
    // if (!fileName || fileName.trim() === '') {
    //     return;
    // }
    const fileName = "file";
        
    try {
        const requestBody = {
            fileName: fileName,
            treeFolder: gs.docsFolder || '/',
            insertAfterNode: node ? node.name : '',
            docRootKey: gs.docsRootKey
        };
        const response = await httpClientUtil.secureHttpPost('/api/docs/file/create', requestBody);
            
        // Refresh the tree view to show the new file
        if (response && response.success) {
            const updatedNodes = await reRenderTree();
                
            // Automatically start editing the newly created file
            setTimeout(() => {
                const newFileNode = updatedNodes.find((n: any) => n.name ===response.fileName);
                if (newFileNode) {
                    // DO NOT DELETE. Leave this just in case.
                    // Now let's check to make sure the count of matching files is not more than 1

                    // We changed our logic to let users always sort of ignore that file names even exist and never enter any
                    // filenames, and the system will just have "0001_file.md", "0002_file.md", etc., in this case which is fine.
                    // const matchingFiles = updatedNodes.filter((n: any) => n.name.endsWith(findStr));
                    // if (matchingFiles.length > 1) {
                    //     alertModal(`Multiple files found ending with "${findStr}". This is not recommended.`);
                    // }

                    // const fileNameWithoutPrefix = stripOrdinal(newFileNode.name);
                    gd({ type: 'setFileEditingState', payload: { 
                        docsEditNode: newFileNode,
                        docsEditContent: newFileNode.content || '',
                        // nameWithoutPrefix (default to blank works just fine to keep same name and makes it easier to edit a new name when wanted.
                        docsNewFileName: '' // fileNameWithoutPrefix
                    }});
                }
                else {
                    console.error('Newly created file node not found in treeNodes:', fileName);
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error creating file:', error);
    }
};

// Helper function to create valid HTML IDs from item names
export const createValidId = (itemName: string): string => {
    if (!itemName) {
        console.warn('createValidId called with empty itemName. Generating random ID.');
        // generate random ID if itemName is empty
        return 'tree-' + Math.random().toString(36).substring(2, 15);
    }
    // Replace invalid characters and ensure it starts with a letter
    return 'tree-' + itemName.replace(/[^a-zA-Z0-9_-]/g, '-');
};

// Scroll to an item in the tree view by its name 
export const scrollToItem = (itemName: string) => {
    setTimeout(() => {
        const validId = createValidId(itemName);
        const element = document.getElementById(validId);
        if (element) {
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
        }
    }, 250);
};

export const insertFolder = async (gs: DocsGlobalState, reRenderTree: any, node: TreeNode | null) => {
    const name = await promptModal("Enter new folder name");
    if (!name || name.trim() === '') {
        return;
    }
        
    try {
        const requestBody = {
            folderName: name,
            treeFolder: gs.docsFolder || '/',
            insertAfterNode: node ? node.name : '',
            docRootKey: gs.docsRootKey
        };
            
        const response = await httpClientUtil.secureHttpPost('/api/docs/folder/create', requestBody);

        // Refresh the tree view to show the new folder
        if (response && response.success) {
            await reRenderTree();
            // Scroll to the newly created folder
            if (response.folderName) {
                scrollToItem(response.folderName);
            }
        }
    } catch (error) {
        console.error('Error creating folder:', error);
    }
};

export const handleSaveClick = (gs: DocsGlobalState, treeNodes: TreeNode[], setTreeNodes: any) => {
    if (gs.docsEditNode && gs.docsEditContent !== null) {
        // Get the original filename and new filename
        const originalName = gs.docsEditNode.name;
        const newFileName = gs.docsNewFileName || stripOrdinal(originalName);
            
        // Extract the numeric prefix from the original file name
        const underscoreIdx = originalName.indexOf('_');
        const numericPrefix = underscoreIdx !== -1 ? originalName.substring(0, underscoreIdx + 1) : '';
            
        // Create the new full file name with the numeric prefix
        let newFullFileName = numericPrefix + newFileName;

        // if newFullName doesn't have a file any extension at all, add '.md' to it
        if (!newFullFileName.includes('.')) {
            newFullFileName += '.md';
        }

        // Find the node in treeNodes and update its content and name
        const updatedNodes = treeNodes.map(node => 
            node === gs.docsEditNode 
                ? { ...node, content: gs.docsEditContent || '', name: newFullFileName }
                : node
        );
        setTreeNodes(updatedNodes);
            
        // Clear editing state
        gd({ type: 'clearFileEditingState', payload: { 
            docsEditNode: null,
            docsEditContent: null,
            docsNewFileName: null
        }});

        // Save to server with a delay to ensure UI updates first
        setTimeout(() => {
            saveToServer(gs, gs.docsEditNode!.name, gs.docsEditContent || '', newFullFileName);
        }, 500);
    }
};

const saveToServer = async (gs: DocsGlobalState, filename: string, content: string, newFileName?: string) => {
    try {
        const requestBody = {
            filename: filename,
            content: content,
            treeFolder: gs.docsFolder || '/',
            newFileName: newFileName || filename,
            docRootKey: gs.docsRootKey
        };
        await httpClientUtil.secureHttpPost('/api/docs/save-file/', requestBody);
    } catch (error) {
        console.error('Error saving file to server:', error);
    }
};

const renameFolderOnServer = async (gs: DocsGlobalState, oldFolderName: string, newFolderName: string) => {
    try {
        const requestBody = {
            oldFolderName,
            newFolderName,
            treeFolder: gs.docsFolder || '/',
            docRootKey: gs.docsRootKey
        };
        await httpClientUtil.secureHttpPost('/api/docs/rename-folder/', requestBody);
    } catch (error) {
        console.error('Error renaming folder on server:', error);
    }
};

export const handleRenameClick = (gs: DocsGlobalState, treeNodes: TreeNode[], setTreeNodes: any) => {
    if (gs.docsEditNode && gs.docsNewFolderName !== null) {
        // Extract the numeric prefix from the original folder name
        const originalName = gs.docsEditNode.name;
        const underscoreIdx = originalName.indexOf('_');
        const numericPrefix = underscoreIdx !== -1 ? originalName.substring(0, underscoreIdx + 1) : '';
            
        // Create the new full folder name with the numeric prefix
        const newFullFolderName = numericPrefix + gs.docsNewFolderName;
            
        // Find the node in treeNodes and update its name
        const updatedNodes = treeNodes.map(node => 
            node === gs.docsEditNode 
                ? { ...node, name: newFullFolderName }
                : node
        );
        setTreeNodes(updatedNodes);
            
        // Clear editing state
        gd({ type: 'clearFolderEditingState', payload: { 
            docsEditNode: null,
            docsNewFolderName: null
        }});

        // Rename on server with a delay to ensure UI updates first
        setTimeout(() => {
            renameFolderOnServer(gs, gs.docsEditNode!.name, newFullFolderName);
        }, 500);
    }
};

// Header button handlers for Cut, Paste, Delete
export const onCut = (gs: DocsGlobalState) => {        
    if (!gs.docsSelItems || gs.docsSelItems.size === 0) {
        return;
    }

    // Get the file names of selected items
    const selectedFileNames = Array.from(gs.docsSelItems).map(node => node.name);
        
    // Update global state to set cutItems and clear selected items
    gd({ type: 'setCutAndClearSelections', payload: { 
        docsCutItems: new Set<string>(selectedFileNames),
        docsSelItems: new Set<TreeNode>()
    }});        
};

export const onPaste = async (gs: DocsGlobalState, reRenderTree: any, targetNode?: TreeNode | null) => {        
    if (!gs.docsCutItems || gs.docsCutItems.size === 0) {
        await alertModal("No items to paste.");
        return;
    }
    const cutItemsArray = Array.from(gs.docsCutItems);
    const targetFolder = gs.docsFolder || '/';

    try {
        const requestBody = {
            targetFolder: targetFolder,
            pasteItems: cutItemsArray,
            docRootKey: gs.docsRootKey,
            targetOrdinal: targetNode?.name // Include targetOrdinal for positional pasting
        };
        await httpClientUtil.secureHttpPost('/api/docs/paste', requestBody);
            
        // Clear cutItems from global state
        gd({ type: 'clearCutItems', payload: { docsCutItems: new Set<string>() } });
        await reRenderTree();
    } catch (error) {
        console.error('Error pasting items:', error);
        await alertModal("Error pasting items. Some items may already exist in this folder.");
    }
};

export const onPasteIntoFolder = async (gs: DocsGlobalState, reRenderTree: any, folderNode: TreeNode) => {        
    if (!gs.docsCutItems || gs.docsCutItems.size === 0) {
        await alertModal("No items to paste.");
        return;
    }
    const cutItemsArray = Array.from(gs.docsCutItems);
    
    // Construct the target folder path by combining current path with folder name
    let currentFolder = gs.docsFolder || '';
    if (currentFolder === '/') {
        currentFolder = ''; // If we're at root, we want to start with an empty string
    }
    const targetFolder = `${currentFolder}/${folderNode.name}`;

    try {
        const requestBody = {
            targetFolder: targetFolder,
            pasteItems: cutItemsArray,
            docRootKey: gs.docsRootKey
        };
        await httpClientUtil.secureHttpPost('/api/docs/paste', requestBody);
            
        // Clear cutItems from global state
        gd({ type: 'clearCutItems', payload: { docsCutItems: new Set<string>() } });
        await reRenderTree();
    } catch (error) {
        console.error('Error pasting items into folder:', error);
        await alertModal("Error pasting items into folder. Some items may already exist in this folder.");
    }
};

export const onDelete = async (gs: DocsGlobalState, treeNodes: TreeNode[], setTreeNodes: any) => {        
    if (!gs.docsSelItems || gs.docsSelItems.size === 0) {
        await alertModal("No items selected for deletion.");
        return;
    }

    const selItems = Array.from(gs.docsSelItems);
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
            
        // Call server endpoint to delete the items
        const response = await httpClientUtil.secureHttpPost('/api/docs/delete', {
            fileNames: fileNames,
            treeFolder: gs.docsFolder || '/',
            docRootKey: gs.docsRootKey
        });
            
        if (response && response.success) {
            // Remove the deleted nodes from the UI
            const remainingNodes = treeNodes.filter((node: any) => !gs.docsSelItems!.has(node));
            setTreeNodes(remainingNodes);
                
            // Clear the selections
            gd({ type: 'setSelectedTreeItems', payload: { 
                docsSelItems: new Set<TreeNode>()
            }});
        } else {
            console.error('Error response from server:', response);
            await alertModal("Failed to delete items. Please try again.");
        }
    } catch (error) {
        console.error('Error deleting items:', error);
        await alertModal("An error occurred while deleting items. Please try again.");
    }
};

/**
 * Opens an item (file or folder) in the operating system's default application
 * @param gs - Global state containing the current tree folder and doc root key
 * @param itemPath - Optional specific item path. If not provided, opens the current folder
 */
export const openItemInFileSystem = async (gs: DocsGlobalState, action: "edit" | "explore", itemPath?: string) => {
    try {
        // Use the provided item path or default to the current folder
        const treeItem = itemPath || gs.docsFolder || '/';

        const requestBody = {
            treeItem,
            docRootKey: gs.docsRootKey,
            action
        };

        const response = await httpClientUtil.secureHttpPost('/api/docs/file-system-open', requestBody);
        
        if (!response.success) {
            console.error('Error response from server:', response);
            await alertModal("Failed to open item in file system. Please try again.");
        }
    } catch (error) {
        console.error('Error opening item in file system:', error);
        await alertModal("An error occurred while opening the item. Please try again.");
    }
};

export const handleSaveSplitClick = (gs: DocsGlobalState, treeNodes: TreeNode[], setTreeNodes: any, reRenderTree: any) => {
    if (gs.docsEditNode && gs.docsEditContent !== null) {
        // Get the original filename and new filename
        const originalName = gs.docsEditNode.name;
        const newFileName = gs.docsNewFileName || stripOrdinal(originalName);
            
        // Extract the numeric prefix from the original file name
        const underscoreIdx = originalName.indexOf('_');
        const numericPrefix = underscoreIdx !== -1 ? originalName.substring(0, underscoreIdx + 1) : '';
            
        // Create the new full file name with the numeric prefix
        let newFullFileName = numericPrefix + newFileName;

        // if newFullName doesn't have a file any extension at all, add '.md' to it
        if (!newFullFileName.includes('.')) {
            newFullFileName += '.md';
        }

        // Find the node in treeNodes and update its content and name
        const updatedNodes = treeNodes.map(node => 
            node === gs.docsEditNode 
                ? { ...node, content: gs.docsEditContent || '', name: newFullFileName }
                : node
        );
        setTreeNodes(updatedNodes);
            
        // Clear editing state
        gd({ type: 'clearFileEditingState', payload: { 
            docsEditNode: null,
            docsEditContent: null,
            docsNewFileName: null
        }});

        // Save to server with split=true parameter with a delay to ensure UI updates first
        setTimeout(async () => {
            await saveToServerWithSplit(gs, gs.docsEditNode!.name, gs.docsEditContent || '', newFullFileName);
            await reRenderTree();
        }, 500);
    }
};

const saveToServerWithSplit = async (gs: DocsGlobalState, filename: string, content: string, newFileName?: string) => {
    try {
        const requestBody = {
            filename: filename,
            content: content,
            treeFolder: gs.docsFolder || '/',
            newFileName: newFileName || filename,
            docRootKey: gs.docsRootKey,
            split: true
        };
        const response = await httpClientUtil.secureHttpPost('/api/docs/save-file/', requestBody);
        
        if (response && response.success) {
            await alertModal(response.message || 'File split successfully');
        } else {
            await alertModal('Error splitting file');
        }
    } catch (error) {
        console.error('Error saving file to server with split:', error);
        await alertModal('Error splitting file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
};

export const onJoin = async (gs: DocsGlobalState, reRenderTree: any) => {        
    if (!gs.docsSelItems || gs.docsSelItems.size < 2) {
        await alertModal("At least 2 files must be selected to join them.");
        return;
    }

    // Filter selected items to only include files (not folders)
    const selectedFiles = Array.from(gs.docsSelItems).filter(node => node.type === 'text');
    
    if (selectedFiles.length < 2) {
        await alertModal("At least 2 text files must be selected to join them.");
        return;
    }

    if (selectedFiles.length !== gs.docsSelItems.size) {
        await alertModal("Only text files can be joined. Please ensure all selected items are text files.");
        return;
    }

    const fileCount = selectedFiles.length;
    const confirmText = `Are you sure you want to join ${fileCount} selected files? This will concatenate their content into the first file (by ordinal) and delete the remaining files. This action cannot be undone.`;
    
    if (!await confirmModal(confirmText)) {
        return;
    }

    try {
        // Prepare the file names for the server
        const fileNames = selectedFiles.map(item => item.name);
            
        // Call server endpoint to join the files
        const response = await httpClientUtil.secureHttpPost('/api/docs/join', {
            filenames: fileNames,
            treeFolder: gs.docsFolder || '/',
            docRootKey: gs.docsRootKey
        });
            
        if (response && response.success) {
            // Clear the selections
            gd({ type: 'setSelectedTreeItems', payload: { 
                docsSelItems: new Set<TreeNode>()
            }});

            // Refresh the tree view to show the updated state
            await reRenderTree();

            // Show success message
            await alertModal(response.message || `Successfully joined ${fileCount} files into ${response.joinedFile || 'the first file'}.`);
        } else {
            await alertModal("Error joining files: " + (response?.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error joining files:', error);
        await alertModal("Error joining files: " + (error instanceof Error ? error.message : 'Unknown error'));
    }
};

