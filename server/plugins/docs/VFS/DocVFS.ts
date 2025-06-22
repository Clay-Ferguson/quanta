import { Request, Response } from 'express';
import { svrUtil } from "../../../ServerUtil.js";
import { config } from "../../../Config.js";
import pgdb from '../../../PDGB.js';

class DocVFS {
    /**
     * HTTP endpoint handler for VFS (PostgreSQL-based) text file search.
     * 
     * This method provides search capabilities across text files stored in the PostgreSQL VFS.
     * It uses the pg_search_text function to perform database-level text searching,
     * returning file-level matches without line numbers (unlike the grep-based search).
     * 
     * Search Modes:
     * - REGEX: Treats query as regular expression
     * - MATCH_ANY: Finds files containing any search terms (OR logic)
     * - MATCH_ALL: Finds files containing all search terms (AND logic)
     * 
     * Features:
     * - PostgreSQL native text search for better performance
     * - File-level results (no line numbers)
     * - Timestamp filtering support
     * - Modification time ordering
     * - Consistent API with existing search endpoints
     */
    searchVFSFiles = async (req: Request<any, any, {  
        query: string; 
        treeFolder: string; 
        docRootKey: string; 
        searchMode?: string,
        requireDate?: boolean,
        searchOrder?: string }>, res: Response): Promise<void> => {
        console.log("VFS Document Search Request");
        try {
            // Extract and validate parameters
            const { query, treeFolder, docRootKey, searchMode = 'MATCH_ANY', requireDate = false, searchOrder = 'MOD_TIME' } = req.body;
            
            // Validate required parameters
            if (!query || typeof query !== 'string') {
                res.status(400).json({ error: 'Query string is required' });
                return;
            }
            
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
                'SELECT * FROM pg_search_text($1, $2, $3, $4, $5, $6)',
                [query, treeFolder, docRootKey, searchMode, requireDate, searchOrder]
            );
            
            // Transform results to match the expected format (file-level results without line numbers)
            const results = searchResult.rows.map((row: any) => ({
                // remove "/" prefix if it exists, to ensure full path is consistent
                file: row.full_path.startsWith("/") ? row.full_path.substring(1) : row.full_path,
            }));
            
            // Send successful response in the same format as searchTextFiles
            res.json({ 
                success: true, 
                message: `VFS search completed for query: "${query}". Found ${results.length} matching files.`,
                query: query,
                searchPath: treeFolder,
                searchMode: searchMode,
                resultCount: results.length,
                results: results
            });
            
        } catch (error) {
            console.error('VFS search error:', error);
            svrUtil.handleError(error, res, 'Failed to perform VFS search');
        }
    }
}

const docVFS = new DocVFS();
export default docVFS;