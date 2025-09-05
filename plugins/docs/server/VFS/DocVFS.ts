import { Request, Response } from 'express';
import { AuthenticatedRequest, handleError } from "../../../../server/ServerUtil.js";
import { config } from "../../../../server/Config.js";
import pgdb from '../../../../server/PGDB.js';
import { ANON_USER_ID } from '../../../../common/types/CommonTypes.js';

class DocVFS {
    /**
     * HTTP endpoint handler for VFS (PostgreSQL-based) text file search.
     * 
     * This method provides search capabilities across text files stored in the PostgreSQL VFS.
     * It uses the vfs_search_text function to perform database-level text searching,
     * returning file-level matches without line numbers (unlike the grep-based search).
     * 
     * Search Modes:
     * - REGEX: Treats query as regular expression
     * - MATCH_ANY: Finds files containing any search terms (OR logic)
     * - MATCH_ALL: Finds files containing all search terms (AND logic)
     * 
     * Empty Query Handling:
     * - Empty, null, or undefined queries are treated as "match everything"
     * - Automatically converts to REGEX mode with pattern ".*" to match all content
     * - Returns file-level results only (no line-by-line content)
     * - Useful for browsing all VFS content in a directory structure
     * 
     * Features:
     * - PostgreSQL native text search for better performance
     * - File-level results (no line numbers)
     * - Timestamp filtering support
     * - Modification time ordering
     * - Consistent API with existing search endpoints
     */
    searchVFSFiles = async (req: Request<any, any, {  
        query?: string; 
        treeFolder: string; 
        docRootKey: string; 
        searchMode?: string,
        requireDate?: boolean,
        searchOrder?: string }>, res: Response): Promise<void> => {
        console.log("VFS Document Search Request");
        try {
            let user_id = (req as any).userProfile ? (req as AuthenticatedRequest).userProfile?.id : 0; 
            if (!user_id) {
                user_id = ANON_USER_ID;
            } 

            // Extract and validate parameters
            const { treeFolder, docRootKey, requireDate = false, searchOrder = 'MOD_TIME' } = req.body;
            let { query, searchMode = 'MATCH_ANY' } = req.body;
            
            // Handle empty, null, or undefined query as "match everything"
            const isEmptyQuery = !query || query.trim() === '';
            if (isEmptyQuery) {
                query = '.*'; // Regex pattern that matches any content
                searchMode = 'REGEX'; // Force REGEX mode for match-all behavior
                console.log('Empty query detected in VFS search, using match-all pattern for file-level results');
            }
            
            // Validate required parameters
            if (!treeFolder || typeof treeFolder !== 'string') {
                res.status(400).json({ error: 'Tree folder is required' });
                return;
            }
            
            if (!docRootKey || typeof docRootKey !== 'string') {
                res.status(400).json({ error: 'Document root key is required' });
                return;
            }
            
            // Validate document root configuration
            const rootConfig = config.getPublicFolderByKey(docRootKey);
            if (!rootConfig) {
                res.status(500).json({ error: 'Invalid document root key' });
                return;
            }
            
            // Ensure this is a VFS root (PostgreSQL-based)
            if (rootConfig.type !== 'vfs') {
                res.status(400).json({ error: 'This endpoint is only for VFS (PostgreSQL) document roots' });
                return;
            }

            console.log(`VFS search query: "${query}" with mode: "${searchMode}" in folder: "${treeFolder}"`);
            
            // Call the PostgreSQL search function
            const searchResult = await pgdb.query(
                'SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6, $7)',
                user_id, query, treeFolder, docRootKey, searchMode, requireDate, searchOrder
            );
            
            // Transform results to match the expected format (file-level results without line numbers)
            const results = searchResult.rows.map((row: any) => ({
                // remove "/" prefix if it exists, to ensure full path is consistent
                file: row.full_path.startsWith("/") ? row.full_path.substring(1) : row.full_path,
            }));
            
            // Send successful response in the same format as searchTextFiles
            res.json({ 
                message: `VFS search completed for query: "${query}". Found ${results.length} matching files.`,
                query: query,
                searchPath: treeFolder,
                searchMode: searchMode,
                resultCount: results.length,
                results: results
            });
            
        } catch (error) {
            console.error('VFS search error:', error);
            handleError(error, res, 'Failed to perform VFS search');
        }
    }
}

const docVFS = new DocVFS();
export default docVFS;