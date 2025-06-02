import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import { useEffect, useState } from 'react';
import { util } from '../Util';
import { httpClientUtil } from '../HttpClientUtil';
import { alertModal } from '../components/AlertModalComp';

/**
 * SearchViewPage component for searching and displaying search results
 */
export default function SearchViewPage() {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isSearching, setIsSearching] = useState<boolean>(false);
    
    useEffect(() => {
        util.resizeEffect();
    }, []);
    
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            await alertModal('Please enter a search query');
            return;
        }
        
        setIsSearching(true);
        try {
            const response = await httpClientUtil.secureHttpPost('/api/docs/search', {
                query: searchQuery.trim()
            });
            
            if (response) {
                console.log('Search response:', response);
                await alertModal('Search completed successfully');
            }
        } catch (error) {
            console.error('Search failed:', error);
            await alertModal('Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !isSearching) {
            handleSearch();
        }
    };
    
    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Search"/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>

            <div className="flex flex-col p-4 bg-gray-900 h-full">
                <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-2">
                        Search through documents and content
                    </div>
                    
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter your search query..."
                            className="flex-grow px-3 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                            disabled={isSearching}
                        />
                        
                        <button 
                            onClick={handleSearch}
                            disabled={isSearching || !searchQuery.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </div>
                
                <div className="flex-grow relative">
                    <div className="absolute inset-0 w-full h-full bg-gray-800 text-gray-300 p-3 border border-gray-700 rounded">
                        <div className="text-center text-gray-500">
                            Search results will appear here
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
