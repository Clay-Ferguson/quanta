import { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder } from '@fortawesome/free-solid-svg-icons';
import { TreeNode } from '../../../../../common/types/CommonTypes';
import { DocsGlobalState, gd } from '../../DocsTypes';
import { handleRenameClick } from '../TreeViewerPageOps';

declare const DESKTOP_MODE: boolean;

interface EditFolderProps {
    gs: DocsGlobalState;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    handleFolderNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleCancelClick: () => void;
}

/**
 * Component for editing folder name
 */
export default function EditFolder({ 
    gs, 
    treeNodes, 
    setTreeNodes, 
    handleFolderNameChange, 
    handleCancelClick 
}: EditFolderProps) {
    // Cleanup effect to clear edit node when component unmounts
    useEffect(() => {
        return () => {
            // Clear the edit node when component is unmounted (e.g., user navigates away)
            gd({ 
                type: 'clearFolderEditingState', 
                payload: { 
                    docsEditNode: null,
                    docsNewFolderName: null
                }
            });
        };
    }, []); 

    // Handler for Share button
    const handleShareClick = () => {
        // Open sharing dialog with the current folder name
        gd({ 
            type: 'setSharingDialog', 
            payload: { 
                docsShowSharingDialog: true,
            }
        });
    };

    return (
        <div className="flex items-center flex-grow">
            <FontAwesomeIcon 
                icon={faFolder} 
                className="text-blue-400 text-lg mr-3 h-5 w-5" 
            />
            <div className="flex-grow">
                <input
                    type="text"
                    value={gs.docsNewFolderName || ''}
                    onChange={handleFolderNameChange}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg text-gray-200 text-lg font-medium px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter folder name..."
                    autoFocus
                />
                <div className="flex gap-2 mt-2 mb-3">
                    <button
                        onClick={() => handleRenameClick(gs, treeNodes, setTreeNodes)}
                        className="btn-primary"
                    >
                    Rename
                    </button>
                    {!DESKTOP_MODE && 
                        <button
                            onClick={handleShareClick}
                            className="btn-secondary"
                        >
                        Share
                        </button>}
                    <button
                        onClick={handleCancelClick}
                        className="btn-secondary"
                    >
                    Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
