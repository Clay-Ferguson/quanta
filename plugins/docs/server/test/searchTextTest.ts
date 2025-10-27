import pgdb from '../../../../server/db/PGDB.js';

const testRootKey = 'usr';

export async function searchTextTest(owner_id: number): Promise<void> {
    const testParentPath = '/test-search-text';
    
    try {
        console.log('=== VFS Search Text Test Starting ===');

        // Clean up any leftover test data from previous runs first
        console.log('Cleaning up any existing test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Initial cleanup failed (this is usually not a problem):', cleanupError);
        }
        
        // Test 1: Create several text files with different content for searching
        const testFiles = [
            { 
                filename: 'javascript-guide.md', 
                ordinal: 1000, 
                content: 'This is a comprehensive guide to the **JavaScript** programming language. Learn about variables, functions, and objects in JavaScript.',
                contentType: 'text/markdown'
            },
            { 
                filename: 'python-tutorial.txt', 
                ordinal: 2000, 
                content: 'Python is a powerful programming language. This tutorial covers Python basics including variables and functions.',
                contentType: 'text/plain'
            },
            { 
                filename: 'web-development.md', 
                ordinal: 3000, 
                content: 'Modern web development uses JavaScript, HTML, and CSS. Learn how to build responsive websites.',
                contentType: 'text/markdown'
            },
            { 
                filename: 'database-notes.txt', 
                ordinal: 4000, 
                content: 'PostgreSQL is a relational database. This document covers SQL queries and database design.',
                contentType: 'text/plain'
            },
            { 
                filename: 'empty-file.txt', 
                ordinal: 5000, 
                content: '',
                contentType: 'text/plain'
            }
        ];

        console.log('Creating test files with different content...');
        
        // Insert test files with different content
        for (const testFile of testFiles) {
            await pgdb.query(`
                INSERT INTO vfs_nodes (
                    owner_id, doc_root_key, parent_path, filename, ordinal,
                    is_directory, is_public, content_text, content_binary, is_binary, 
                    content_type, size_bytes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, owner_id, testRootKey, testParentPath, testFile.filename, testFile.ordinal,
            false, false, testFile.content, null, false, testFile.contentType, Buffer.from(testFile.content).length);
            
            console.log(`Created text file: ${testFile.filename} (ordinal: ${testFile.ordinal}) with content: "${testFile.content.substring(0, 50)}..."`);
        }

        // Create a binary file to ensure it's excluded from text search
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, 'test-image.png', 6000,
        false, false, null, binaryContent, true, 'image/png', binaryContent.length);

        console.log('Created binary file: test-image.png (should be excluded from text search)');

        // Test 2: MATCH_ANY search mode - search for "JavaScript"
        console.log('Testing vfs_search_text with MATCH_ANY mode for "JavaScript"...');
        
        const javascriptSearchResult = await pgdb.query(`
            SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)
        `, owner_id, 'JavaScript', testParentPath, testRootKey, 'MATCH_ANY', 'MOD_TIME');
        
        console.log(`JavaScript search returned ${javascriptSearchResult.rows.length} results:`);
        javascriptSearchResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.file} (${row.content_type}, ${row.size_bytes} bytes, modified: ${row.modified_time})`);
        });
        
        // Should find 2 files: javascript-guide.md and web-development.md
        const expectedJavaScriptFiles = ['javascript-guide.md', 'web-development.md'];
        const actualJavaScriptFiles = javascriptSearchResult.rows.map((row: any) => row.file);
        
        if (javascriptSearchResult.rows.length !== 2) {
            throw new Error(`Expected 2 JavaScript results, got: ${javascriptSearchResult.rows.length}`);
        }
        
        for (const expectedFile of expectedJavaScriptFiles) {
            if (!actualJavaScriptFiles.includes(expectedFile)) {
                throw new Error(`Expected file not found in JavaScript search: ${expectedFile}`);
            }
        }

        console.log('✅ MATCH_ANY JavaScript search test passed');

        // Test 3: MATCH_ALL search mode - search for "programming language"
        console.log('Testing vfs_search_text with MATCH_ALL mode for "programming language"...');
        
        const programmingSearchResult = await pgdb.query(`
            SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)
        `, owner_id, 'programming language', testParentPath, testRootKey, 'MATCH_ALL', 'MOD_TIME');
        
        console.log(`Programming language search returned ${programmingSearchResult.rows.length} results:`);
        programmingSearchResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.file} (${row.content_type}, ${row.size_bytes} bytes)`);
        });
        
        // Should find 2 files: javascript-guide.md and python-tutorial.txt (both contain "programming" and "language")
        const expectedProgrammingFiles = ['javascript-guide.md', 'python-tutorial.txt'];
        const actualProgrammingFiles = programmingSearchResult.rows.map((row: any) => row.file);
        
        if (programmingSearchResult.rows.length !== 2) {
            throw new Error(`Expected 2 programming language results, got: ${programmingSearchResult.rows.length}`);
        }
        
        for (const expectedFile of expectedProgrammingFiles) {
            if (!actualProgrammingFiles.includes(expectedFile)) {
                throw new Error(`Expected file not found in programming language search: ${expectedFile}`);
            }
        }

        console.log('✅ MATCH_ALL programming language search test passed');

        // Test 4: REGEX search mode - search for files containing "SQL" or "CSS" 
        console.log('Testing vfs_search_text with REGEX mode for "(SQL|CSS)"...');
        
        const regexSearchResult = await pgdb.query(`
            SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)
        `, owner_id, '(SQL|CSS)', testParentPath, testRootKey, 'REGEX', 'MOD_TIME');
        
        console.log(`REGEX search returned ${regexSearchResult.rows.length} results:`);
        regexSearchResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.file} (${row.content_type}, ${row.size_bytes} bytes)`);
        });
        
        // Should find 2 files: database-notes.txt (contains "SQL") and web-development.md (contains "CSS")
        const expectedRegexFiles = ['database-notes.txt', 'web-development.md'];
        const actualRegexFiles = regexSearchResult.rows.map((row: any) => row.file);
        
        if (regexSearchResult.rows.length !== 2) {
            throw new Error(`Expected 2 REGEX results, got: ${regexSearchResult.rows.length}`);
        }
        
        for (const expectedFile of expectedRegexFiles) {
            if (!actualRegexFiles.includes(expectedFile)) {
                throw new Error(`Expected file not found in REGEX search: ${expectedFile}`);
            }
        }

        console.log('✅ REGEX search test passed');

        // Test 5: Empty query (should return all text files)
        console.log('Testing vfs_search_text with empty query (should return all text files)...');
        
        const emptySearchResult = await pgdb.query(`
            SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)
        `, owner_id, '', testParentPath, testRootKey, 'MATCH_ANY', 'MOD_TIME');
        
        console.log(`Empty query search returned ${emptySearchResult.rows.length} results:`);
        emptySearchResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.file} (${row.content_type}, ${row.size_bytes} bytes)`);
        });
        
        // Should find all 5 text files but exclude the binary file
        const expectedEmptyQueryFiles = ['javascript-guide.md', 'python-tutorial.txt', 'web-development.md', 'database-notes.txt', 'empty-file.txt'];
        const actualEmptyQueryFiles = emptySearchResult.rows.map((row: any) => row.file);
        
        if (emptySearchResult.rows.length !== 5) {
            throw new Error(`Expected 5 empty query results (all text files), got: ${emptySearchResult.rows.length}`);
        }
        
        for (const expectedFile of expectedEmptyQueryFiles) {
            if (!actualEmptyQueryFiles.includes(expectedFile)) {
                throw new Error(`Expected file not found in empty query search: ${expectedFile}`);
            }
        }
        
        // Verify binary file is not included
        if (actualEmptyQueryFiles.includes('test-image.png')) {
            throw new Error('Binary file should not be included in text search results');
        }

        console.log('✅ Empty query search test passed');

        // Test 6: Search with no matches
        console.log('Testing vfs_search_text with query that has no matches...');
        
        const noMatchSearchResult = await pgdb.query(`
            SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)
        `, owner_id, 'nonexistentterm12345', testParentPath, testRootKey, 'MATCH_ANY', 'MOD_TIME');
        
        console.log(`No match search returned ${noMatchSearchResult.rows.length} results`);
        
        if (noMatchSearchResult.rows.length !== 0) {
            throw new Error(`Expected 0 no-match results, got: ${noMatchSearchResult.rows.length}`);
        }

        console.log('✅ No match search test passed');

        // Test 7: Test different ordering - by filename
        console.log('Testing vfs_search_text with filename ordering...');
        
        const filenameOrderResult = await pgdb.query(`
            SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)
        `, owner_id, 'guide OR tutorial', testParentPath, testRootKey, 'MATCH_ANY', 'FILENAME');
        
        console.log(`Filename order search returned ${filenameOrderResult.rows.length} results:`);
        filenameOrderResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.file} (ordered by filename)`);
        });
        
        // Should find files containing "guide" or "tutorial" ordered by filename
        if (filenameOrderResult.rows.length >= 2) {
            const firstFile = filenameOrderResult.rows[0].file;
            const secondFile = filenameOrderResult.rows[1].file;
            
            // Should be in alphabetical order
            if (firstFile > secondFile) {
                throw new Error(`Filename ordering incorrect! Expected ${secondFile} before ${firstFile}`);
            }
        }

        console.log('✅ Filename ordering test passed');

        // Test 8: Test admin access (owner_id = 0 should access all files)
        console.log('Testing admin access (owner_id = 0) for text search...');
        
        const adminSearchResult = await pgdb.query(`
            SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)
        `, 0, 'JavaScript', testParentPath, testRootKey, 'MATCH_ANY', 'MOD_TIME'); // owner_id = 0 (admin)
        
        console.log(`Admin search returned ${adminSearchResult.rows.length} results`);
        
        // Admin should get the same results as the owner
        if (adminSearchResult.rows.length !== 2) {
            throw new Error(`Expected admin to get same 2 JavaScript results, got: ${adminSearchResult.rows.length}`);
        }

        console.log('✅ Admin access test passed');

        // Test 9: Create subdirectory with files and test path filtering
        const subDirectoryPath = testParentPath + '/subdirectory';
        
        console.log('Testing search with subdirectory path filtering...');
        
        // Create a subdirectory
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, testParentPath, 'subdirectory', 7000,
        true, false, null, null, false, 'directory', 0);
        
        // Create a file in the subdirectory
        await pgdb.query(`
            INSERT INTO vfs_nodes (
                owner_id, doc_root_key, parent_path, filename, ordinal,
                is_directory, is_public, content_text, content_binary, is_binary, 
                content_type, size_bytes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, owner_id, testRootKey, subDirectoryPath, 'nested-javascript.md', 1000,
        false, false, 'Another JavaScript file in a subdirectory.', null, false, 'text/markdown', Buffer.from('Another JavaScript file in a subdirectory.').length);
        
        console.log('Created subdirectory with nested JavaScript file');
        
        // Search in parent directory (should include subdirectory files due to LIKE pattern)
        const parentSearchResult = await pgdb.query(`
            SELECT * FROM vfs_search_text($1, $2, $3, $4, $5, $6)
        `, owner_id, 'JavaScript', testParentPath, testRootKey, 'MATCH_ANY', 'MOD_TIME');
        
        console.log(`Parent directory search returned ${parentSearchResult.rows.length} results (should include subdirectory files):`);
        parentSearchResult.rows.forEach((row: any, index: number) => {
            console.log(`  ${index + 1}. ${row.file} from ${row.full_path}`);
        });
        
        // Should now find 3 files: the original 2 plus the nested one
        if (parentSearchResult.rows.length !== 3) {
            throw new Error(`Expected 3 JavaScript results including subdirectory, got: ${parentSearchResult.rows.length}`);
        }

        console.log('✅ Subdirectory path filtering test passed');

        console.log('=== VFS Search Text Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Search Text Test Failed ===');
        console.error('Error during VFS search text test:', error);
        throw error;
    } finally {
        // Always clean up test data, even if test fails
        console.log('Final cleanup of test data...');
        try {
            await pgdb.query(`
                DELETE FROM vfs_nodes 
                WHERE doc_root_key = $1 AND parent_path LIKE $2
            `, testRootKey, testParentPath + '%');
        } catch (cleanupError) {
            console.log('Warning: Final cleanup failed:', cleanupError);
        }
    }
}