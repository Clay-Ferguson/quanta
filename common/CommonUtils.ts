
export function isImageFile(filename: string): boolean {
    const ext = getFilenameExtension(filename);
    return isImageExt(ext);
}

export function isTextFile(filename: string): boolean {
    const ext = getFilenameExtension(filename);
    return isTextFileExt(ext);
}

export function isImageExt(extension: string): boolean {
    // Check if the extension is one of the common image formats
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    return imageExtensions.includes(extension.toLowerCase());
}

export function isTextFileExt(extension: string): boolean {
    // Check if the extension is one of the common text formats
    const textExtensions = ['.md', '.txt', '.json', '.js', '.ts', '.html', '.css', '.xml', '.csv'];
    return textExtensions.includes(extension.toLowerCase());
}

export function getImageContentType(filename: string): string {
    const ext = getFilenameExtension(filename).toLowerCase();
    switch (ext) {
    case '.png':
        return 'image/png';
    case '.gif':
        return 'image/gif';
    case '.bmp':
        return 'image/bmp';
    case '.webp':
        return 'image/webp';
    case '.jpg':
    case '.jpeg':
    default:
        return 'image/jpeg';
    }
}

// Format timestamp to readable date
export function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
};

export function formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

/**
 * Strips the file extension from a filename
 */
export function stripFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return filename; // No extension
    return filename.substring(0, lastDotIndex);
};

export function fixName(name: string): string {
    // Replace any invalid characters with an underscore
    return name.replace(/[^a-zA-Z0-9_. -]/g, '_');
}   
    
export function getFilenameExtension(fullPath: string): string {
    // All we do is find the last dot and return the subtring including the dot.
    const lastDotIndex = fullPath.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === fullPath.length - 1) {
        // No extension found or dot is the last character
        return '';
    }
    return fullPath.substring(lastDotIndex);
}

export function formatDisplayName(name: string) {
    name = stripOrdinal(name);
    const endsWithUnderscore = name.endsWith('_');

    // Replace underscores and dashes with spaces
    name = name.replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); 
    name = name.trim();

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
export function stripOrdinal(name: string) {
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

// Creates an array of path components with their corresponding navigation paths
// for rendering clickable breadcrumb navigation
export function createClickablePathComponents(path: string): Array<{ displayName: string; navigationPath: string }> {
    if (!path || path === '/') {
        return [];
    }
    
    const components = path.split('/').filter(Boolean);
    const result = [];
    
    for (let i = 0; i < components.length; i++) {
        // Build the navigation path up to this component
        const navigationPath = '/' + components.slice(0, i + 1).join('/');
        
        // Format the display name (remove ordinals, capitalize, etc.)
        const displayName = formatDisplayName(components[i]);
        
        result.push({
            displayName,
            navigationPath
        });
    }
    
    // If we have more than 4 components, replace the leftmost ones with ".." to keep breadcrumbs compact
    if (result.length > 4) {
        for (let i = 0; i < result.length - 4; i++) {
            result[i].displayName = '..';
        }
    }
    
    return result;
}
