import { svrUtil } from "../../../server/ServerUtil.js";
import vfs from "./VFS.js";
import { docUtil } from "./DocUtil.js"; 
import { ExtractTagsRequest, ExtractTagsResponse, ScanTagsRequest, ScanTagsResponse } from "./HttpTypes.js";

class DocTags {
    /**
     * HTTP endpoint for extracting hashtags from a ".TAGS.md" file in the document root.
     * 
     * This endpoint searches for a file named ".TAGS.md" in the root of the specified document root
     * and extracts all hashtags from it using regex pattern matching. The tags are returned as a
     * sorted array of unique tag strings.
     * 
     * @param res - Express response to send the extracted tags
     */
    extractTags = async (req: ExtractTagsRequest, res: ExtractTagsResponse): Promise<void> => {
        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id == null) {
            return;
        }
    
        try {
            // Try to read .TAGS.md from the root directory
            const tagsFilePath = docUtil.pathJoin("/", '.TAGS.md');
            const fileContent = await vfs.readFile(owner_id, tagsFilePath, 'utf8') as string;
            console.log('Read .TAGS.md file content:', fileContent); // Debug logging
                    
            // Parse tags with categories
            const categories = this.parseTagsWithCategories(fileContent);
                    
            // Extract flat list of tags for backward compatibility
            const allTags: string[] = [];
            categories.forEach(category => {
                allTags.push(...category.tags);
            });
            const uniqueTags = [...new Set(allTags)].sort();
                    
            res.json({
                success: true,
                tags: uniqueTags, // Backward compatibility
                categories: categories // New categorized format
            });
                    
        } catch {
            // If .TAGS.md doesn't exist or can't be read, return empty arrays
            console.log('.TAGS.md not found or not readable, returning empty tags list');
            res.json({
                success: true,
                tags: [],
                categories: []
            });
        }
    }
    
    /**
     * HTTP endpoint for scanning all markdown files and updating the .TAGS.md file with newly discovered hashtags.
     * 
     * This endpoint performs a two-phase scan:
     * 1. Phase 1: Load existing tags from .TAGS.md into a hash map
     * 2. Phase 2: Scan all markdown files in the document root for hashtags
     * 3. Compare and append any new tags to .TAGS.md if new ones are found
     * 
     * @param res - Express response with scan results
     */
    scanAndUpdateTags = async (req: ScanTagsRequest, res: ScanTagsResponse): Promise<void> => {

        const owner_id = svrUtil.getOwnerId(req, res);
        if (owner_id == null) {
            return;
        }
    
        // Phase 1: Load existing tags from .TAGS.md
        const tagsFilePath = docUtil.pathJoin("/", '.TAGS.md');
        const existingTagsMap = new Map<string, boolean>();
        let existingContent = '';
                
        try {
            existingContent = await vfs.readFile(owner_id, tagsFilePath, 'utf8') as string;
            const existingTags = this.extractHashtagsFromText(existingContent);
                    
            existingTags.forEach(tag => {
                existingTagsMap.set(tag, true);
            });
                    
            console.log(`Found ${existingTags.length} existing tags in .TAGS.md`);
        } catch {
            console.log('.TAGS.md not found, starting with empty tag set');
        }
    
        // Phase 2: Scan all markdown files for hashtags
        const newTagsMap = new Map<string, boolean>();
        await this.scanDirectoryForTags(owner_id, "/", "/", existingTagsMap, newTagsMap);
    
        const newTagsArray = Array.from(newTagsMap.keys()).sort();
        console.log(`Found ${newTagsArray.length} new tags during scan`);
    
        // Phase 3: Update .TAGS.md if new tags were found
        if (newTagsArray.length > 0) {
            let updatedContent = existingContent;
                    
            // If there's existing content, add a newline before the new section
            if (existingContent && !existingContent.endsWith('\n')) {
                updatedContent += '\n';
            }
                    
            // Add new tags under a "Discovered Tags" heading
            if (existingContent) {
                updatedContent += '\n## Discovered Tags\n';
            } else {
                updatedContent = '## Discovered Tags\n';
            }
            updatedContent += newTagsArray.join(' ') + '\n';
                    
            try {
                await vfs.writeFile(owner_id, tagsFilePath, updatedContent, 'utf8');
                console.log(`Updated .TAGS.md with ${newTagsArray.length} new tags under "Discovered Tags" section`);
            } catch (error) {
                console.error('Failed to write updated .TAGS.md:', error);
                res.json({
                    success: false,
                    message: 'Failed to update .TAGS.md file',
                    existingTags: existingTagsMap.size,
                    newTags: newTagsArray.length,
                    totalTags: existingTagsMap.size + newTagsArray.length
                });
                return;
            }
        }
    
        // Clear the module-level cache so the TagSelector will reload
        // Note: This is handled on the client side by invalidating the cache
    
        res.json({
            success: true,
            message: newTagsArray.length > 0 ? 
                `Scan completed. Added ${newTagsArray.length} new tags.` : 
                'Scan completed. No new tags found.',
            existingTags: existingTagsMap.size,
            newTags: newTagsArray.length,
            totalTags: existingTagsMap.size + newTagsArray.length
        });
    }
    
    /**
     * Recursively scans a directory for markdown files and extracts hashtags.
     * 
     * @param owner_id - The owner ID for file access
     * @param currentPath - Current directory path being scanned
     * @param rootPath - Root path for security validation
     * @param ifs - File system interface
     * @param existingTags - Map of existing tags to avoid duplicates
     * @param newTags - Map to collect newly discovered tags
     */
    private async scanDirectoryForTags(
        owner_id: number,
        currentPath: string,
        rootPath: string,
        existingTags: Map<string, boolean>,
        newTags: Map<string, boolean>
    ): Promise<void> {
        try {
            const items = await vfs.readdirEx(owner_id, currentPath, true);
                
            for (const item of items) {
                // Skip hidden files and system files
                if (item.name.startsWith('.') || item.name.startsWith('_')) {
                    continue;
                }
                    
                const itemPath = docUtil.pathJoin(currentPath, item.name);
                    
                if (item.is_directory) {
                    // Recursively scan subdirectories
                    await this.scanDirectoryForTags(owner_id, itemPath, rootPath, existingTags, newTags);
                } else if (item.name.toLowerCase().endsWith('.md') || item.name.toLowerCase().endsWith('.txt')) {
                    // Process markdown and text files
                    try {
                        const fileContent = await vfs.readFile(owner_id, itemPath, 'utf8') as string;
                        const fileTags = this.extractHashtagsFromText(fileContent);
                            
                        // Add any new tags to the newTags map
                        fileTags.forEach(tag => {
                            if (!existingTags.has(tag) && !newTags.has(tag)) {
                                newTags.set(tag, true);
                            }
                        });
                    } catch (error) {
                        console.warn(`Failed to read file ${itemPath}:`, error);
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to scan directory ${currentPath}:`, error);
        }
    }
    
    /**
     * Parses the .TAGS.md file to extract categorized tags organized under markdown headings.
     * 
     * This method processes the file line by line, treating any markdown heading (any number of #)
     * as a category header. All hashtags found after a heading are considered to belong to that
     * category until the next heading is encountered.
     * 
     * @param text - The content of the .TAGS.md file
     * @returns Array of TagCategory objects with heading and associated tags
     */
    private parseTagsWithCategories(text: string): { heading: string; tags: string[] }[] {
        const lines = text.split('\n');
        const categories: { heading: string; tags: string[] }[] = [];
        let currentHeading = '';
        let currentTags: string[] = [];
            
        // Regex patterns
        const headingRegex = /^#+\s+(.+)$/; // Matches markdown heading (# followed by space)
        const hashtagRegex = /(?:^|[\s\n])#[a-zA-Z0-9_/-]+/g; // Same pattern as extractHashtagsFromText
            
        console.log('Parsing .TAGS.md content, total lines:', lines.length); // Debug
            
        for (const line of lines) {
            const trimmedLine = line.trim();
                
            // Skip empty lines
            if (!trimmedLine) {
                continue;
            }
                
            // console.log('Processing line:', JSON.stringify(trimmedLine)); // Debug
                
            // Check if this line is a markdown heading
            const headingMatch = trimmedLine.match(headingRegex);
            if (headingMatch) {
                console.log('Found heading match:', headingMatch[1]); // Debug
                    
                // If we have a previous category with tags, save it
                if (currentHeading && currentTags.length > 0) {
                    console.log('Saving previous category:', currentHeading, 'with tags:', currentTags); // Debug
                    categories.push({
                        heading: currentHeading,
                        tags: [...new Set(currentTags)].sort() // Remove duplicates and sort
                    });
                }
                    
                // Start a new category
                currentHeading = headingMatch[1].trim();
                currentTags = [];
                // console.log('Started new category:', currentHeading); // Debug
            } else {
                // This line is not a heading, extract hashtags from it
                const rawMatches = trimmedLine.match(hashtagRegex) || [];
                // Extract just the hashtag part (remove any leading whitespace)
                const tagsInLine = rawMatches.map(match => {
                    const hashIndex = match.indexOf('#');
                    return match.substring(hashIndex);
                });
                    // console.log('Found tags in line:', tagsInLine); // Debug
                currentTags.push(...tagsInLine);
            }
        }
            
        // Don't forget the last category
        if (currentHeading && currentTags.length > 0) {
            console.log('Saving final category:', currentHeading, 'with tags:', currentTags); // Debug
            categories.push({
                heading: currentHeading,
                tags: [...new Set(currentTags)].sort() // Remove duplicates and sort
            });
        }
            
        // If no headings were found but we have tags, create a default category
        if (categories.length === 0 && currentTags.length > 0) {
            console.log('No headings found, creating General category with tags:', currentTags); // Debug
            categories.push({
                heading: 'General',
                tags: [...new Set(currentTags)].sort()
            });
        }
            
        console.log('Final parsed categories from .TAGS.md:', JSON.stringify(categories, null, 2)); // Debug logging
            
        return categories;
    }
    
    /**
     * Extracts hashtags from text content using regex pattern matching.
     * 
     * Searches for patterns like "#tagname" where tagname consists of letters, numbers, 
     * underscores, and hyphens. Only matches hashtags that are properly standalone - either
     * at the beginning of the text, at the beginning of a line, or preceded by whitespace.
     * 
     * @param text - The text content to search for hashtags
     * @returns Array of unique hashtags sorted alphabetically
     */
    private extractHashtagsFromText(text: string): string[] {
        // Regex to match hashtags: # preceded by start of string, newline, or whitespace
        // followed by word characters, underscores, hyphens, and forward slashes
        const hashtagRegex = /(?:^|[\s\n])#[a-zA-Z0-9_/-]+/g;
            
        const matches = text.match(hashtagRegex) || [];
            
        // Extract just the hashtag part (remove any leading whitespace)
        const cleanedMatches = matches.map(match => {
            // Find the # character and extract from there
            const hashIndex = match.indexOf('#');
            return match.substring(hashIndex);
        });
            
        // Convert to Set to remove duplicates, then back to Array and sort
        const uniqueTags = Array.from(new Set(cleanedMatches));
            
        return uniqueTags.sort();
    }
}

export const docTags = new DocTags();