import { useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFolder, faUpload, faFileUpload, faMicrophone, faPaste } from '@fortawesome/free-solid-svg-icons';
import { TreeNode } from '../../../../../common/types/CommonTypes';
import { DocsGlobalState } from '../../DocsTypes';
import { insertFile, insertFolder, insertFileWithSpeech, onPaste, handleMasterCheckboxChange, getMasterCheckboxState, uploadAttachment, uploadFromClipboard } from '../TreeViewerPageOps';

interface InsertItemsRowProps {
    gs: DocsGlobalState;
    reRenderTree: () => Promise<TreeNode[]>;
    node?: TreeNode | null;
    filteredTreeNodes?: TreeNode[];
}

/**
 * Component for rendering insert file/folder buttons
 */
export default function InsertItemsRow({ gs, reRenderTree, node = null, filteredTreeNodes = [] }: InsertItemsRowProps) {
    const showMasterCheckbox = node === null && filteredTreeNodes.length > 0;
    const { checked, indeterminate } = showMasterCheckbox ? getMasterCheckboxState(gs, filteredTreeNodes) : { checked: false, indeterminate: false };
    const hasCutItems = gs.docsCutItems && gs.docsCutItems.size > 0;

    // Create a unique file input ref for this component instance
    const localFileInputRef = useRef<HTMLInputElement | null>(null);
    
    const handleFileSelect = () => {
        if (localFileInputRef?.current) {
            localFileInputRef.current.click();
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            await uploadAttachment(gs, reRenderTree, node, filesArray);
            
            // Reset the file input
            if (localFileInputRef?.current) {
                localFileInputRef.current.value = '';
            }
        }
    };
    
    return (
        <div className={`relative flex justify-center`}>
            {/* Master checkbox - positioned absolutely to the left */}
            {!hasCutItems && showMasterCheckbox && (
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
                    {gs.docsSelItems && gs.docsSelItems.size > 0 && (
                        <span className="text-xs text-gray-400">
                            ({gs.docsSelItems.size} of {filteredTreeNodes.length} selected)
                        </span>
                    )}
                </div>
            )}
            
            {/* Insert buttons - always centered */}
            <div className="flex gap-2">
                {!hasCutItems && 
                    <button 
                        onClick={() => insertFile(gs, reRenderTree, node)}
                        className="text-gray-400 hover:text-green-400 transition-colors p-1 border-0 bg-transparent"
                        title="Insert File"
                    >
                        <FontAwesomeIcon icon={faPlus} className="h-5 w-5" />
                    </button>}
                {!hasCutItems && 
                    <button 
                        onClick={() => insertFolder(gs, reRenderTree, node)}
                        className="text-gray-400 hover:text-blue-400 transition-colors p-1 border-0 bg-transparent"
                        title="Insert Folder"
                    >
                        <FontAwesomeIcon icon={faFolder} className="h-5 w-5" />
                    </button>}
                {!hasCutItems && 
                    <button 
                        onClick={handleFileSelect}
                        className="text-gray-400 hover:text-purple-400 transition-colors p-1 border-0 bg-transparent"
                        title="Upload File(s)"
                    >
                        <FontAwesomeIcon icon={faUpload} className="h-5 w-5" />
                    </button>}
                {!hasCutItems && 
                    <button 
                        onClick={() => uploadFromClipboard(gs, reRenderTree, node)}
                        className="text-gray-400 hover:text-purple-400 transition-colors p-1 border-0 bg-transparent"
                        title="Upload from Clipboard"
                    >
                        <FontAwesomeIcon icon={faFileUpload} className="h-5 w-5" />
                    </button>}
                {!hasCutItems && 
                    <button 
                        onClick={() => insertFileWithSpeech(gs, reRenderTree, node)}
                        className="text-gray-400 hover:text-orange-400 transition-colors p-1 border-0 bg-transparent"
                        title="Create File with Voice Input"
                    >
                        <FontAwesomeIcon icon={faMicrophone} className="h-5 w-5" />
                    </button>}
                {hasCutItems && (
                    <button 
                        onClick={() => onPaste(gs, reRenderTree, node)}
                        className="text-gray-400 hover:text-yellow-400 transition-colors p-1 border-0 bg-transparent"
                        title="Paste Here"
                    >
                        <FontAwesomeIcon icon={faPaste} className="h-5 w-5" />
                    </button>
                )}
            </div>
            
            {/* Hidden file input */}
            <input 
                type="file"
                ref={localFileInputRef}
                style={{ display: 'none' }}
                multiple
                onChange={handleFileUpload} 
            />
        </div>
    );
}
