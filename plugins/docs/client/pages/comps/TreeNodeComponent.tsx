import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder, faFile, faExclamationTriangle, faShareAlt } from '@fortawesome/free-solid-svg-icons';
import { TreeNode } from '../../../../../common/types/CommonTypes';
import { DocsGlobalState } from '../../DocsTypes';
import { isImageFile, isTextFile, stripOrdinal, formatDateTime } from '../../../../../common/CommonUtils';
import { setFullSizeImage } from '../../../../../client/components/ImageViewerComp';
import { signedArgs } from '../../../../../client/AppService';
import { handleCheckboxChange, handleFolderClick, handleFileClick } from '../TreeViewerPageOps';
import EditIcons from './EditIcons';
import EditFolder from './EditFolder';
import EditFile from './EditFile';
import InsertItemsRow from './InsertItemsRow';
import ColumnMarkdownRenderer from './ColumnMarkdownRenderer';

declare const DESKTOP_MODE: boolean;
declare const ADMIN_PUBLIC_KEY: string;

interface TreeNodeComponentProps {
    node: TreeNode;
    index: number;
    validId: string;
    numNodes: number;
    gs: DocsGlobalState;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    isNodeSelected: (node: TreeNode) => boolean;
    handleCancelClick: () => void;
    handleFolderNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    formatDisplayName: (name: string) => string;
    contentTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
    reRenderTree: () => Promise<TreeNode[]>;
}

/**
 * Component for rendering individual tree nodes (files and folders)
 */
export default function TreeNodeComponent({ 
    node, 
    index, 
    validId,
    numNodes,
    gs, 
    treeNodes, 
    setTreeNodes, 
    isNodeSelected, 
    handleCancelClick, 
    handleFolderNameChange, 
    formatDisplayName,
    contentTextareaRef,
    reRenderTree
}: TreeNodeComponentProps) {
    const isOurNode = node.owner_id === gs.userProfile?.userId;
    const isImage = isImageFile(node.name);
    let imgSrc: string | null = null;
    if (isImage) {
        imgSrc =`/api/docs/images/${gs.docsRootKey}/${node.url}`;
        // remove any double slashes
        imgSrc = imgSrc.replace(/\/\//g, '/');
        if (signedArgs) {
            imgSrc += `?${signedArgs.args}`;
        }
    }

    const textFile = isTextFile(node.name);
    const isFolder = node.is_directory;
    const isBinary = !isImage && !isFolder && !textFile;

    // Check if this is the highlighted folder that we came up from
    // Compare the stripped names (without ordinal prefix) for exact match
    const isHighlightedFolder = isFolder && gs.docsHighlightedFolderName && 
        stripOrdinal(node.name) === gs.docsHighlightedFolderName;
    
    // Check if this is the highlighted file that we jumped to from search
    // Compare the stripped names (without ordinal prefix) for exact match
    const isHighlightedFile = !isFolder && gs.docsHighlightedFileName && 
        node.name === gs.docsHighlightedFileName;
    const isAdmin = ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey;
    const canMod = isOurNode || isAdmin;
    
    // Determine the border class based on whether this is highlighted
    const getBorderClass = () => {
        let classes = "flex items-start gap-3 pl-2"; // Always add left padding
        
        // Add left border highlighting for folders we came up from or files we jumped to
        if (isHighlightedFolder || isHighlightedFile) {
            classes += " border-l-4 border-l-green-400";
        } else {
            classes += " border-l-4 border-l-transparent";
        }
        
        // Keep the green underline in edit mode for all items
        if (gs.docsEditMode) {
            classes += " border-b-2 border-b-green-400";
        }
        else if (gs.docsMetaMode) {
            classes += " border-b border-b-gray-600";
        }

        // if not in edit mode and this is a folder then add more padding at bottom
        if (!gs.docsEditMode && isFolder) {
            classes += " pb-2"; // Add padding at the bottom for folders
        }        
        return classes;
    };

    return (
        <div id={validId} key={validId}>
            <div className={getBorderClass()}>
                {gs.docsEditMode && canMod &&
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
                    {!isFolder && !isBinary && 
                        <div className="mt-3 text-s text-gray-400 flex justify-end items-center">
                            {gs.docsMetaMode && 
                                <>
                                    <span className="mr-4">{node.name}</span>
                                    <span 
                                        className="mr-4 cursor-pointer" 
                                        title={`Timestamps: \n\nCreated: ${formatDateTime(node.createTime)}\n\nModified: ${formatDateTime(node.modifyTime)}`}
                                    >
                                        {new Date(node.modifyTime).toLocaleDateString()}
                                    </span>
                                </>}
                            {gs.docsEditMode && canMod && 
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
                    {isFolder &&
                        <div className="flex items-center justify-between">
                            {gs.docsEditNode === node &&
                                <EditFolder 
                                    gs={gs} 
                                    treeNodes={treeNodes} 
                                    setTreeNodes={setTreeNodes} 
                                    handleFolderNameChange={handleFolderNameChange} 
                                    handleCancelClick={handleCancelClick} 
                                />
                            } 
                            {gs.docsEditNode !== node &&
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

                                        {!DESKTOP_MODE && node.is_public && node.owner_id == gs.userProfile!.userId && (
                                            <FontAwesomeIcon
                                                icon={faShareAlt}
                                                className="text-green-400 ml-2 h-5 w-5"
                                                title="This folder is shared publicly"
                                            />
                                        )}
                                    </div>
                                    {gs.docsEditMode && 
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
                                className="border border-gray-600 max-w-full h-auto rounded-lg shadow-lg pt-4 pb-4"
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
                    
                    {textFile && (gs.docsEditNode === node ? 
                        <EditFile 
                            gs={gs} 
                            reRenderTree={reRenderTree}
                            treeNodes={treeNodes} 
                            setTreeNodes={setTreeNodes} 
                            handleCancelClick={handleCancelClick} 
                            contentTextareaRef={contentTextareaRef} 
                        />
                        : gs.docsNamesMode ?
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
                                {!DESKTOP_MODE && node.is_public && node.owner_id == gs.userProfile!.userId && (
                                    <FontAwesomeIcon
                                        icon={faShareAlt}
                                        className="text-green-400 h-5 w-5 ml-2"
                                        title="This file is shared publicly"
                                    />
                                )}
                            </div>
                            : 
                            <div className="mb-3 relative">
                                <ColumnMarkdownRenderer content={node.content} docMode={true}/>
                                {!DESKTOP_MODE && node.is_public && node.owner_id == gs.userProfile!.userId && (
                                    <FontAwesomeIcon
                                        icon={faShareAlt}
                                        className="absolute top-0 right-0 text-green-400 h-5 w-5 z-10"
                                        title="This file is shared publicly"
                                    />
                                )}
                            </div>
                    )}

                    {isBinary && 
                        <div className="flex items-center justify-between">
                            <div 
                                className="flex items-center cursor-pointer hover:bg-gray-800/30 rounded-lg transition-colors flex-grow"
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
                            {gs.docsEditMode && canMod &&
                                <EditIcons node={node} index={index} numNodes={numNodes} gs={gs} treeNodes={treeNodes} setTreeNodes={setTreeNodes} reRenderTree={reRenderTree} />
                            }
                        </div>
                    }
                </div>
            </div>
            {gs.docsEditMode && canMod &&
                <InsertItemsRow gs={gs} reRenderTree={reRenderTree} node={node} />
            }
        </div>
    );
}
