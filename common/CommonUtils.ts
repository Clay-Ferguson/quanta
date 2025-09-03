
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
    return name.replace(/[^a-zA-Z0-9_. \-&]/g, '_'); 
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

    // Replace underscores with spaces but keep dashes as-is
    name = name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); 
    name = name.trim();

    // we preserve the display of the final underscore if it exists, because that's important for the user to see
    // becasue it represents a 'pullup'
    if (endsWithUnderscore) {
        // If the name ends with an underscore, we add back at the end
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

// ============================================================================
// Test Assertion Functions
// ============================================================================

/**
 * Simple assertion function that throws an error if the condition is false
 */
export function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Assertion function for checking equality
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
        const msg = message || `Expected ${expected}, but got ${actual}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking if a value is null
 */
export function assertNull(value: any, message?: string): void {
    if (value !== null) {
        const msg = message || `Expected null, but got ${value}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking if a value is defined
 */
export function assertDefined(value: any, message?: string): void {
    if (value === undefined) {
        const msg = message || `Expected value to be defined, but got undefined`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking if a value is an array
 */
export function assertIsArray(value: any, message?: string): void {
    if (!Array.isArray(value)) {
        const msg = message || `Expected array, but got ${typeof value}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking if a string contains another string
 */
export function assertContains(haystack: string, needle: string, message?: string): void {
    if (!haystack.includes(needle)) {
        const msg = message || `Expected "${haystack}" to contain "${needle}"`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking if a string matches a regex pattern
 */
export function assertMatches(str: string, pattern: RegExp, message?: string): void {
    if (!pattern.test(str)) {
        const msg = message || `Expected "${str}" to match pattern ${pattern}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking array length
 */
export function assertArrayLength<T>(array: T[], expectedLength: number, message?: string): void {
    if (array.length !== expectedLength) {
        const msg = message || `Expected array length ${expectedLength}, but got ${array.length}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking object equality (deep comparison)
 */
export function assertObjectEqual<T>(actual: T, expected: T, message?: string): void {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        const msg = message || `Expected ${expectedStr}, but got ${actualStr}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking if an array length is greater than a value
 */
export function assertGreaterThan(actual: number, expected: number, message?: string): void {
    if (actual <= expected) {
        const msg = message || `Expected ${actual} to be greater than ${expected}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for finding an item in an array
 */
export function assertArrayContains<T>(array: T[], predicate: (item: T) => boolean, message?: string): T {
    const found = array.find(predicate);
    if (!found) {
        const msg = message || `Array does not contain expected item`;
        throw new Error(`Assertion failed: ${msg}`);
    }
    return found;
}
