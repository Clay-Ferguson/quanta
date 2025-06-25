import { alertModal } from '../../components/AlertModalComp';
import { httpClientUtil } from '../../HttpClientUtil';
import { useGlobalState, gd } from './DocsTypes';

interface SharingDialogProps {
    title?: string;
}

/**
 * Sharing options dialog component
 */
export default function SharingDialog({ 
    title = "Sharing Options", 
}: SharingDialogProps) {
    const gs = useGlobalState();
    const onShare = async () => { 
        const requestBody = {
            is_public: true,
            treeFolder: gs.docsFolder || '/',
            filename: gs.docsEditNode?.name,
            docRootKey: gs.docsRootKey,
            recursive: true
        }; 

        // Close dialog
        gd({ 
            type: 'setSharingDialog', 
            payload: { 
                docsShowSharingDialog: false,
            }
        });

        const response = await httpClientUtil.secureHttpPost('/api/docs/set-public/', requestBody);
        if (!response) {
            await alertModal("Unable to share to public. Please try again later.");
        }
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
            <div className="bg-gray-800 text-white rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-700">
                <h3 className="text-xl font-bold mb-4">{title}</h3>
                
                {gs.docsEditNode?.name && (
                    <p className="mb-4 text-gray-300">
                        Folder: <span className="font-medium">{gs.docsEditNode?.name}</span>
                    </p>
                )}

                <p className="mb-6 text-gray-300">
                    Select sharing options for this folder:
                </p>
                
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onShare}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                        Share to Public
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
