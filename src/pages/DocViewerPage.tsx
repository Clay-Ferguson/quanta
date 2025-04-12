import { useEffect, useState } from 'react';
import Markdown from "../components/MarkdownComp";
import {app} from '../AppService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import LogoBlockComp from '../components/LogoBlockComp';
import { PageNames } from '../AppServiceTypes';

// Cache for the documents content, using a Map to support multiple documents
const documentCache: Map<string, string> = new Map();

interface DocViewerPageProps {
    filename?: string;
    title?: string;
}

const DocViewerPage: React.FC<DocViewerPageProps> = ({ 
    filename = '/user-guide.md',
    title = 'Document Viewer' 
}) => {
    const [docContent, setDocContent] = useState<string | null>(documentCache.get(filename) || null);
    const [isLoading, setIsLoading] = useState<boolean>(!documentCache.has(filename));

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

    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText={title}/>
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => app.goToPage(PageNames.quantaChat)}
                        className="p-2 text-blue-300 hover:bg-blue-600/30 rounded-md flex items-center justify-center"
                        title="Back"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-5 w-5" />
                    </button>
                </div>
            </header>
            <div id="docContent" className="flex-grow overflow-y-auto p-4 bg-gray-900 flex justify-center">
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
};

export default DocViewerPage;
