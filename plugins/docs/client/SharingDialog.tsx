import { alertModal } from '../../../client/components/AlertModalComp';
import { httpClientUtil } from '../../../client/HttpClientUtil';
import { useGlobalState, gd } from './DocsTypes';
import { useState } from 'react';

interface SharingDialogProps {
    title?: string;
    reRenderTree: () => void; // Callback to re-render the tree after sharing action   
}

/**
 * Sharing options dialog component
 */
export default function SharingDialog({ 
    title = "Sharing Options", 
    reRenderTree
}: SharingDialogProps) {
    const gs = useGlobalState();
    const [recursive, setRecursive] = useState(true);
    
    const onShare = async (is_public: boolean) => { 
        const requestBody = {
            is_public,
            treeFolder: gs.docsFolder || '/',
            filename: gs.docsEditNode?.name,
            docRootKey: gs.docsRootKey,
            recursive
        }; 

        // Close dialog
        await gd({ 
            type: 'setSharingDialog', 
            payload: { 
                docsShowSharingDialog: false,
                docsEditNode: null,
            }
        });

        const response = await httpClientUtil.secureHttpPost('/api/docs/set-public/', requestBody);
        if (!response) {
            await alertModal("Unable to share to public. Please try again later.");
        }

        reRenderTree();
    }
    const onCancel = () => {
        // Close dialog without action
        gd({ 
            type: 'setSharingDialog', 
            payload: { 
                docsShowSharingDialog: false,
            }
        });
    }
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 text-white rounded-lg shadow-xl p-6 max-w-2xl w-full border border-gray-700">
                <h3 className="text-xl font-bold mb-4">{title}</h3>
                
                {gs.docsEditNode?.name && (
                    <p className="mb-4 text-gray-300">
                        Folder: <span className="font-medium">{gs.docsEditNode?.name}</span>
                    </p>
                )}
                
                <div className="mb-4 flex items-center">
                    <input
                        type="checkbox"
                        id="recursive-checkbox"
                        checked={recursive}
                        onChange={(e) => setRecursive(e.target.checked)}
                        className="mr-2 h-4 w-4"
                    />
                    <label htmlFor="recursive-checkbox" className="text-gray-300">
                        Recursive (include all subfolders and files)
                    </label>
                </div>
                
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => onShare(true)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                        Share to Public
                    </button>
                    <button
                        onClick={() => onShare(false)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                        Remove Sharing
                    </button>
                    <button
                        onClick={onCancel}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
