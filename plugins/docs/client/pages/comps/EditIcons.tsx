import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrash, faArrowUp, faArrowDown, faPaste } from '@fortawesome/free-solid-svg-icons';
import { TreeNode } from '../../../../../common/types/CommonTypes';
import { DocsGlobalState } from '../../DocsTypes';
import { isTextFile, isImageFile } from '../../../../../common/CommonUtils';
import { handleEditClick, handleDeleteClick, handleMoveUpClick, handleMoveDownClick, onPasteIntoFolder } from '../TreeViewerPageOps';

interface EditIconsProps {
    node: TreeNode;
    index: number;
    numNodes: number;
    gs: DocsGlobalState;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    reRenderTree: () => Promise<TreeNode[]>;
    showEditButton?: boolean;
    containerClass?: string;
}

/**
 * Component for rendering edit icons (Edit, Delete, Move Up, Move Down, Paste Into Folder)
 */
export default function EditIcons({ node, index, numNodes, gs, treeNodes, setTreeNodes, reRenderTree, showEditButton = true, containerClass = "flex items-center gap-2 ml-4" }: EditIconsProps) {
    const isImage = isImageFile(node.name);
    const isFolder = node.is_directory;
    const isBinary = !isImage && !isFolder && !isTextFile(node.name);
    const hasCutItems = gs.docsCutItems && gs.docsCutItems.size > 0;
    const editingNow: boolean = !!gs.docsEditNode;

    return (
        <div className={containerClass}>
            {!hasCutItems && !editingNow && showEditButton && !isImage && !isBinary && 
                <button 
                    onClick={(e) => { e.stopPropagation(); handleEditClick(node); }}
                    className="text-gray-400 hover:text-blue-400 transition-colors p-0 border-0 bg-transparent"
                    title="Edit"
                >
                    <FontAwesomeIcon icon={faEdit} className="h-5 w-5" />
                </button>}

            {!hasCutItems && !editingNow && !isBinary &&
            <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteClick(gs, treeNodes, setTreeNodes, node, index); }}
                className="text-gray-400 hover:text-red-400 transition-colors p-0 border-0 bg-transparent"
                title="Delete"
            >
                <FontAwesomeIcon icon={faTrash} className="h-5 w-5" />
            </button>}

            {!hasCutItems && !editingNow && index > 0 &&
                <button 
                    onClick={(e) => { e.stopPropagation(); handleMoveUpClick(gs, treeNodes, setTreeNodes, node); }}
                    className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                    title="Move Up"
                >
                    <FontAwesomeIcon icon={faArrowUp} className="h-5 w-5" />
                </button>}

            {!hasCutItems && !editingNow && index < numNodes - 1 &&
                <button 
                    onClick={(e) => { e.stopPropagation(); handleMoveDownClick(gs, treeNodes, setTreeNodes, node); }}
                    className="text-gray-400 hover:text-green-400 transition-colors p-0 border-0 bg-transparent"
                    title="Move Down"
                >
                    <FontAwesomeIcon icon={faArrowDown} className="h-5 w-5" />
                </button>}

            {isFolder && !editingNow && hasCutItems &&
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
