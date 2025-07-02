import LogoBlockComp from '../../../components/LogoBlockComp';
import BackButtonComp from '../../../components/BackButtonComp';
import { useEffect, useState, useRef } from 'react';
import { util } from '../../../Util';
import { httpClientUtil } from '../../../HttpClientUtil';
import { alertModal } from '../../../components/AlertModalComp';
import { useGlobalState, gd, DocsPageNames } from '../DocsTypes';
import { app } from '../../../AppService';
import { formatFullPath } from '../../../../common/CommonUtils';
import { idb } from '../../../IndexedDB';
import { DBKeys } from '../../../AppServiceTypes';

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
            <div className={`font-medium ${isFolder ? 'text-blue-400' : 'text-gray-200'}`}>
                {formatFullPath(filePath)}
            </div>
            
            {/* {fileName != filePath && <div className="text-xs text-gray-500 mb-2">
                {filePath}
            </div>} */}
            
            {fileResults.length > 0 && fileResults[0].line >= 0 && (
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
        // todo-1: implement VFS binary search ? some day.
        if (gs.docsRootType === 'vfs' && !gs.docsSearchTextOnly) {
            await alertModal('Binary search is not supported for VFS. Please enable "Text Only" search mode.');
            return;
        }

        setIsSearching(true);
        const search = gs.docsSearch?.trim();
        try {
            const searchFolder = gs.docsFolder || '/';
            const endpoint = gs.docsRootType === 'vfs' ? '/api/docs/search-vfs' : 
                (gs.docsSearchTextOnly ? '/api/docs/search-text' : '/api/docs/search-binaries');

            const response = await httpClientUtil.secureHttpPost(endpoint, {
                query: search,
                treeFolder: searchFolder,
                docRootKey: gs.docsRootKey,
                searchMode: gs.docsSearchMode || 'MATCH_ANY',
                requireDate: gs.docsRequireDate || false,
                searchOrder: gs.docsSearchOrder || 'MOD_TIME'
            }) as any;
            
            if (response && response.success) {
                // pretty print the search results using formatted JSON
                console.log('Search results:', JSON.stringify(response.results, null, 2));
                gd({ type: 'setSearchResults', payload: { 
                    docsSearchResults: response.results || [],
                    docsSearchOriginFolder: searchFolder,
                    docsLastSearch: search
                }});
            } else {
                await alertModal('Search failed. No results found.');
                gd({ type: 'setSearchResults', payload: { 
                    docsSearchResults: [],
                    docsSearchOriginFolder: searchFolder,
                    docsLastSearch: search
                }});
            }
        } catch (error) {
            console.error('Search failed:', error);
            await alertModal('Search failed. Please try again.');
            const searchFolder = gs.docsFolder || '/';
            gd({ type: 'setSearchResults', payload: { 
                docsSearchResults: [],
                docsSearchOriginFolder: searchFolder,
                docsLastSearch: search
            }});
        } finally {
            setIsSearching(false);
        }
    };
    
    const fileClicked = (filePath: string) => { 
        // Parse the file path to extract the folder path and filename
        // Note: filePath is relative to the searchOriginFolder where the search was performed
        const lastSlashIndex = filePath.lastIndexOf('/');
        let searchRootFolder = gs.docsSearchOriginFolder || '/';
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
                docsFolder: targetFolderPath,
                docsSelItems: new Set(),
                docsHighlightedFolderName: null,
                docsHighlightedFileName: fileName
            }});
        } else if (lastSlashIndex === 0) {
            // File is in root folder (relative to search root)
            fileName = filePath.substring(1);
                        
            // Set the tree folder in global state and clear selections
            gd({ type: 'setTreeFolder', payload: { 
                docsFolder: searchRootFolder,
                docsSelItems: new Set(),
                docsHighlightedFolderName: null,
                docsHighlightedFileName: fileName
            }});
        } else {
            // No slash found - file is directly in the search root folder
            fileName = filePath;
                        
            // Set the tree folder in global state and clear selections
            gd({ type: 'setTreeFolder', payload: { 
                docsFolder: searchRootFolder,
                docsSelItems: new Set(),
                docsHighlightedFolderName: null,
                docsHighlightedFileName: fileName
            }});
        }
        
        // Navigate to the TreeViewer page
        app.goToPage(DocsPageNames.treeViewer);
        
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
        }, 1000);
    };
    
    // Group results by file to show only one instance per file
    const groupedResults = (gs.docsSearchResults || []).reduce((acc: Record<string, SearchResult[]>, result: SearchResult) => {
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
                <LogoBlockComp subText={`Search in ${gs.docsFolder}`}/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>

            <div className="flex flex-col p-4 bg-gray-900 h-full">
                <div className="mb-4">
                    <div className="flex gap-2 items-center">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={gs.docsSearch || ''}
                            onChange={(e) => gd({ type: 'setSearchQuery', payload: { docsSearch: e.target.value }})}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter your search query..."
                            className="flex-grow px-3 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                            disabled={isSearching}
                        />
                        
                        {/* Search Mode Radio Buttons */}
                        <div className="flex gap-3 text-sm px-3 py-2 border border-gray-600 rounded-md bg-gray-800">
                            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="searchMode"
                                    value="REGEX"
                                    checked={gs.docsSearchMode === 'REGEX'}
                                    onChange={(e) => gd({ type: 'setSearchMode', payload: { docsSearchMode: (e.target.value || "MATCH_ANY") as 'REGEX' | 'MATCH_ANY' | 'MATCH_ALL' }})}
                                    className="text-blue-600 focus:ring-blue-500"
                                    disabled={isSearching}
                                />
                                <span>REGEX</span>
                            </label>
                            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="searchMode"
                                    value="MATCH_ANY"
                                    checked={gs.docsSearchMode === 'MATCH_ANY'}
                                    onChange={(e) => gd({ type: 'setSearchMode', payload: { docsSearchMode: (e.target.value || "MATCH_ANY") as 'REGEX' | 'MATCH_ANY' | 'MATCH_ALL' }})}
                                    className="text-blue-600 focus:ring-blue-500"
                                    disabled={isSearching}
                                />
                                <span>Match Any</span>
                            </label>
                            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="searchMode"
                                    value="MATCH_ALL"
                                    checked={gs.docsSearchMode === 'MATCH_ALL'}
                                    onChange={(e) => gd({ type: 'setSearchMode', payload: { docsSearchMode: (e.target.value || "MATCH_ANY") as 'REGEX' | 'MATCH_ANY' | 'MATCH_ALL' }})}
                                    className="text-blue-600 focus:ring-blue-500"
                                    disabled={isSearching}
                                />
                                <span>Match All</span>
                            </label>
                        </div>
                        
                        {/* Sort Order Radio Buttons */}
                        <div className="flex gap-3 text-sm px-3 py-2 border border-gray-600 rounded-md bg-gray-800">
                            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="searchOrder"
                                    value="MOD_TIME"
                                    checked={gs.docsSearchOrder === 'MOD_TIME'}
                                    onChange={async (e) => {
                                        const value = e.target.value as 'MOD_TIME' | 'DATE';
                                        gd({ type: 'setSearchOrder', payload: { docsSearchOrder: value }});
                                        // Persist to IndexedDB
                                        await idb.setItem(DBKeys.docsSearchOrder, value);
                                    }}
                                    className="text-blue-600 focus:ring-blue-500"
                                    disabled={isSearching}
                                />
                                <span>by Mod Time</span>
                            </label>
                            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="searchOrder"
                                    value="DATE"
                                    checked={gs.docsSearchOrder === 'DATE'}
                                    onChange={async (e) => {
                                        const value = e.target.value as 'MOD_TIME' | 'DATE';
                                        gd({ type: 'setSearchOrder', payload: { docsSearchOrder: value }});
                                        // Persist to IndexedDB
                                        await idb.setItem(DBKeys.docsSearchOrder, value);
                                    }}
                                    className="text-blue-600 focus:ring-blue-500"
                                    disabled={isSearching}
                                />
                                <span>by Text Date</span>
                            </label>
                        </div>
                        
                        {/* Has Dates Checkbox */}
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer ml-3">
                            <input
                                type="checkbox"
                                checked={gs.docsRequireDate || false}
                                onChange={async (e) => {
                                    const checked = e.target.checked;
                                    gd({ type: 'setRequireDate', payload: { docsRequireDate: checked }});
                                    // Persist to IndexedDB
                                    await idb.setItem(DBKeys.docsRequireDate, checked);
                                }}
                                className="text-blue-600 focus:ring-blue-500"
                                disabled={isSearching}
                            />
                            <span>Has Dates</span>
                        </label>
                        
                        {/* Text Only Checkbox */}
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer ml-3">
                            <input
                                type="checkbox"
                                checked={gs.docsSearchTextOnly || false}
                                onChange={async (e) => {
                                    const checked = e.target.checked;
                                    gd({ type: 'setSearchTextOnly', payload: { docsSearchTextOnly: checked }});
                                    // Persist to IndexedDB
                                    await idb.setItem(DBKeys.docsSearchTextOnly, checked);
                                }}
                                className="text-blue-600 focus:ring-blue-500"
                                disabled={isSearching}
                            />
                            <span>Text Only</span>
                        </label>
                        
                        <button 
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed ml-4"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </div>
                
                <div className="flex-grow relative">
                    <div className="absolute inset-0 w-full h-full bg-gray-800 text-gray-300 p-3 border border-gray-700 rounded overflow-auto">
                        {(gs.docsSearchResults || []).length === 0 && !isSearching && !gs.docsLastSearch && (
                            <div className="text-center text-gray-500">
                                Search results will appear here
                            </div>
                        )}
                        
                        {(gs.docsSearchResults || []).length === 0 && !isSearching && gs.docsLastSearch && (
                            <div className="text-center text-gray-500">
                                No results found for "{gs.docsLastSearch}"
                            </div>
                        )}
                        
                        {isSearching && (
                            <div className="text-center text-gray-500">
                                Searching...
                            </div>
                        )}
                        
                        {(gs.docsSearchResults || []).length > 0 && (
                            <div className="space-y-3">
                                <div className="mb-4">
                                    Found {(gs.docsSearchResults || []).length} match{(gs.docsSearchResults || []).length !== 1 ? 'es' : ''} in {uniqueFiles.length} file{uniqueFiles.length !== 1 ? 's' : ''} for [{gs.docsLastSearch}] in {gs.docsSearchOriginFolder || '/'}
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
