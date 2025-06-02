import { TreeNode } from "../../common/types/CommonTypes";
import { alertModal } from "../components/AlertModalComp";
import { confirmModal } from "../components/ConfirmModalComp";
import { promptModal } from "../components/PromptModalComp";
import { GlobalState } from "../GlobalState";
import { gd } from '../GlobalState';
import { httpClientUtil } from "../HttpClientUtil";
import { DBKeys } from "../AppServiceTypes";
import { idb } from "../IndexedDB";

declare const ADMIN_PUBLIC_KEY: string;
declare const DESKTOP_MODE: string;

export const formatDisplayName = (name: string) => {
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

// This method should split apart path into its components and format it nicely
// using formatFileName for each component.
export function formatFullPath(path: string): string {
    if (!path || path === '/') {
        return '';
    }
        
    // Split the path by '/' and format each component
    const comps = path.split('/').filter(Boolean); // Filter out empty components
    return comps.map(formatDisplayName).join(' / ');
}

export const handleCancelClick = (gs: GlobalState) => {
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

// Removes the prefix from the file name. We find the first occurrence of an underscore and return the substring after it.
export const stripOrdinal = (name: string) => {
    const idx = name.indexOf('_');
    return idx !== -1 ? name.substring(idx + 1) : name;
}   

// Handle folder click navigation
export const handleFolderClick = (gs: GlobalState, folderName: string) => {
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

export const handleFileClick = async (gs: GlobalState, fileName: string) => {
    const isAdmin = ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey;
    if (!isAdmin || DESKTOP_MODE!=="y") {
        return;
    }
    // Construct the full path to the file
    let curFolder = gs.treeFolder || '';
    if (curFolder === '/') {
        curFolder = ''; // If we're at root, we want to start with an empty string
    }
    const filePath = curFolder ? `${curFolder}/${fileName}` : fileName;
    
    // Open the file using the operating system's default application
    await openItemInFileSystem(gs, filePath);
}

// Handle parent navigation (go up one level in folder tree)
export const handleParentClick = (gs: GlobalState) => {
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

export const handleEditModeToggle = async (gs: GlobalState) => {
    const newEditMode = !gs.editMode;
    
    gd({ type: 'setEditMode', payload: { 
        editMode: newEditMode
    }});
    
    // Persist to IndexedDB
    await idb.setItem(DBKeys.editMode, newEditMode);
};

export const handleMetaModeToggle = async (gs: GlobalState) => {
    const newMetaMode = !gs.metaMode;
    
    gd({ type: 'setMetaMode', payload: { 
        metaMode: newMetaMode
    }});
    
    // Persist to IndexedDB
    await idb.setItem(DBKeys.metaMode, newMetaMode);
};

// Handle checkbox selection for TreeNodes
export const handleCheckboxChange = (gs: GlobalState, node: TreeNode, checked: boolean) => {
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

// Edit mode button handlers
export const handleEditClick = (node: TreeNode) => {     
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

const deleteFileOrFolderOnServer = async (gs: GlobalState, fileOrFolderName: string) => {
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

export const handleDeleteClick = async (gs: GlobalState, treeNodes: TreeNode[], setTreeNodes: any, node: TreeNode, index: number) => {        
    // Show confirmation dialog
    const confirmText = node.mimeType === 'folder' 
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
            
        console.log(`${node.mimeType === 'folder' ? 'Folder' : 'File'} deleted successfully:`, node.name);
    } catch (error) {
        console.error('Error deleting:', error);
    }
};

export const handleMoveUpClick = (gs: GlobalState, treeNodes: TreeNode[], setTreeNodes: any, node: TreeNode) => {
    moveFileOrFolder(gs, treeNodes, setTreeNodes, node, 'up');
};

export const handleMoveDownClick = (gs: GlobalState, treeNodes: TreeNode[], setTreeNodes: any, node: TreeNode) => {
    moveFileOrFolder(gs, treeNodes, setTreeNodes, node, 'down');
};

const moveFileOrFolder = async (gs: GlobalState, treeNodes: TreeNode[], setTreeNodes: any, node: TreeNode, direction: 'up' | 'down') => {
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
    }
};

// Insert functions for creating new files and folders
export const insertFile = async (gs: GlobalState, reRenderTree: any, node: TreeNode | null) => {
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
                const newFileNode = updatedNodes.find((n: any) => n.name.endsWith(findStr));
                if (newFileNode) {
                    // Now let's check to make sure the count of matching files is not more than 1
                    const matchingFiles = updatedNodes.filter((n: any) => n.name.endsWith(findStr));
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
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error creating file:', error);
    }
};

export const insertFolder = async (gs: GlobalState, reRenderTree: any, node: TreeNode | null) => {
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

        // Refresh the tree view to show the new file
        if (response && response.success) {
            await reRenderTree();
        }
    } catch (error) {
        console.error('Error creating folder:', error);
    }
};

export const handleSaveClick = (gs: GlobalState, treeNodes: TreeNode[], setTreeNodes: any) => {
    if (gs.editingNode && gs.editingContent !== null) {
        // Get the original filename and new filename
        const originalName = gs.editingNode.name;
        const newFileName = gs.newFileName || stripOrdinal(originalName);
            
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
            saveToServer(gs, gs.editingNode!.name, gs.editingContent || '', newFullFileName);
        }, 500);
    }
};

const saveToServer = async (gs: GlobalState, filename: string, content: string, newFileName?: string) => {
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
    }
};

const renameFolderOnServer = async (gs: GlobalState, oldFolderName: string, newFolderName: string) => {
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
    }
};

