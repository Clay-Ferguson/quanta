import { useEffect, useRef, useState } from 'react';
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
import { faFolder, faEdit, faTrash, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons'; 

/**
 * Page for displaying a tree viewer that shows server-side folder contents as an array of Markdown elements and images.
 * Fetches file content from the server and displays each file as a separate component based on its MIME type.
 */
export default function TreeViewerPage() {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
    const [error, setError] = useState<string | null>(null);
    const gs = useGlobalState();
    
    useEffect(() => util.resizeEffect(), []);

    // Handle folder click navigation
    const handleFolderClick = (folderName: string) => {
        const currentFolder = gs.treeFolder || '/Quanta-User-Guide';
        const newFolder = `${currentFolder}/${folderName}`;
        
        gd({ type: 'setTreeFolder', payload: { 
            treeFolder: newFolder
        }});
    };

    // Handle parent navigation (go up one level in folder tree)
    const handleParentClick = () => {
        const currentFolder = gs.treeFolder || '/Quanta-User-Guide';
        // Remove the last path segment to go up one level
        const lastSlashIndex = currentFolder.lastIndexOf('/');
        if (lastSlashIndex > 0) {
            const parentFolder = currentFolder.substring(0, lastSlashIndex);
            gd({ type: 'setTreeFolder', payload: { 
                treeFolder: parentFolder
            }});
        } else if (lastSlashIndex === 0 && currentFolder.length > 1) {
            // If we're in a direct subfolder of root, go to root
            gd({ type: 'setTreeFolder', payload: { 
                treeFolder: '/'
            }});
        }
    };

    // Removes the prefix from the file name. We find the first occurrence of an underscore and return the substring after it.
    const formatFileName = (name: string) => {
        const underscoreIndex = name.indexOf('_');
        return underscoreIndex !== -1 ? name.substring(underscoreIndex + 1) : name;
    }   

    // Check if parent button should be shown
    const shouldShowParentButton = () => {
        const currentFolder = gs.treeFolder || '/Quanta-User-Guide';
        return currentFolder !== '/' && currentFolder !== '' && currentFolder !== '/Quanta-User-Guide';
    };

    // Handle edit mode toggle
    const handleEditModeToggle = () => {
        gd({ type: 'setEditMode', payload: { 
            editMode: !gs.editMode
        }});
    };

    // Edit mode button handlers
    const handleEditClick = (node: TreeNode, index: number) => {
        console.log('Edit clicked for:', node.name, 'at index:', index);
        // Only allow editing of files, not folders
        if (node.mimeType !== 'folder') {
            gd({ type: 'setEditingState', payload: { 
                editingNode: node,
                editingContent: node.content || ''
            }});
        }
    };

    const handleDeleteClick = (node: TreeNode, index: number) => {
        console.log('Delete clicked for:', node.name, 'at index:', index);
        // TODO: Implement delete functionality
    };

    const handleMoveUpClick = (node: TreeNode, index: number) => {
        console.log('Move up clicked for:', node.name, 'at index:', index);
        // TODO: Implement move up functionality
    };

    const handleMoveDownClick = (node: TreeNode, index: number) => {
        console.log('Move down clicked for:', node.name, 'at index:', index);
        // TODO: Implement move down functionality
    };

    // Editing handlers
    const handleSaveClick = () => {
        if (gs.editingNode && gs.editingContent !== null) {
            // Find the node in treeNodes and update its content
            const updatedNodes = treeNodes.map(node => 
                node === gs.editingNode 
                    ? { ...node, content: gs.editingContent || '' }
                    : node
            );
            setTreeNodes(updatedNodes);
            
            // Clear editing state
            gd({ type: 'clearEditingState', payload: { 
                editingNode: null,
                editingContent: null
            }});
        }
    };

    const handleCancelClick = () => {
        // Clear editing state without saving
        gd({ type: 'clearEditingState', payload: { 
            editingNode: null,
            editingContent: null
        }});
    };

    const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        gd({ type: 'setEditingContent', payload: { 
            editingContent: event.target.value
        }});
    };

    useEffect(() => {
        const fetchTree = async () => {
            setIsLoading(true);
            setError(null);
            try {
                console.log("Loading tree document...");
                
                // Get the treeFolder from global state
                const treeFolder = gs.treeFolder || '/Quanta-User-Guide';
                
                // Make API call to get tree nodes
                const url = `/api/docs/render${treeFolder}`;
                const response: TreeRender_Response = await httpClientUtil.httpGet(url);
                
                if (response && response.treeNodes) {
                    setTreeNodes(response.treeNodes);
                } else {
                    setError("No tree data received from server");
                }
            } catch (error) {
                console.error('Error loading tree:', error);
                setError(`Sorry, we encountered an error loading the tree for "${gs.treeFolder || '/Quanta-User-Guide'}".`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTree();
    }, [gs.treeFolder]);

    const elmRef = useRef<HTMLDivElement>(null);
    // useLayoutEffect(() => scrollEffects.layoutEffect(elmRef, false), [docContent]);
    useEffect(() => scrollEffects.effect(elmRef), []);

    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Tree Viewer"/>
                <div className="flex items-center space-x-4">
                    <label className="flex items-center cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={gs.editMode || false}
                            onChange={handleEditModeToggle}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-300">Edit</span>
                    </label>
                    {shouldShowParentButton() && (
                        <button 
                            onClick={handleParentClick}
                            className="p-2 bg-gray-500 text-white rounded-md flex items-center justify-center"
                            title="Go to parent folder"
                        >
                            <FontAwesomeIcon icon={faFolder} className="h-5 w-5 mr-1" />
                            Parent
                        </button>
                    )}
                    <BackButtonComp/>
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
                            {treeNodes.map((node, index) => (
                                <div key={index} className={node.mimeType === 'folder' ? "" : (index < treeNodes.length - 1 ? "border-b border-gray-700 pb-6 mb-6" : "pb-6")}>
                                    {/* Display content based on mimeType */}
                                    {node.mimeType === 'folder' ? (
                                        <div className="flex items-center justify-between">
                                            <div 
                                                className="flex items-center cursor-pointer hover:bg-gray-800/30 rounded-lg py-1 px-2 transition-colors flex-grow"
                                                onClick={() => handleFolderClick(node.name)}
                                            >
                                                <FontAwesomeIcon 
                                                    icon={faFolder} 
                                                    className="text-blue-400 text-lg mr-3" 
                                                />
                                                <span className="text-blue-300 text-lg font-medium hover:text-blue-200">
                                                    {formatFileName(node.name)}
                                                </span>
                                            </div>
                                            {gs.editMode && (
                                                <div className="flex items-center gap-2 ml-4">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleEditClick(node, index); }}
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
                                                        onClick={(e) => { e.stopPropagation(); handleMoveUpClick(node, index); }}
                                                        className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                                                        title="Move Up"
                                                    >
                                                        <FontAwesomeIcon icon={faArrowUp} className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleMoveDownClick(node, index); }}
                                                        className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                                                        title="Move Down"
                                                    >
                                                        <FontAwesomeIcon icon={faArrowDown} className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : node.mimeType.startsWith('image/') ? (
                                        <div className="flex justify-center">
                                            <img 
                                                src={`/api/docs/images${gs.treeFolder || '/Quanta-User-Guide'}/${node.name}`}
                                                alt={node.name}
                                                className="max-w-full h-auto rounded-lg shadow-lg"
                                                onError={(e) => {
                                                    // Fallback if image fails to load
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
                                                <textarea
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
                                            <Markdown markdownContent={node.content || ''} />
                                        )
                                    )}
                                    
                                    {/* Display file metadata - only for non-folders */}
                                    {node.mimeType !== 'folder' && (
                                        <div className="mt-3 text-xs text-gray-500 flex justify-between items-center">
                                            <span>Modified: {new Date(node.modifyTime).toLocaleDateString()}</span>
                                            {gs.editMode && (
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => handleEditClick(node, index)}
                                                        className="text-gray-400 hover:text-blue-400 transition-colors p-0 border-0 bg-transparent"
                                                        title="Edit"
                                                    >
                                                        <FontAwesomeIcon icon={faEdit} className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteClick(node, index)}
                                                        className="text-gray-400 hover:text-red-400 transition-colors p-0 border-0 bg-transparent"
                                                        title="Delete"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMoveUpClick(node, index)}
                                                        className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                                                        title="Move Up"
                                                    >
                                                        <FontAwesomeIcon icon={faArrowUp} className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMoveDownClick(node, index)}
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
                            ))}
                        </div>
                    )}
                    <div className="h-20"></div> {/* Empty div for bottom spacing */}
                </div>
            </div>
        </div>
    );
}
