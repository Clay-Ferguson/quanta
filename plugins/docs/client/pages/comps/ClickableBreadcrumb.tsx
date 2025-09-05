import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShareAlt, faLink } from '@fortawesome/free-solid-svg-icons';
import { TreeNode } from '../../../../../common/types/CommonTypes';
import { DocsGlobalState, gd } from '../../DocsTypes';
import { createClickablePathComponents } from '../../../../../common/CommonUtils';
import { alertModal } from '../../../../../client/components/AlertModalComp';

declare const DESKTOP_MODE: boolean;

interface ClickableBreadcrumbProps {
    gs: DocsGlobalState;
    rootNode: TreeNode | null;
}

/**
 * Component for rendering clickable folder path breadcrumbs
 */
export default function ClickableBreadcrumb({ gs, rootNode }: ClickableBreadcrumbProps) {
    if (!gs.docsFolder || gs.docsFolder.length <= 1) {
        return null;
    }

    const pathComponents = createClickablePathComponents(gs.docsFolder);
    
    const handlePathClick = (navigationPath: string) => {
        // Clear selections and highlighted folder when navigating via breadcrumb
        gd({ type: 'setTreeFolder', payload: { 
            docsFolder: navigationPath,
            docsSelItems: new Set<TreeNode>(),
            docsHighlightedFolderName: null,
            docsHighlightedFileName: null
        }});
    };

    return (
        <div className="text-center mb-3">
            <div className="flex justify-center items-center">
                <div className="inline-flex items-center text-blue-300 text-2xl font-medium">
                    {pathComponents.map((component, index) => (
                        <span key={index} className="flex items-center">
                            {index > 0 && <span className="text-gray-500">/</span>}
                            <button
                                onClick={() => handlePathClick(component.navigationPath)}
                                className="text-blue-300 hover:text-blue-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded px-1 py-1"
                                title={`Go to ${component.displayName}`}
                            >
                                {component.displayName}
                            </button>
                        </span>
                    ))}
                    {!DESKTOP_MODE && rootNode?.is_public && rootNode.owner_id==gs.userProfile!.userId && (
                        <FontAwesomeIcon
                            icon={faShareAlt}
                            className="text-green-400 h-5 w-5 ml-2"
                            title="This folder is shared publicly"
                        />)}
                    {!DESKTOP_MODE && 
                        <FontAwesomeIcon
                            icon={faLink}
                            className="text-white h-5 w-5 cursor-pointer ml-2 hover:text-gray-300 transition-colors"
                            title="Copy URL to clipboard"
                            onClick={() => {
                                let folder = gs.docsFolder; 
                                if (folder?.indexOf('/') === 0) {
                                    folder = folder.substring(1); // Remove leading slash if present
                                }

                                // DO NOT DELETE: This was the old URL format that used folder names (works just fine but we use UUID instead)
                                // const currentUrl = `/doc/${gs.docsRootKey}/${folder || '/'}`;
                                const currentUrl = `/doc/${gs.docsRootKey}/id/${rootNode!.uuid}`;
                                navigator.clipboard.writeText(window.location.origin + currentUrl).then(() => {
                                    alertModal(`URL copied to clipboard: ${window.location.origin + currentUrl}`);
                                }).catch(err => {
                                    console.error('Failed to copy URL to clipboard:', err);
                                });
                            }}
                        />}
                </div>
            </div>
        </div>
    );
}
