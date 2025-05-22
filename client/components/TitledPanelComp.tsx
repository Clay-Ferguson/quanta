import React from 'react';
import { gd, gs, useGlobalState } from '../GlobalState';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';

interface TitledPanelProps {
  title: string;
  children: React.ReactNode;

  // Optional props for collapsible functionality
  collapsibleKey?: string;
}

function setPanelCollapsed(collapsibleKey: string, isCollapsed: boolean) {
    // Clone the current set of collapsed panels (or create a new one if it doesn't exist)
    const collapsedPanels = new Set(gs().collapsedPanels || new Set<string>());
    
    if (isCollapsed) {
        // If collapsing, add the key to the set
        collapsedPanels.add(collapsibleKey);
    } else {
        // If expanding, remove the key from the set
        collapsedPanels.delete(collapsibleKey);
    }
        
    // Update the global state with the new set
    gd({ type: 'setPanelCollapsed', payload: { collapsedPanels }});
}

/**
 * Displays a titled panel with a title and content area. The title is styled with a blue background and the content area has a gray background.
 * Can be made collapsible by providing a collapsibleKey. If provided, the panel will show collapse/expand controls and maintain its state in global state.
 */
export default function TitledPanelComp({ title, children, collapsibleKey }: TitledPanelProps) {
    const gs = useGlobalState();

    // Determine if this panel is currently collapsed based on global state
    const isCollapsible = !!collapsibleKey;
    const isCollapsed = isCollapsible && gs.collapsedPanels?.has(collapsibleKey);
    
    // Toggle collapse state
    const toggleCollapse = () => {
        if (collapsibleKey) {
            // Call the app method to update global state
            setPanelCollapsed(collapsibleKey, !isCollapsed);
        }
    };
    
    return (
        <div className={`bg-gray-800/80 border border-blue-700/30 rounded-lg overflow-hidden`}>
            <div className="text-xl font-medium text-white bg-blue-900 py-2 px-4 shadow-md flex justify-between items-center">
                <div>{title}</div>
                {isCollapsible && (
                    <button 
                        onClick={toggleCollapse}
                        className="text-blue-300 hover:text-white transition-colors px-2 py-1 -m-1"
                        aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
                    >
                        <FontAwesomeIcon icon={isCollapsed ? faChevronDown : faChevronUp} />
                    </button>
                )}
            </div>
            {(!isCollapsible || !isCollapsed) && (
                <div className="p-4">
                    <div className="bg-gray-700/90 rounded-lg p-4 border border-blue-800/20 shadow-inner">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};
