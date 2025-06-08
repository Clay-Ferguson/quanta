export const formatDisplayName = (name: string) => {
    name = stripOrdinal(name);
    const endsWithUnderscore = name.endsWith('_');

    // Replace underscores and dashes with spaces
    name = name.replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); 

    // we preserve the display of the final underscore if it exists, because that's important for the user to see
    // becasue it represents a 'pullup'
    if (endsWithUnderscore) {
        // If the name ends with an underscore, we add a space at the end
        name += '_';
    }

    // If name ends with ".Md" remove it. Replace with ".md" if it exists
    if (name.endsWith('.Md')) {
        name = name.slice(0, -3) + '.md';
    }
        
    return name;
}   

// Removes the prefix from the file name. We find the first occurrence of an underscore and return the substring after it.
export const stripOrdinal = (name: string) => {
    const idx = name.indexOf('_');
    return idx !== -1 ? name.substring(idx + 1) : name;
}   

// This method should split apart path into its components and format it nicely
// using formatFileName for each component.
export function formatFullPath(path: string): string {
    if (!path || path === '/') {
        return '';
    }
        
    // Split the path by '/' and format each component
    const comps = path.split('/').filter(Boolean); // Filter out empty components
    return comps.map(formatDisplayName).join(' / ');
}

/**
 * Function to determine heading level based on hash symbols at start of content
 */
export function getHeadingLevel(content: string | undefined): number {
    if (!content) return 0;
    
    const lines = content.split('\n');
    if (lines.length === 0) return 0;
    
    const firstLine = lines[0];
    const hashMatch = firstLine.match(/^#+$/);
    
    if (hashMatch) {
        const hashCount = hashMatch[0].length;
        // Return heading level 1-6, capping at 6 for any count > 6
        return Math.min(hashCount, 6);
    }
    
    return 0;
}

/**
 * Helper function to strip the first line if it contains only hash marks
 */
export function stripHashMarkFirstLine(content: string | undefined): string {
    if (!content) return '';
    
    const lines = content.split('\n');
    if (lines.length === 0) return content;
    
    const firstLine = lines[0];
    const hashMatch = firstLine.match(/^#+$/);
    
    if (hashMatch) {
        // Remove the first line and return the rest
        return lines.slice(1).join('\n');
    }
    
    return content;
}
