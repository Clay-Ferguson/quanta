import { useState, useEffect } from 'react';
import { httpClientUtil } from '@client/HttpClientUtil';
import { alertModal } from '@client/components/AlertModalComp';
import { ExtractTags_ReqInfo, ExtractTags_ResInfo, TagCategory, ScanTags_ReqInfo, ScanTags_ResInfo } from '../../../common/CommonTypes';

// Module-level cache for categories to persist across component instances
let cachedCategories: TagCategory[] | null = null;

interface TagSelectorProps {
    onCancel: () => void;
    handleLiveTagAdd: (selectedTags: string[]) => void;
    showAddButton?: boolean;
}

/**
 * Component for selecting hashtags using checkboxes and inserting them into text content
 */
export default function TagSelector({ onCancel, handleLiveTagAdd, showAddButton = false }: TagSelectorProps) {
    
    // Local state for available categories and loading
    const [tagCategories, setTagCategories] = useState<TagCategory[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

    // Load tags from server on first mount
    useEffect(() => {
        const loadTags = async () => {
            // Check if we already have cached categories
            if (cachedCategories && cachedCategories.length > 0) {
                setTagCategories(cachedCategories);
                return;
            }

            setIsLoading(true);
            try {
                const response = await httpClientUtil.secureHttpPost<ExtractTags_ReqInfo, ExtractTags_ResInfo>(`/api/docs/tags`, {});
                
                console.log('Tags API Response:', response); // Debug logging
                
                if (response && response.success && response.categories && response.categories.length > 0) {
                    console.log('Using categories from server:', response.categories);
                    setTagCategories(response.categories);
                    cachedCategories = response.categories;
                } else if (response && response.success && response.tags && response.tags.length > 0) {
                    // Fallback to flat tags format for backward compatibility
                    console.log('Using flat tags from server, converting to categories:', response.tags);
                    const fallbackCategories: TagCategory[] = [{
                        heading: 'General',
                        tags: response.tags
                    }];
                    setTagCategories(fallbackCategories);
                    cachedCategories = fallbackCategories;
                } else {
                    // Fall back to hard-coded categories if server returns empty
                    console.log('Server returned empty or unsuccessful response, using fallback categories');
                    const fallbackCategories: TagCategory[] = [{
                        heading: 'General',
                        tags: [
                            '#business', '#development', '#education', '#health', '#important',
                            '#javascript', '#meeting', '#personal', '#project', '#react',
                            '#research', '#todo', '#typescript', '#urgent', '#work'
                        ].sort()
                    }];
                    setTagCategories(fallbackCategories);
                    cachedCategories = fallbackCategories;
                }
                
            } catch (error) {
                console.error('Failed to load tags from server:', error);
                console.log('Error details:', error);
                // Fall back to hard-coded categories on error
                const fallbackCategories: TagCategory[] = [{
                    heading: 'General',
                    tags: [
                        '#business', '#development', '#education', '#health', '#important',
                        '#javascript', '#meeting', '#personal', '#project', '#react',
                        '#research', '#todo', '#typescript', '#urgent', '#work'
                    ].sort()
                }];
                setTagCategories(fallbackCategories);
                cachedCategories = fallbackCategories;
            } finally {
                setIsLoading(false);
            }
        };

        loadTags();
    }, []);

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
        setIsScanning(true);
        try {
            const response = await httpClientUtil.secureHttpPost<ScanTags_ReqInfo, ScanTags_ResInfo>(`/api/docs/tags/scan`, {});
            
            if (response && response.success) {
                // Clear the cache so categories will be reloaded
                cachedCategories = null;
                
                // Reload categories to get the updated list
                const tagsResponse = await httpClientUtil.secureHttpPost<ExtractTags_ReqInfo, ExtractTags_ResInfo>(`/api/docs/tags`, {});
                
                if (tagsResponse && tagsResponse.success) {
                    if (tagsResponse.categories && tagsResponse.categories.length > 0) {
                        setTagCategories(tagsResponse.categories);
                        cachedCategories = tagsResponse.categories;
                    } else if (tagsResponse.tags && tagsResponse.tags.length > 0) {
                        // Fallback to flat tags for backward compatibility
                        const fallbackCategories: TagCategory[] = [{
                            heading: 'General',
                            tags: tagsResponse.tags
                        }];
                        setTagCategories(fallbackCategories);
                        cachedCategories = fallbackCategories;
                    }
                }
                
                await alertModal(response?.message || 'Scan completed successfully');
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
        <div className="absolute top-0 left-0 right-0 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-[50vh] flex flex-col">
            <div className="flex justify-between items-center px-4 border-b border-gray-600">
                <h3 className="text-gray-200 text-base font-semibold">Select Tags</h3>
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
                        Done
                    </button>
                </div>
            </div>
            
            {isLoading ? (
                <div className="flex items-center justify-center py-8 px-4">
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span className="text-gray-400">Loading tags...</span>
                </div>
            ) : (
                <>
                    {/* Scrollable tags content */}
                    <div className="flex-1 overflow-y-auto px-4 py-2">
                        {/* Categorized tags */}
                        <div>
                            {tagCategories.map((category: TagCategory, categoryIndex) => (
                                <div key={category.heading} className={categoryIndex > 0 ? 'mt-4' : ''}>
                                    {/* Category heading */}
                                    <h4 className="text-blue-300 text-base font-medium mb-2">
                                        {category.heading}
                                    </h4>
                                    
                                    {/* Tags grid for this category */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                        {category.tags.map((tag: string) => (
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
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action buttons - fixed at bottom */}
                    <div className="flex justify-end gap-2 px-4 py-2 border-t border-gray-600">
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
