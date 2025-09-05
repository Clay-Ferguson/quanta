import { useState, useEffect } from 'react';
import { httpClientUtil } from '../../../../../client/HttpClientUtil';
import { ExtractTags_Response, ScanTags_Response } from '../../../../../common/types/EndpointTypes';
import { useGlobalState } from '../../DocsTypes';
import { alertModal } from '../../../../../client/components/AlertModalComp';

// Module-level cache for tags to persist across component instances
let cachedTags: string[] | null = null;

interface TagSelectorProps {
    onCancel: () => void;
    handleLiveTagAdd: (selectedTags: string[]) => void;
    showAddButton?: boolean;
}

/**
 * Component for selecting hashtags using checkboxes and inserting them into text content
 */
export default function TagSelector({ onCancel, handleLiveTagAdd, showAddButton = false }: TagSelectorProps) {
    const gs = useGlobalState();
    
    // Local state for available tags and loading
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

    // Load tags from server on first mount
    useEffect(() => {
        const loadTags = async () => {
            // Check if we already have cached tags
            if (cachedTags && cachedTags.length > 0) {
                setAvailableTags(cachedTags);
                return;
            }

            if (!gs.docsRootKey) {
                console.warn('No docsRootKey available for loading tags');
                // Fall back to hard-coded tags if no root key
                const fallbackTags = [
                    '#business', '#development', '#education', '#health', '#important',
                    '#javascript', '#meeting', '#personal', '#project', '#react',
                    '#research', '#todo', '#typescript', '#urgent', '#work'
                ].sort();
                setAvailableTags(fallbackTags);
                cachedTags = fallbackTags;
                return;
            }

            setIsLoading(true);
            try {
                const url = `/api/docs/tags/${gs.docsRootKey}`;
                const response: ExtractTags_Response | null = await httpClientUtil.secureHttpPost(url, {});
                
                if (response && response.success && response.tags.length > 0) {
                    setAvailableTags(response.tags);
                    cachedTags = response.tags;
                } else {
                    // Fall back to hard-coded tags if server returns empty
                    const fallbackTags = [
                        '#business', '#development', '#education', '#health', '#important',
                        '#javascript', '#meeting', '#personal', '#project', '#react',
                        '#research', '#todo', '#typescript', '#urgent', '#work'
                    ].sort();
                    setAvailableTags(fallbackTags);
                    cachedTags = fallbackTags;
                }
                
            } catch (error) {
                console.error('Failed to load tags from server:', error);
                // Fall back to hard-coded tags on error
                const fallbackTags = [
                    '#business', '#development', '#education', '#health', '#important',
                    '#javascript', '#meeting', '#personal', '#project', '#react',
                    '#research', '#todo', '#typescript', '#urgent', '#work'
                ].sort();
                setAvailableTags(fallbackTags);
                cachedTags = fallbackTags;
            } finally {
                setIsLoading(false);
            }
        };

        loadTags();
    }, [gs.docsRootKey]);

    const handleTagToggle = (tag: string) => {
        const newSelectedTags = new Set(selectedTags);
        if (newSelectedTags.has(tag)) {
            newSelectedTags.delete(tag);
        } else {
            newSelectedTags.add(tag);
        }
        setSelectedTags(newSelectedTags);
        handleLiveTagAdd(Array.from(newSelectedTags).sort());
    };

    const handleAddClick = () => {
        const tagsArray = Array.from(selectedTags).sort();
        handleLiveTagAdd(tagsArray);
        setSelectedTags(new Set()); // Clear selection after adding
    };

    const handleScanClick = async () => {
        if (!gs.docsRootKey) {
            await alertModal('No document root available for scanning.');
            return;
        }

        setIsScanning(true);
        try {
            const url = `/api/docs/tags/scan/${gs.docsRootKey}`;
            const response: ScanTags_Response | null = await httpClientUtil.secureHttpPost(url, {});
            
            if (response && response.success) {
                // Clear the cache so tags will be reloaded
                cachedTags = null;
                
                // Reload tags to get the updated list
                const tagsUrl = `/api/docs/tags/${gs.docsRootKey}`;
                const tagsResponse: ExtractTags_Response | null = await httpClientUtil.secureHttpPost(tagsUrl, {});
                
                if (tagsResponse && tagsResponse.success) {
                    setAvailableTags(tagsResponse.tags);
                    cachedTags = tagsResponse.tags;
                }
                
                await alertModal(response.message);
            } else {
                await alertModal(response?.message || 'Scan failed');
            }
            
        } catch (error) {
            console.error('Failed to scan tags:', error);
            await alertModal('Failed to scan tags. Please try again.');
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 pt-2 pb-4 mt-3 mb-4">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-gray-200 text-lg font-semibold">Select Tags</h3>
                <div className="flex gap-2">
                    <button
                        onClick={handleScanClick}
                        disabled={isScanning || isLoading}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        title="Scan all files and update tags"
                    >
                        {isScanning ? 'Scanning...' : 'Scan'}
                    </button>
                    <button
                        onClick={onCancel}
                        className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                </div>
            </div>
            
            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span className="text-gray-400">Loading tags...</span>
                </div>
            ) : (
                <>
                    {/* Tags grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4">
                        {availableTags.map((tag) => (
                            <label key={tag} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-2 rounded">
                                <input
                                    type="checkbox"
                                    checked={selectedTags.has(tag)}
                                    onChange={() => handleTagToggle(tag)}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <span className="text-gray-300 text-sm">{tag}</span>
                            </label>
                        ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-2">
                        {showAddButton && (
                            <button
                                onClick={handleAddClick}
                                disabled={selectedTags.size === 0}
                                className={`${selectedTags.size === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed py-2 px-4 rounded h-10' : 'btn-primary'}`}
                            >
                                Add ({selectedTags.size})
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
