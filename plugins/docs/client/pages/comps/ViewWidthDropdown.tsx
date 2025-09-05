import { idb } from '../../../../../client/IndexedDB';
import { DBKeys } from '../../../../../client/AppServiceTypes';
import { gd, DocsGlobalState } from '../../DocsTypes';

interface ViewWidthDropdownProps {
    gs: DocsGlobalState;
}

/**
 * Component for selecting view width (narrow, medium, wide, full)
 */
export default function ViewWidthDropdown({ gs }: ViewWidthDropdownProps) {
    const handleWidthChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newWidth = event.target.value as 'narrow' | 'medium' | 'wide' | 'full';
        
        // Update global state
        gd({ type: 'setViewWidth', payload: { 
            docsViewWidth: newWidth
        }});
        
        // Persist to IndexedDB
        await idb.setItem(DBKeys.docsViewWidth, newWidth);
    };

    return (
        <div className="flex items-center">
            <select
                value={gs.docsViewWidth || 'medium'}
                onChange={handleWidthChange}
                className="bg-gray-700 border border-gray-600 rounded text-gray-200 text-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Content width"
            >
                <option value="narrow">Narrow</option>
                <option value="medium">Medium</option>
                <option value="wide">Wide</option>
                <option value="full">Full</option>
            </select>
        </div>
    );
}
