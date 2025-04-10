import { useGlobalState, useGlobalDispatch } from '../GlobalState';
import { useEffect, useState } from 'react';
import Markdown from "./MarkdownComp";

// Cache for the user guide content
let cachedUserGuide: string | null = null;

const UserGuidePage: React.FC = () => {
    const gs = useGlobalState();
    const gd = useGlobalDispatch();
    const [guideContent, setGuideContent] = useState<string | null>(cachedUserGuide);
    const [isLoading, setIsLoading] = useState<boolean>(cachedUserGuide === null);

    // todo-0: we need a global (on app object?) method to set the page, which just takes the arg string of page name.
    // todo-0: also this back button needs to be somehow at the top of all pages that aren't the main page.
    const back = () => {
        gs.page = 'QuantaChat'; 
        gd({ type: 'setPage', payload: gs });
    };

    useEffect(() => {
        // If we already have cached content, no need to fetch
        if (cachedUserGuide !== null) {
            return;
        }

        const fetchUserGuide = async () => {
            setIsLoading(true);
            try {
                // Fetch the user guide markdown file from the server
                const response = await fetch('/user-guide.md');
                
                if (!response.ok) {
                    throw new Error(`Failed to load user guide: ${response.status}`);
                }
                
                const content = await response.text();
                
                // Update the cache and state
                cachedUserGuide = content;
                setGuideContent(content);
            } catch (error) {
                console.error('Error loading user guide:', error);
                // Set a fallback message in case of error
                setGuideContent('## Error\n\nSorry, we encountered an error loading the user guide. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserGuide();
    }, []);

    return (
        <div className="h-screen flex flex-col w-screen min-w-full bg-gray-900 text-gray-200 border border-blue-400/30">
            <header className="w-full bg-gray-800 text-gray-100 p-4 flex-shrink-0 flex justify-between items-center shadow-md border-b border-blue-400/30">
                <div id="settingsLogo" className="flex-1 flex items-center">
                    <div className="mr-3">
                        <img 
                            src="/logo-100px-tr.jpg" 
                            alt="Quanta Chat Logo" 
                            className="h-auto object-contain border border-blue-400/30 rounded"
                        />
                    </div>
                    <div className="overflow-hidden">
                        <h2 className="font-semibold text-blue-400">Quanta Chat</h2>
                        <h4 className="font-semibold text-gray-300 truncate">User Guide</h4>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <button className="btn-primary" onClick={back}>Back</button>
                </div>
            </header>
            <div id="userGuideContent" className="flex-grow overflow-y-auto p-4 bg-gray-900 flex justify-center">
                <div className="max-w-2xl w-full">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-4 text-blue-300">Loading user guide...</p>
                        </div>
                    ) : (
                        <Markdown markdownContent={guideContent || ''} />
                    )}
                    <div className="h-20"></div> {/* Empty div for bottom spacing */}
                </div>
            </div>
        </div>
    );
};

export default UserGuidePage;