export const handleRenameClick = (gs: GlobalState, treeNodes: TreeNode[], setTreeNodes: any) => {
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
            renameFolderOnServer(gs, gs.editingNode!.name, newFullFolderName);
        }, 500);
    }
};

// Header button handlers for Cut, Paste, Delete
export const onCut = (gs: GlobalState) => {        
    if (!gs.selectedTreeItems || gs.selectedTreeItems.size === 0) {
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

export const onCutAll = (gs: GlobalState, treeNodes: TreeNode[]) => {
    // Filter out nodes that are already cut
    const availableNodes = treeNodes.filter(node => !gs.cutItems?.has(node.name));
    
    if (availableNodes.length === 0) {
        return;
    }

    // Get the file names of all available nodes
    const allFileNames = availableNodes.map(node => node.name);
        
    // Update global state to set cutItems (effectively selecting all and then cutting)
    gd({ type: 'setCutAndClearSelections', payload: { 
        cutItems: new Set<string>([...(gs.cutItems || []), ...allFileNames]),
        selectedTreeItems: new Set<TreeNode>()
    }});        
};

export const onPaste = async (gs: GlobalState, reRenderTree: any, targetNode?: TreeNode | null) => {        
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
            docRootKey: gs.docRootKey,
            targetOrdinal: targetNode?.name // Include targetOrdinal for positional pasting
        };
        await httpClientUtil.secureHttpPost('/api/docs/paste', requestBody);
            
        // Clear cutItems from global state
        gd({ type: 'clearCutItems', payload: { cutItems: new Set<string>() } });
        await reRenderTree();
    } catch (error) {
        console.error('Error pasting items:', error);
        await alertModal("Error pasting items. Some items may already exist in this folder.");
    }
};

export const onDelete = async (gs: GlobalState, treeNodes: TreeNode[], setTreeNodes: any) => {        
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
            const remainingNodes = treeNodes.filter((node: any) => !gs.selectedTreeItems!.has(node));
            setTreeNodes(remainingNodes);
                
            // Clear the selections
            gd({ type: 'setSelectedTreeItems', payload: { 
                selectedTreeItems: new Set<TreeNode>()
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
export const openItemInFileSystem = async (gs: GlobalState, itemPath?: string) => {
    try {
        // Use the provided item path or default to the current folder
        const treeItem = itemPath || gs.treeFolder || '/';
        const docRootKey = gs.docRootKey;

        const requestBody = {
            treeItem,
            docRootKey
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

