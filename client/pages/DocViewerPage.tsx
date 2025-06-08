import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Markdown from "../components/MarkdownComp";
import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import { scrollEffects } from '../ScrollEffects';
import { util } from '../Util';

// Cache for the documents content, using a Map to support multiple documents
const documentCache: Map<string, string> = new Map();

interface DocViewerPageProps {
    filename?: string;
    title?: string;
}

/**
 * Page for displaying a document viewer. So far only used for displaying static markdown files, and specifically the user guide.
 * 
 * NOTE: This was our original way of showing the user guide, but it has been replaced by the new `TreeViewPage` component,
 * which is a more advanced document viewer, but let's keep this component in case we ever need it for simpler documents.
 */
export default function DocViewerPage({ 
    filename = '',
    title = 'Document Viewer' 
}: DocViewerPageProps) {
    const [docContent, setDocContent] = useState<string | null>(documentCache.get(filename) || null);
    const [isLoading, setIsLoading] = useState<boolean>(!documentCache.has(filename));

    // get the path part from filename, and store in string named `docPath`
    const basePath = filename.split('/').slice(0, -1).join('/');
    console.log(`Base path for document: ${basePath}`);

    useEffect(() => util.resizeEffect(), []);

    useEffect(() => {
        // If we already have cached content for this file, no need to fetch
        if (documentCache.has(filename)) {
            setDocContent(documentCache.get(filename) || null);
            setIsLoading(false);
            return;
        }

        const fetchDoc = async () => {
            setIsLoading(true);
            try {
                // Fetch the markdown file from the server
                const response = await fetch(filename);
                
                if (!response.ok) {
                    throw new Error(`Failed to load document: ${response.status}`);
                }
                
                const content = await response.text();
                //console.log('Document loaded: ${content}');
                
                // Update the cache and state
                documentCache.set(filename, content);
                setDocContent(content);
            } catch (error) {
                console.error('Error loading doc:', error);
                // Set a fallback message in case of error
                setDocContent(`## Error\n\nSorry, we encountered an error loading the document "${filename}". Please try again later.`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDoc();
    }, [filename]);

    const elmRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => scrollEffects.layoutEffect(elmRef, false), [docContent]);
    useEffect(() => scrollEffects.effect(elmRef), []);

    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText={title}/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>
            <div id="docContent" ref={elmRef}  className="flex-grow overflow-y-auto p-4 bg-gray-900 flex justify-center">
                <div className="max-w-2xl w-full">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-4 text-blue-300">Loading document...</p>
                        </div>
                    ) : (
                        <Markdown basePath={basePath} markdownContent={docContent || ''} />
                    )}
                    <div className="h-20"></div> {/* Empty div for bottom spacing */}
                </div>
            </div>
        </div>
    );
}
