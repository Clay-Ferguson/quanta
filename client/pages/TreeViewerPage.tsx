import { useEffect, useRef, useState } from 'react';
import Markdown from "../components/MarkdownComp";
import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import { scrollEffects } from '../ScrollEffects';
import { util } from '../Util';

/**
 * Page for displaying a document viewer. So far only used for displaying static markdown files, and specifically the user guide.
 */
export default function TreeViewerPage() {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const docContent = "# Tree Viewer";
    useEffect(() => util.resizeEffect(), []);

    useEffect(() => {
        const fetchTree = async () => {
            setIsLoading(true);
            try {
                console.log("Loading tree document...");
            } catch (error) {
                console.error('Error loading doc:', error);
                // Set a fallback message in case of error
                // (`## Error\n\nSorry, we encountered an error loading the tree for "${filename}".`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTree();
    }, []);

    const elmRef = useRef<HTMLDivElement>(null);
    // useLayoutEffect(() => scrollEffects.layoutEffect(elmRef, false), [docContent]);
    useEffect(() => scrollEffects.effect(elmRef), []);

    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Document Viewer"/>
                <div className="flex items-center space-x-4">
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
                    ) : (
                        <Markdown markdownContent={docContent || ''} />
                    )}
                    <div className="h-20"></div> {/* Empty div for bottom spacing */}
                </div>
            </div>
        </div>
    );
}
