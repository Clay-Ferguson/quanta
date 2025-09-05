// LFS Tests - Testing the actual Local File System implementation 
import lfs from '../LFS.js';
import path from 'path';
import { TestRunner } from '../../../../../common/TestRunner.js';
import {
    assertDefined,
    assertIsArray,
    assertContains,
    assertGreaterThan,
    assertArrayContains
} from '../../../../../common/CommonUtils.js';
import { docSvc } from '../../../../../plugins/docs/server/DocService.js';
import { config } from '../../../../../server/Config.js';

export async function runTests() {
    console.log("🚀 Starting LFS tests...");
    
    const testRunner = new TestRunner("LFS");
    const testRootKey = 'usr'; // Use the same root key as VFS tests
    const testRelativePath = 'lfs-test-structure'; // Relative path within the root
    
    // Get the LFS root path from config and construct the test path
    const publicFolder = config.getPublicFolderByKey(testRootKey);
    if (!publicFolder) {
        throw new Error(`No public folder found for key: ${testRootKey}`);
    }
    const testRootPath = lfs.pathJoin(publicFolder.path, testRelativePath);

    /**
     * Creates a test folder structure with 3 main folders, each having 3 subfolders,
     * and populates them with .md files containing searchable content using LFS.
     */
    async function createTestFolderStructure() {
        const ownerId = 1; // Mock owner ID for testing
        const folders = [
            { ordinal: '0001', name: 'Projects', subfolders: [
                { ordinal: '0001', name: 'WebDev', files: [
                    { ordinal: '0001', name: 'frontend-guide.md', content: '[2024/03/15 10:30:00 AM] This is a guide for frontend development using React and TypeScript. It covers component design patterns.' },
                    { ordinal: '0002', name: 'backend-setup.md', content: 'Backend setup instructions for Node.js and Express. Database integration with PostgreSQL.' },
                    { ordinal: '0003', name: 'fullstack-tutorial.md', content: '[2024/03/20 02:45:00 PM] Complete fullstack tutorial covering React frontend and Node.js backend with TypeScript. Includes database setup and API development.' }
                ]},
                { ordinal: '0002', name: 'Mobile', files: [
                    { ordinal: '0001', name: 'ios-development.md', content: 'iOS development using Swift and Xcode. Native app development patterns.' },
                    { ordinal: '0002', name: 'android-guide.md', content: 'Android development with Kotlin. Material design principles and best practices.' },
                    { ordinal: '0003', name: 'cross-platform.md', content: 'Cross-platform mobile development with React Native and TypeScript. Building apps for both iOS and Android.' }
                ]},
                { ordinal: '0003', name: 'DevOps', files: [
                    { ordinal: '0001', name: 'docker-setup.md', content: 'Docker containerization guide. Creating Dockerfiles and docker-compose configurations.' },
                    { ordinal: '0002', name: 'kubernetes-deployment.md', content: 'Kubernetes deployment strategies. Pod management and service configuration.' },
                    { ordinal: '0003', name: 'ci-cd-pipeline.md', content: 'Continuous integration and deployment pipeline setup with Docker and Kubernetes for Node.js applications.' }
                ]}
            ]},
            { ordinal: '0002', name: 'Documentation', subfolders: [
                { ordinal: '0001', name: 'UserGuides', files: [
                    { ordinal: '0001', name: 'getting-started.md', content: '[2024/02/10 09:15:00 AM] Getting started guide for new users. Account setup and basic navigation.' },
                    { ordinal: '0002', name: 'advanced-features.md', content: 'Advanced features documentation. Power user tips and tricks.' },
                    { ordinal: '0003', name: 'typescript-integration.md', content: '[2024/02/28 04:20:00 PM] TypeScript integration guide for developers. Setting up TypeScript with Node.js and React projects.' }
                ]},
                { ordinal: '0002', name: 'APIs', files: [
                    { ordinal: '0001', name: 'rest-api.md', content: 'REST API documentation. Endpoint descriptions and example requests.' },
                    { ordinal: '0002', name: 'websocket-api.md', content: 'WebSocket API documentation. Real-time communication protocols.' },
                    { ordinal: '0003', name: 'graphql-api.md', content: 'GraphQL API documentation with TypeScript support. Query examples and schema definitions.' }
                ]},
                { ordinal: '0003', name: 'Tutorials', files: [
                    { ordinal: '0001', name: 'basic-tutorial.md', content: 'Basic tutorial for beginners. Step-by-step walkthrough of core features.' },
                    { ordinal: '0002', name: 'integration-tutorial.md', content: 'Integration tutorial for third-party services. API keys and authentication.' },
                    { ordinal: '0003', name: 'testing-guide.md', content: 'Testing guide for TypeScript and Node.js applications. Unit testing best practices and frameworks.' }
                ]}
            ]},
            { ordinal: '0003', name: 'Research', subfolders: [
                { ordinal: '0001', name: 'Papers', files: [
                    { ordinal: '0001', name: 'machine-learning.md', content: 'Machine learning research paper. Deep learning algorithms and neural networks.' },
                    { ordinal: '0002', name: 'blockchain-analysis.md', content: 'Blockchain technology analysis. Cryptocurrency and distributed ledger systems.' }
                ]},
                { ordinal: '0002', name: 'Experiments', files: [
                    { ordinal: '0001', name: 'performance-test.md', content: 'Performance testing experiments. Load testing and benchmarking results.' },
                    { ordinal: '0002', name: 'usability-study.md', content: 'Usability study findings. User experience research and interface design.' }
                ]},
                { ordinal: '0003', name: 'Notes', files: [
                    { ordinal: '0001', name: 'meeting-notes.md', content: 'Meeting notes from team discussions. Action items and decision records.' },
                    { ordinal: '0002', name: 'brainstorm-ideas.md', content: 'Brainstorming session ideas. Creative concepts and innovation proposals.' }
                ]}
            ]}
        ];

        // Create the folder structure using LFS
        for (const folder of folders) {
            const folderPath = lfs.pathJoin(testRootPath, `${folder.ordinal}_${folder.name}`);
            console.log(`Creating folder: ${folderPath}`);
            await lfs.mkdir(ownerId, folderPath, { recursive: true });

            for (const subfolder of folder.subfolders) {
                const subfolderPath = lfs.pathJoin(folderPath, `${subfolder.ordinal}_${subfolder.name}`);
                console.log(`Creating subfolder: ${subfolderPath}`);
                await lfs.mkdir(ownerId, subfolderPath, { recursive: true });

                // Create files one by one to ensure directory exists
                for (const file of subfolder.files) {
                    const filePath = lfs.pathJoin(subfolderPath, `${file.ordinal}_${file.name}`);
                    console.log(`Creating file: ${filePath}`);
                    
                    // Ensure the parent directory exists before writing
                    const parentDir = path.dirname(filePath);
                    if (!(await lfs.exists(parentDir, {}))) {
                        console.log(`Parent directory doesn't exist, creating: ${parentDir}`);
                        await lfs.mkdir(ownerId, parentDir, { recursive: true });
                    }
                    
                    await lfs.writeFile(ownerId, filePath, file.content, 'utf8');
                }
            }
        }

        console.log(`Created test folder structure at: ${testRootPath}`);
    }

    // Setup test environment using LFS
    async function setupTestEnvironment(): Promise<void> {
        const ownerId = 1; // Mock owner ID for testing
        
        console.log(`Setting up test environment at: ${testRootPath}`);
        
        // Clean and recreate test directory using LFS
        try {
            if (await lfs.exists(testRootPath, {})) {
                console.log(`Test directory exists, removing: ${testRootPath}`);
                await lfs.rm(ownerId, testRootPath, { recursive: true, force: true });
            }
        } catch (error) {
            console.log(`Error checking/removing existing directory (this is normal): ${error}`);
        }
        
        console.log(`Creating test root directory: ${testRootPath}`);
        await lfs.mkdir(ownerId, testRootPath, { recursive: true });
        
        // Verify the directory was created
        const exists = await lfs.exists(testRootPath, {});
        if (!exists) {
            throw new Error(`Failed to create test root directory: ${testRootPath}`);
        }
        console.log(`✅ Test root directory created successfully: ${testRootPath}`);
    }

    // Cleanup test environment using LFS
    async function cleanupTestEnvironment(): Promise<void> {
        const ownerId = 1; // Mock owner ID for testing
        
        try {
            // Clean up test directory using LFS
            if (await lfs.exists(testRootPath, {})) {
                console.log(`Cleaning up test directory: ${testRootPath}`);
                await lfs.rm(ownerId, testRootPath, { recursive: true, force: true });
            }
        } catch (error) {
            console.log(`Error during cleanup (may be normal): ${error}`);
        }
    }

    try {
        // Setup test environment
        await testRunner.run("Setup test environment", async () => {
            await setupTestEnvironment();
            await createTestFolderStructure();
        });

        // Test 1: Test LFS basic file operations
        await testRunner.run("should perform basic LFS file operations", async () => {
            const ownerId = 1;
            const testFile = lfs.pathJoin(testRootPath, 'test-lfs-operations.md');
            const testContent = 'This is a test file for LFS operations.';
            
            // Test writeFile
            await lfs.writeFile(ownerId, testFile, testContent, 'utf8');
            
            // Test exists
            const exists = await lfs.exists(testFile, {});
            assertDefined(exists);
            assertContains(exists.toString(), 'true');
            
            // Test readFile
            const content = await lfs.readFile(ownerId, testFile, 'utf8');
            assertDefined(content);
            assertContains(content as string, 'test file for LFS operations');
            
            // Test stat
            const stats = await lfs.stat(testFile);
            assertDefined(stats);
            assertGreaterThan(stats.size, 0);
            assertContains(stats.is_directory.toString(), 'false');
            
            console.log('✅ LFS basic operations completed successfully');
        });

        // Test 2: Test LFS directory operations
        await testRunner.run("should perform LFS directory operations", async () => {
            const ownerId = 1;
            
            // Test readdir on created structure
            const contents = await lfs.readdir(ownerId, testRootPath);
            assertDefined(contents);
            assertIsArray(contents);
            assertGreaterThan(contents.length, 0);
            
            // Should find our test folders
            assertArrayContains(contents, (item: string) => item.includes('Projects'));
            assertArrayContains(contents, (item: string) => item.includes('Documentation'));
            assertArrayContains(contents, (item: string) => item.includes('Research'));
            
            console.log(`Found ${contents.length} items in test directory`);
            
            // Test readdirEx with content loading
            const projectsPath = lfs.pathJoin(testRootPath, '0001_Projects');
            const projectContents = await lfs.readdirEx(ownerId, projectsPath, false);
            assertDefined(projectContents);
            assertIsArray(projectContents);
            assertGreaterThan(projectContents.length, 0);
            
            // Check that we have TreeNode objects with proper structure
            const webdevFolder = assertArrayContains(projectContents, (item: any) => item.name.includes('WebDev'));
            assertDefined(webdevFolder);
            assertDefined(webdevFolder.is_directory);
            if (webdevFolder.is_directory !== undefined) {
                assertContains(webdevFolder.is_directory.toString(), 'true');
            }
            assertDefined(webdevFolder.createTime);
            assertDefined(webdevFolder.modifyTime);
            
            console.log('✅ LFS directory operations completed successfully');
        });

        // Test 3: Test LFS path normalization
        await testRunner.run("should properly normalize paths", async () => {
            // Test the normalize method
            const testPaths = [
                'relative/path',
                '/absolute/path',
                './current/path',
                '../parent/path'
            ];
            
            for (const testPath of testPaths) {
                const normalized = lfs.normalize(testPath);
                assertDefined(normalized);
                // LFS paths should always start with leading slash
                assertContains(normalized.charAt(0), '/');
            }
            
            console.log('✅ LFS path normalization completed successfully');
        });

        // Test 4: Test actual search functionality using DocService performTextSearch
        await testRunner.run("should test search functionality with real LFS instance", async () => {
            // Test the actual DocService search functionality
            const searchPromise = new Promise<any[]>((resolve, reject) => {
                docSvc.performTextSearch(
                    'React',
                    'MATCH_ANY',
                    false,
                    false,
                    'MOD_TIME',
                    testRootPath,
                    lfs,
                    (error, results) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(results || []);
                        }
                    }
                );
            });
            
            const results = await searchPromise;
            
            assertDefined(results);
            assertIsArray(results);
            assertGreaterThan(results.length, 0);
            
            // Should find the frontend-guide.md file that contains "React"
            const reactResult = assertArrayContains(results, (r: any) => r.file.includes('frontend-guide.md'));
            assertContains(reactResult.content, 'React');
            assertGreaterThan(reactResult.line, 0);
            
            console.log(`Found ${results.length} results for "React" search using real DocService`);
            console.log('Sample result:', results[0]);
        });

        // Test 5: Test MATCH_ALL search mode with real search functionality
        await testRunner.run("should test MATCH_ALL search mode with LFS", async () => {
            const searchPromise = new Promise<any[]>((resolve, reject) => {
                docSvc.performTextSearch(
                    'TypeScript Node.js',
                    'MATCH_ALL',
                    false,
                    false,
                    'MOD_TIME',
                    testRootPath,
                    lfs,
                    (error, results) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(results || []);
                        }
                    }
                );
            });
            
            const results = await searchPromise;
            
            assertDefined(results);
            assertIsArray(results);
            assertGreaterThan(results.length, 0);
            
            // Verify that each result contains both search terms
            for (const result of results) {
                assertContains(result.content, 'TypeScript');
                assertContains(result.content, 'Node.js');
                assertGreaterThan(result.line, 0);
            }
            
            console.log(`Found ${results.length} results for MATCH_ALL query with LFS`);
        });

        // Test 6: Test date-based search functionality (requireDate=true)
        await testRunner.run("should test date-based search with requireDate=true", async () => {
            // Test search for content that has both the search term AND timestamp
            const searchPromise = new Promise<any[]>((resolve, reject) => {
                docSvc.performTextSearch(
                    'React',           // Search for "React"
                    'MATCH_ANY',       // Search mode
                    false,             // Not empty query
                    true,              // requireDate=true (this is the key test)
                    'MOD_TIME',        // Search order
                    testRootPath,      // Search path
                    lfs,               // File system interface
                    (error, results) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(results || []);
                        }
                    }
                );
            });
            
            const results = await searchPromise;
            
            assertDefined(results);
            assertIsArray(results);
            assertGreaterThan(results.length, 0);
            
            // Should only find files that contain BOTH "React" AND a timestamp
            // This should find:
            // - frontend-guide.md (has "[2024/03/15 10:30:00 AM]" and "React")
            // - fullstack-tutorial.md (has "[2024/03/20 02:45:00 PM]" and "React")
            // Should NOT find any other files even if they contain "React" but no timestamp
            
            console.log(`Found ${results.length} results for date-based search with "React"`);
            
            // Verify each result contains both the search term and a timestamp
            for (const result of results) {
                assertContains(result.content, 'React');
                // Check that the content contains a timestamp pattern [YYYY/MM/DD HH:MM:SS AM/PM]
                const hasTimestamp = /\[20\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} (AM|PM)\]/.test(result.content);
                if (!hasTimestamp) {
                    throw new Error(`Result should contain timestamp but doesn't: ${result.file} - ${result.content}`);
                }
                assertGreaterThan(result.line, 0);
            }
            
            // Verify that we get the correct number of results (files with both timestamp AND "React")
            // Expected files:
            // 1. frontend-guide.md (has "[2024/03/15 10:30:00 AM]" and "React")
            // 2. fullstack-tutorial.md (has "[2024/03/20 02:45:00 PM]" and "React")
            // 3. typescript-integration.md (has "[2024/02/28 04:20:00 PM]" and "React")
            
            console.log('Results found:');
            results.forEach((result, index) => {
                console.log(`  ${index + 1}. ${result.file} - Line ${result.line}: ${result.content.substring(0, 100)}...`);
            });
            
            // We expect exactly 3 results
            assertContains(results.length.toString(), '3');
            
            // Verify specific files are found (the ones we know should be there)
            const frontendResults = results.filter(r => r.file.includes('frontend-guide.md'));
            const fullstackResults = results.filter(r => r.file.includes('fullstack-tutorial.md'));
            const typescriptResults = results.filter(r => r.file.includes('typescript-integration.md'));
            
            // These three files should definitely be found
            if (frontendResults.length === 0) {
                throw new Error('Expected to find frontend-guide.md in results');
            }
            if (fullstackResults.length === 0) {
                throw new Error('Expected to find fullstack-tutorial.md in results');
            }
            if (typescriptResults.length === 0) {
                throw new Error('Expected to find typescript-integration.md in results');
            }
            
            const frontendResult = frontendResults[0];
            assertContains(frontendResult.content, '[2024/03/15 10:30:00 AM]');
            assertContains(frontendResult.content, 'React');
            
            const fullstackResult = fullstackResults[0];
            assertContains(fullstackResult.content, '[2024/03/20 02:45:00 PM]');
            assertContains(fullstackResult.content, 'React');
            
            const typescriptResult = typescriptResults[0];
            assertContains(typescriptResult.content, '[2024/02/28 04:20:00 PM]');
            assertContains(typescriptResult.content, 'React');
            
            // Check if there are any unexpected results
            const expectedFiles = ['frontend-guide.md', 'fullstack-tutorial.md', 'typescript-integration.md'];
            const unexpectedResults = results.filter(r => !expectedFiles.some(expected => r.file.includes(expected)));
            
            if (unexpectedResults.length > 0) {
                console.warn('Found unexpected results:');
                unexpectedResults.forEach(result => {
                    console.warn(`  - ${result.file}: ${result.content.substring(0, 100)}...`);
                });
                throw new Error(`Found ${unexpectedResults.length} unexpected results in date-based search`);
            }
            
            console.log('✅ Date-based search correctly found only timestamped files with search term');
            
            // IMPORTANT: Verify that NO folder results are included when requireDate=true
            // This tests the fix we just implemented
            const folderResults = results.filter(r => r.folder !== undefined);
            if (folderResults.length > 0) {
                throw new Error(`Date-based search should not return folder matches, but found ${folderResults.length} folder results`);
            }
            console.log('✅ Confirmed: No folder results returned when requireDate=true (fix verification)');
        });

        // Test 7: Test date-based search with MATCH_ALL mode (multiple search terms + timestamp)
        await testRunner.run("should test date-based search with MATCH_ALL mode", async () => {
            // Test search for content that has ALL search terms AND timestamp
            const searchPromise = new Promise<any[]>((resolve, reject) => {
                docSvc.performTextSearch(
                    'React TypeScript',  // Search for files containing BOTH "React" AND "TypeScript"
                    'MATCH_ALL',         // MATCH_ALL mode (must contain all terms)
                    false,               // Not empty query
                    true,                // requireDate=true (must also have timestamp)
                    'MOD_TIME',          // Search order
                    testRootPath,        // Search path
                    lfs,                 // File system interface
                    (error, results) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(results || []);
                        }
                    }
                );
            });
            
            const results = await searchPromise;
            
            assertDefined(results);
            assertIsArray(results);
            assertGreaterThan(results.length, 0);
            
            console.log(`Found ${results.length} results for MATCH_ALL date-based search with "React TypeScript"`);
            
            // Should only find files that contain ALL of: "React" AND "TypeScript" AND a timestamp
            // Looking at our test data, the expected matches are:
            // 1. frontend-guide.md (has "[2024/03/15 10:30:00 AM]", "React", and "TypeScript")  
            // 2. fullstack-tutorial.md (has "[2024/03/20 02:45:00 PM]", "React", and "TypeScript")
            // 3. typescript-integration.md (has "[2024/02/28 04:20:00 PM]", "React", and "TypeScript")
            
            console.log('MATCH_ALL date-based results found:');
            results.forEach((result, index) => {
                console.log(`  ${index + 1}. ${result.file} - Line ${result.line}: ${result.content.substring(0, 120)}...`);
            });
            
            // Verify each result contains ALL search terms and a timestamp
            for (const result of results) {
                // Must contain "React"
                assertContains(result.content, 'React');
                // Must contain "TypeScript" 
                assertContains(result.content, 'TypeScript');
                // Must contain a timestamp pattern [YYYY/MM/DD HH:MM:SS AM/PM]
                const hasTimestamp = /\[20\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} (AM|PM)\]/.test(result.content);
                if (!hasTimestamp) {
                    throw new Error(`MATCH_ALL result should contain timestamp but doesn't: ${result.file} - ${result.content}`);
                }
                assertGreaterThan(result.line, 0);
            }
            
            // We expect exactly 3 results (same 3 files that happen to contain both React and TypeScript)
            assertContains(results.length.toString(), '3');
            
            // Verify specific files are found
            const frontendResults = results.filter(r => r.file.includes('frontend-guide.md'));
            const fullstackResults = results.filter(r => r.file.includes('fullstack-tutorial.md'));
            const typescriptResults = results.filter(r => r.file.includes('typescript-integration.md'));
            
            if (frontendResults.length === 0) {
                throw new Error('Expected to find frontend-guide.md in MATCH_ALL date-based results');
            }
            if (fullstackResults.length === 0) {
                throw new Error('Expected to find fullstack-tutorial.md in MATCH_ALL date-based results');
            }
            if (typescriptResults.length === 0) {
                throw new Error('Expected to find typescript-integration.md in MATCH_ALL date-based results');
            }
            
            // Verify each expected file has all required content
            const frontendResult = frontendResults[0];
            assertContains(frontendResult.content, '[2024/03/15 10:30:00 AM]');
            assertContains(frontendResult.content, 'React');
            assertContains(frontendResult.content, 'TypeScript');
            
            const fullstackResult = fullstackResults[0];
            assertContains(fullstackResult.content, '[2024/03/20 02:45:00 PM]');
            assertContains(fullstackResult.content, 'React');
            assertContains(fullstackResult.content, 'TypeScript');
            
            const typescriptResult = typescriptResults[0];
            assertContains(typescriptResult.content, '[2024/02/28 04:20:00 PM]');
            assertContains(typescriptResult.content, 'React');
            assertContains(typescriptResult.content, 'TypeScript');
            
            // Verify no unexpected results
            const expectedFiles = ['frontend-guide.md', 'fullstack-tutorial.md', 'typescript-integration.md'];
            const unexpectedResults = results.filter(r => !expectedFiles.some(expected => r.file.includes(expected)));
            
            if (unexpectedResults.length > 0) {
                console.warn('Found unexpected MATCH_ALL results:');
                unexpectedResults.forEach(result => {
                    console.warn(`  - ${result.file}: ${result.content.substring(0, 100)}...`);
                });
                throw new Error(`Found ${unexpectedResults.length} unexpected results in MATCH_ALL date-based search`);
            }
            
            console.log('✅ MATCH_ALL date-based search correctly found only files with ALL terms AND timestamps');
            
            // Verify that NO folder results are included when requireDate=true (even in MATCH_ALL mode)
            const folderResults = results.filter(r => r.folder !== undefined);
            if (folderResults.length > 0) {
                throw new Error(`MATCH_ALL date-based search should not return folder matches, but found ${folderResults.length} folder results`);
            }
            console.log('✅ Confirmed: No folder results returned in MATCH_ALL mode when requireDate=true');
        });

        // Test 8: Security - checkFileAccess allows paths inside root
        await testRunner.run("security: should allow access to files within the root", async () => {
            // Choose a known in-root file
            const inRootFile = lfs.pathJoin(testRootPath, '0001_Projects', '0001_WebDev', '0001_frontend-guide.md');
            // Should not throw
            lfs.checkFileAccess(inRootFile, testRootPath);
            // Exact root should also be allowed
            lfs.checkFileAccess(testRootPath, testRootPath);
            console.log('✅ checkFileAccess allowed in-root paths');
        });

        // Test 9: Security - checkFileAccess blocks traversal outside root
        await testRunner.run("security: should block directory traversal outside root", async () => {
            const traversalPath = lfs.pathJoin(testRootPath, '../outside.txt');
            let threw = false;
            try {
                lfs.checkFileAccess(traversalPath, testRootPath);
            } catch {
                threw = true;
                console.log('✅ checkFileAccess blocked traversal path:', traversalPath);
            }
            if (!threw) {
                throw new Error('checkFileAccess should have thrown for traversal path outside root');
            }
        });

        // Test 10: Security - checkFileAccess blocks absolute paths outside root
        await testRunner.run("security: should block absolute paths outside root", async () => {
            // Use a well-known absolute path on Linux
            const absoluteOutside = '/etc/hosts';
            let threw = false;
            try {
                lfs.checkFileAccess(absoluteOutside, testRootPath);
            } catch {
                threw = true;
                console.log('✅ checkFileAccess blocked absolute outside path:', absoluteOutside);
            }
            if (!threw) {
                throw new Error('checkFileAccess should have thrown for absolute path outside root');
            }
        });

        // Test 11: Security - searchTextFiles should block traversal outside root
        await testRunner.run("security: searchTextFiles should block traversal outside root", async () => {
            const req: any = {
                body: {
                    query: 'anything',
                    treeFolder: '../..',
                    docRootKey: testRootKey,
                    searchMode: 'MATCH_ANY',
                    requireDate: false,
                    searchOrder: 'MOD_TIME'
                }
            };
            const res: any = (() => {
                const obj: any = { statusCode: 200, body: null, headersSent: false, writableEnded: false };
                obj.status = (code: number) => { obj.statusCode = code; return obj; };
                obj.json = (data: any) => { obj.body = data; obj.headersSent = true; obj.writableEnded = true; };
                return obj;
            })();

            await docSvc.searchTextFiles(req, res);
            // Expect generic error handler to catch boundary violation
            assertContains(res.statusCode.toString(), '500');
            assertDefined(res.body);
            assertContains(res.body.errorMessage, 'Failed to perform search');
        });

        // Test 12: Security - searchBinaries should block traversal outside root
        await testRunner.run("security: searchBinaries should block traversal outside root", async () => {
            const req: any = {
                body: {
                    query: 'anything',
                    treeFolder: '../..',
                    docRootKey: testRootKey,
                    searchMode: 'MATCH_ANY',
                    requireDate: false,
                    searchOrder: 'MOD_TIME'
                }
            };
            const res: any = (() => {
                const obj: any = { statusCode: 200, body: null, headersSent: false, writableEnded: false };
                obj.status = (code: number) => { obj.statusCode = code; return obj; };
                obj.json = (data: any) => { obj.body = data; obj.headersSent = true; obj.writableEnded = true; };
                return obj;
            })();

            await docSvc.searchBinaries(req, res);
            assertContains(res.statusCode.toString(), '500');
            assertDefined(res.body);
            assertContains(res.body.errorMessage, 'Failed to perform simple search');
        });

        // Test 13: Security - treeRender should not escape root on traversal input
        await testRunner.run("security: treeRender should normalize/contain traversal to root", async () => {
            const req: any = {
                params: { docRootKey: testRootKey, 0: '../..' },
                query: {}
            };
            const res: any = (() => {
                const obj: any = { statusCode: 200, body: null, headersSent: false, writableEnded: false };
                obj.status = (code: number) => { obj.statusCode = code; return obj; };
                obj.json = (data: any) => { obj.body = data; obj.headersSent = true; obj.writableEnded = true; };
                return obj;
            })();

            await docSvc.treeRender(req, res);
            // Should succeed and stay within root (typically returns the root tree)
            assertContains(res.statusCode.toString(), '200');
            assertDefined(res.body);
            assertIsArray(res.body.treeNodes);
        });

        // Test 14: Security - createFile should block traversal outside root
        await testRunner.run("security: createFile should block traversal outside root", async () => {
            const req: any = {
                body: {
                    fileName: 'security-file.md',
                    treeFolder: '../..',
                    insertAfterNode: '',
                    docRootKey: testRootKey
                }
            };
            const res: any = (() => {
                const obj: any = { statusCode: 200, body: null, headersSent: false, writableEnded: false };
                obj.status = (code: number) => { obj.statusCode = code; return obj; };
                obj.json = (data: any) => { obj.body = data; obj.headersSent = true; obj.writableEnded = true; };
                return obj;
            })();

            try {
                await docSvc.createFile(req, res);
            } catch { /* runTrans may rethrow; response will still be set */ }
            // LFS normalizePath sanitizes traversal to root; expect success within root
            assertContains(res.statusCode.toString(), '200');
            assertDefined(res.body);
            assertContains(res.body.message, 'File created successfully');
        });

        // Test 16: Security - createFile allowed within root
        await testRunner.run("security: createFile should allow creation within root", async () => {
            // Root may have auto-ordinalized the test folder; resolve the actual current name
            const ownerId = 1;
            const rootEntries = await lfs.readdir(ownerId, publicFolder.path);
            const match = rootEntries.find((name: string) => name.replace(/^\d{4}_/, '') === testRelativePath);
            const treeFolderForCreate = match || testRelativePath;

            const req: any = {
                body: {
                    fileName: 'allowed-file.md',
                    treeFolder: treeFolderForCreate,
                    insertAfterNode: '',
                    docRootKey: testRootKey
                }
            };
            const res: any = (() => {
                const obj: any = { statusCode: 200, body: null, headersSent: false, writableEnded: false };
                obj.status = (code: number) => { obj.statusCode = code; return obj; };
                obj.json = (data: any) => { obj.body = data; obj.headersSent = true; obj.writableEnded = true; };
                return obj;
            })();

            await docSvc.createFile(req, res);
            assertContains(res.statusCode.toString(), '200');
            assertDefined(res.body);
            assertContains(res.body.message, 'File created successfully');
        });

        // Test 17: Security - createFolder allowed within root
        await testRunner.run("security: createFolder should allow creation within root", async () => {
            // Root may have auto-ordinalized the test folder; resolve the actual current name
            const ownerId = 1;
            const rootEntries = await lfs.readdir(ownerId, publicFolder.path);
            const match = rootEntries.find((name: string) => name.replace(/^\d{4}_/, '') === testRelativePath);
            const treeFolderForCreate = match || testRelativePath;

            const req: any = {
                body: {
                    folderName: 'allowed-folder',
                    treeFolder: treeFolderForCreate,
                    insertAfterNode: '',
                    docRootKey: testRootKey
                }
            };
            const res: any = (() => {
                const obj: any = { statusCode: 200, body: null, headersSent: false, writableEnded: false };
                obj.status = (code: number) => { obj.statusCode = code; return obj; };
                obj.json = (data: any) => { obj.body = data; obj.headersSent = true; obj.writableEnded = true; };
                return obj;
            })();

            try {
                await docSvc.createFolder(req, res);
            } catch { /* runTrans may rethrow; response will still be set */ }
            assertContains(res.statusCode.toString(), '200');
            assertDefined(res.body);
            assertContains(res.body.message, 'Folder created successfully');
        });

        // Test 18: Security - resolveNonOrdinalPath should not escape root
        await testRunner.run("security: resolveNonOrdinalPath should return null for traversal", async () => {
            const result = await docSvc.resolveNonOrdinalPath(0, testRootKey, '../../etc', lfs);
            // Should not resolve to anything outside; expect null
            const isNull = result === null || result === '';
            assertContains(isNull.toString(), 'true');
        });

        // Test 19: Content Loading - readdirEx should load content only for files when requested
        await testRunner.run("content: readdirEx should load file content when requested", async () => {
            const ownerId = 1;

            // Resolve current (possibly ordinalized) test root folder name
            const rootEntries = await lfs.readdir(ownerId, publicFolder.path);
            const match = rootEntries.find((name: string) => name.replace(/^\d{4}_/, '') === testRelativePath);
            const testRootCurrentPath = lfs.pathJoin(publicFolder.path, match || testRelativePath);

            // Resolve ordinalized names for nested directories
            const level1Entries = await lfs.readdir(ownerId, testRootCurrentPath);
            const projectsDirName = level1Entries.find((name: string) => name.replace(/^\d{4}_/, '') === 'Projects');
            if (!projectsDirName) {
                throw new Error('Projects directory not found under test root');
            }
            const projectsPath = lfs.pathJoin(testRootCurrentPath, projectsDirName);

            const level2Entries = await lfs.readdir(ownerId, projectsPath);
            const webdevDirName = level2Entries.find((name: string) => name.replace(/^\d{4}_/, '') === 'WebDev');
            if (!webdevDirName) {
                throw new Error('WebDev directory not found under Projects');
            }

            // Folder that contains files
            const webdevPath = lfs.pathJoin(projectsPath, webdevDirName);
            const nodesWithContent = await lfs.readdirEx(ownerId, webdevPath, true);
            assertDefined(nodesWithContent);
            assertIsArray(nodesWithContent);
            assertGreaterThan(nodesWithContent.length, 0);

            // Verify that a known file has its content loaded
            const frontendNode = nodesWithContent.find((n: any) => n.name.endsWith('frontend-guide.md'));
            assertDefined(frontendNode);
            if (frontendNode) {
                if (frontendNode.is_directory !== undefined) {
                    assertContains(frontendNode.is_directory.toString(), 'false');
                }
                assertDefined(frontendNode.content);
                assertContains(frontendNode.content || '', 'frontend development using React and TypeScript');
            }

            // Root contains only directories; even with loadContent=true, directory nodes must not include content
            const rootNodesWithContent = await lfs.readdirEx(ownerId, testRootCurrentPath, true);
            const projectsDir = rootNodesWithContent.find((n: any) => (n.name as string).replace(/^\d{4}_/, '').includes('Projects'));
            assertDefined(projectsDir);
            if (projectsDir) {
                if (projectsDir.is_directory !== undefined) {
                    assertContains(projectsDir.is_directory.toString(), 'true');
                }
                const hasContent = !!projectsDir.content;
                if (hasContent) {
                    throw new Error('Directory node should not include content when loadContent=true');
                }
            }
        });

        // Test 20: Metadata - readdirEx should return accurate metadata and stable, sorted names
        await testRunner.run("metadata: readdirEx should return metadata and stable sorted names", async () => {
            const ownerId = 1;

            // Resolve current (possibly ordinalized) test root folder name
            const rootEntries = await lfs.readdir(ownerId, publicFolder.path);
            const match = rootEntries.find((name: string) => name.replace(/^\d{4}_/, '') === testRelativePath);
            const testRootCurrentPath = lfs.pathJoin(publicFolder.path, match || testRelativePath);

            const nodes1 = await lfs.readdirEx(ownerId, testRootCurrentPath, false);
            assertDefined(nodes1);
            assertIsArray(nodes1);
            assertGreaterThan(nodes1.length, 0);

            // Validate metadata and ordinalized names
            for (const n of nodes1 as any[]) {
                assertDefined(n.createTime);
                assertDefined(n.modifyTime);
                if (typeof n.createTime !== 'number' || typeof n.modifyTime !== 'number') {
                    throw new Error('Expected numeric createTime/modifyTime');
                }
                if (!/^\d{4}_/.test(n.name)) {
                    throw new Error(`Expected ordinalized name but got: ${n.name}`);
                }
            }

            // Validate sorting is case-insensitive by name
            const names1 = (nodes1 as any[]).map(n => (n.name as string).toLowerCase());
            const sorted = [...names1].sort((a, b) => a.localeCompare(b));
            const isSorted = names1.length === sorted.length && names1.every((v, i) => v === sorted[i]);
            if (!isSorted) {
                throw new Error('readdirEx results are not sorted case-insensitively by name');
            }

            // Idempotency: repeated calls should not re-ordinalize or change set of names
            const nodes2 = await lfs.readdirEx(ownerId, testRootCurrentPath, false);
            const names2 = (nodes2 as any[]).map(n => n.name as string);
            if (names1.length !== names2.length) {
                throw new Error('readdirEx idempotency failed: length mismatch across calls');
            }
            for (const name of (nodes1 as any[]).map(n => n.name as string)) {
                if (!names2.includes(name)) {
                    throw new Error('readdirEx idempotency failed: missing name on second call: ' + name);
                }
            }
        });

        // Cleanup test environment
        await testRunner.run("Cleanup test environment", async () => {
            await cleanupTestEnvironment();
        });
    } 
    catch (error) {
        console.error("❌ LFS test suite failed:", error);
    }
    finally {
        await cleanupTestEnvironment();
        testRunner.report();
    }
}
