import { useState } from 'react';

interface TagSelectorProps {
    onAddTags: (selectedTags: string[]) => void;
    onCancel: () => void;
}

/**
 * Component for selecting tags using checkboxes and inserting them into text content
 */
export default function TagSelector({ onAddTags, onCancel }: TagSelectorProps) {
    // Hard-coded tags for now - in the future these will be dynamic
    const availableTags = [
        '#business',
        '#development', 
        '#education',
        '#health',
        '#important',
        '#javascript',
        '#meeting',
        '#personal',
        '#project',
        '#react',
        '#research',
        '#todo',
        '#typescript',
        '#urgent',
        '#work'
    ].sort(); // Sort alphabetically

    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

    const handleTagToggle = (tag: string) => {
        const newSelectedTags = new Set(selectedTags);
        if (newSelectedTags.has(tag)) {
            newSelectedTags.delete(tag);
        } else {
            newSelectedTags.add(tag);
        }
        setSelectedTags(newSelectedTags);
    };

    const handleAddClick = () => {
        const tagsArray = Array.from(selectedTags).sort();
        onAddTags(tagsArray);
        setSelectedTags(new Set()); // Clear selection after adding
    };

    return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mt-3">
            <h3 className="text-gray-200 text-lg font-semibold mb-3">Select Tags</h3>
            
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

            {/* Selected tags preview */}
            {selectedTags.size > 0 && (
                <div className="mb-4">
                    <p className="text-gray-400 text-sm mb-2">Selected tags:</p>
                    <div className="text-gray-300 text-sm">
                        {Array.from(selectedTags).sort().join(' ')}
                    </div>
                </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="btn-secondary"
                >
                    Cancel
                </button>
                <button
                    onClick={handleAddClick}
                    disabled={selectedTags.size === 0}
                    className={`${selectedTags.size === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed py-2 px-4 rounded h-10' : 'btn-primary'}`}
                >
                    Add ({selectedTags.size})
                </button>
            </div>
        </div>
    );
}
