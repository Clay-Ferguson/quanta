import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import { useEffect, useState, useRef } from 'react';
import { util } from '../Util';
import { httpClientUtil } from '../HttpClientUtil';
import { alertModal } from '../components/AlertModalComp';
import { useGlobalState, gd } from '../GlobalState';
import { app } from '../AppService';
import { PageNames } from '../AppServiceTypes';

interface SearchResult {
    file: string;
    line: number;
    content: string;
}

interface SearchResultItemProps {
    filePath: string;
    fileResults: SearchResult[];
    onFileClick: (filePath: string) => void;
}

/**
 * SearchResultItem component for displaying individual search result items
 */
function SearchResultItem({ filePath, fileResults, onFileClick }: SearchResultItemProps) {
    const fileName = filePath.split('/').pop() || filePath;
    const isFolder = !fileName.includes('.');
    
    return (
        <div 
            className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 cursor-pointer transition-colors"
            onClick={() => onFileClick(filePath)}
        >
            <div className={`font-medium ${isFolder ? 'text-blue-400' : 'text-gray-200'} mb-2`}>
                {filePath}
            </div>
            
            {/* {fileName != filePath && <div className="text-xs text-gray-500 mb-2">
                {filePath}
            </div>} */}
            
            {fileResults.length > 0 && (
                <div className="mt-2 space-y-1">
                    {fileResults.slice(0, 3).map((result: SearchResult, index: number) => (
                        <div key={index} className="text-xs">
                            <div className="font-mono text-gray-300 bg-gray-800 p-1 rounded mt-1 text-xs leading-relaxed">
                                {result.content.trim()}
                            </div>
                        </div>
                    ))}
                    {fileResults.length > 3 && (
                        <div className="text-xs text-gray-500 italic">
                            ... and {fileResults.length - 3} more
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * SearchViewPage component for searching and displaying search results
 */
export default function SearchViewPage() {
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [lastSearchQuery, setLastSearchQuery] = useState<string>('');
    const gs = useGlobalState();
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        util.resizeEffect();
        // Focus the search input when the component mounts
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);
    
    const handleSearch = async () => {
        if (!gs.searchQuery?.trim()) {
            await alertModal('Please enter a search query');
            return;
        }
        
        setIsSearching(true);
        try {
            const searchFolder = gs.treeFolder || '/';
            const response = await httpClientUtil.secureHttpPost('/api/docs/search', {
                query: gs.searchQuery.trim(),
                treeFolder: searchFolder,
                docRootKey: gs.docRootKey,
                searchMode: gs.searchMode || 'MATCH_ANY'
            }) as any;
            
            if (response && response.success) {
                console.log('Search response:', response);
                gd({ type: 'setSearchResults', payload: { 
                    searchResults: response.results || [],
                    searchOriginFolder: searchFolder
                }});
                setLastSearchQuery(gs.searchQuery.trim());
            } else {
                await alertModal('Search failed. No results found.');
                gd({ type: 'setSearchResults', payload: { 
                    searchResults: [],
                    searchOriginFolder: searchFolder
                }});
            }
        } catch (error) {
            console.error('Search failed:', error);
            await alertModal('Search failed. Please try again.');
            const searchFolder = gs.treeFolder || '/';
            gd({ type: 'setSearchResults', payload: { 
                searchResults: [],
                searchOriginFolder: searchFolder
            }});
        } finally {
            setIsSearching(false);
        }
    };
    
    const fileClicked = (filePath: string) => {
        // Parse the file path to extract the folder path and filename
        // Note: filePath is relative to the searchOriginFolder where the search was performed
        const lastSlashIndex = filePath.lastIndexOf('/');
        let searchRootFolder = gs.searchOriginFolder || '/';
        let fileName = filePath;
                
        if (lastSlashIndex > 0) {
            // File is in a subfolder relative to the search root
            const relativeFolderPath = filePath.substring(0, lastSlashIndex);
            fileName = filePath.substring(lastSlashIndex + 1);
            
            // Construct the absolute folder path by combining search root with relative path
            // Follow the same pattern as handleFolderClick in TreeViewerPageOps
            if (searchRootFolder === '/') {
                searchRootFolder = ''; // Convert root to empty string for proper joining
            }
            const targetFolderPath = `${searchRootFolder}/${relativeFolderPath}`;
                        
            // Set the tree folder in global state and clear selections
            gd({ type: 'setTreeFolder', payload: { 
                treeFolder: targetFolderPath,
                selectedTreeItems: new Set()
            }});
        } else if (lastSlashIndex === 0) {
            // File is in root folder (relative to search root)
            fileName = filePath.substring(1);
                        
            // Set the tree folder in global state and clear selections
            gd({ type: 'setTreeFolder', payload: { 
                treeFolder: searchRootFolder,
                selectedTreeItems: new Set()
            }});
        } else {
            // No slash found - file is directly in the search root folder
            fileName = filePath;
                        
            // Set the tree folder in global state and clear selections
            gd({ type: 'setTreeFolder', payload: { 
                treeFolder: searchRootFolder,
                selectedTreeItems: new Set()
            }});
        }
        
        // Navigate to the TreeViewer page
        app.goToPage(PageNames.treeViewer);
        
        // Optional: Scroll to the specific file after a short delay to ensure the page has loaded
        // This uses the same scrolling mechanism as the TreeViewerPageOps
        setTimeout(() => {
            // Create a valid HTML ID from the filename (similar to createValidId in TreeViewerPageOps)
            const validId = 'tree-' + fileName.replace(/[^a-zA-Z0-9_-]/g, '-');
            const element = document.getElementById(validId);
            if (element) {
                element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
            }
        }, 500);
    };
    
    // Group results by file to show only one instance per file
    const groupedResults = (gs.searchResults || []).reduce((acc: Record<string, SearchResult[]>, result: SearchResult) => {
        if (!acc[result.file]) {
            acc[result.file] = [];
        }
        acc[result.file].push(result);
        return acc;
    }, {} as Record<string, SearchResult[]>);
    
    const uniqueFiles = Object.keys(groupedResults);
    
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !isSearching) {
            handleSearch();
        }
    };
    
    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText={`Search in ${gs.treeFolder}`}/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>

            <div className="flex flex-col p-4 bg-gray-900 h-full">
                <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-2">
                        Search through documents and content
                    </div>
                    
                    <div className="flex gap-2 items-center">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={gs.searchQuery || ''}
                            onChange={(e) => gd({ type: 'setSearchQuery', payload: { searchQuery: e.target.value }})}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter your search query..."
                            className="flex-grow px-3 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                            disabled={isSearching}
                        />
                        
                        {/* Search Mode Radio Buttons */}
                        <div className="flex gap-3 text-sm">
                            <label className="flex items-center gap-1 text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="searchMode"
                                    value="REGEX"
                                    checked={gs.searchMode === 'REGEX'}
                                    onChange={(e) => gd({ type: 'setSearchMode', payload: { searchMode: e.target.value }})}
                                    className="text-blue-600 focus:ring-blue-500"
                                    disabled={isSearching}
                                />
                                <span>REGEX</span>
                            </label>
                            <label className="flex items-center gap-1 text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="searchMode"
                                    value="MATCH_ANY"
                                    checked={gs.searchMode === 'MATCH_ANY'}
                                    onChange={(e) => gd({ type: 'setSearchMode', payload: { searchMode: e.target.value }})}
                                    className="text-blue-600 focus:ring-blue-500"
                                    disabled={isSearching}
                                />
                                <span>Match Any</span>
                            </label>
                            <label className="flex items-center gap-1 text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="searchMode"
                                    value="MATCH_ALL"
                                    checked={gs.searchMode === 'MATCH_ALL'}
                                    onChange={(e) => gd({ type: 'setSearchMode', payload: { searchMode: e.target.value }})}
                                    className="text-blue-600 focus:ring-blue-500"
                                    disabled={isSearching}
                                />
                                <span>Match All</span>
                            </label>
                        </div>
                        
                        <button 
                            onClick={handleSearch}
                            disabled={isSearching || !gs.searchQuery?.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </div>
                
                <div className="flex-grow relative">
                    <div className="absolute inset-0 w-full h-full bg-gray-800 text-gray-300 p-3 border border-gray-700 rounded overflow-auto">
                        {(gs.searchResults || []).length === 0 && !isSearching && !lastSearchQuery && (
                            <div className="text-center text-gray-500">
                                Search results will appear here
                            </div>
                        )}
                        
                        {(gs.searchResults || []).length === 0 && !isSearching && lastSearchQuery && (
                            <div className="text-center text-gray-500">
                                No results found for "{lastSearchQuery}"
                            </div>
                        )}
                        
                        {isSearching && (
                            <div className="text-center text-gray-500">
                                Searching...
                            </div>
                        )}
                        
                        {(gs.searchResults || []).length > 0 && (
                            <div className="space-y-3">
                                <div className="mb-4">
                                    Found {(gs.searchResults || []).length} match{(gs.searchResults || []).length !== 1 ? 'es' : ''} in {uniqueFiles.length} file{uniqueFiles.length !== 1 ? 's' : ''} for [{lastSearchQuery}] in {gs.searchOriginFolder || '/'}
                                </div>
                                
                                {uniqueFiles.map((filePath) => (
                                    <SearchResultItem
                                        key={filePath}
                                        filePath={filePath}
                                        fileResults={groupedResults[filePath]}
                                        onFileClick={fileClicked}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
