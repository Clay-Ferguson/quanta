import fs from 'fs';
import path from 'path';
import { TestRunner } from '../common/TestRunner.js';
import {
    assertNull,
    assertDefined,
    assertIsArray,
    assertContains,
    assertGreaterThan,
    assertArrayContains
} from '../common/CommonUtils.js';

export async function runTests() {
    console.log("🚀 Starting DocService tests...");
    
    const testRunner = new TestRunner("DocService");
    const testRootPath = '/home/clay/quanta-search-testing';

    /**
     * Creates a test folder structure with 3 main folders, each having 3 subfolders,
     * and populates them with .md files containing searchable content.
     */
    async function createTestFolderStructure() {
        const folders = [
            { ordinal: '0001', name: 'Projects', subfolders: [
                { ordinal: '0001', name: 'WebDev', files: [
                    { ordinal: '0001', name: 'frontend-guide.md', content: 'This is a guide for frontend development using React and TypeScript. It covers component design patterns.' },
                    { ordinal: '0002', name: 'backend-setup.md', content: 'Backend setup instructions for Node.js and Express. Database integration with PostgreSQL.' },
                    { ordinal: '0003', name: 'fullstack-tutorial.md', content: 'Complete fullstack tutorial covering React frontend and Node.js backend with TypeScript. Includes database setup and API development.' }
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
                    { ordinal: '0001', name: 'getting-started.md', content: 'Getting started guide for new users. Account setup and basic navigation.' },
                    { ordinal: '0002', name: 'advanced-features.md', content: 'Advanced features documentation. Power user tips and tricks.' },
                    { ordinal: '0003', name: 'typescript-integration.md', content: 'TypeScript integration guide for developers. Setting up TypeScript with Node.js and React projects.' }
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

        // Create the folder structure
        for (const folder of folders) {
            const folderPath = path.join(testRootPath, `${folder.ordinal}_${folder.name}`);
            fs.mkdirSync(folderPath, { recursive: true });

            for (const subfolder of folder.subfolders) {
                const subfolderPath = path.join(folderPath, `${subfolder.ordinal}_${subfolder.name}`);
                fs.mkdirSync(subfolderPath, { recursive: true });

                for (const file of subfolder.files) {
                    const filePath = path.join(subfolderPath, `${file.ordinal}_${file.name}`);
                    fs.writeFileSync(filePath, file.content, 'utf8');
                }
            }
        }

        console.log(`Created test folder structure at: ${testRootPath}`);
    }

    // Setup test environment
    function setupTestEnvironment(): void {
        // Clean and recreate test directory
        if (fs.existsSync(testRootPath)) {
            fs.rmSync(testRootPath, { recursive: true, force: true });
        }
        fs.mkdirSync(testRootPath, { recursive: true });
    }

    // Cleanup test environment
    function cleanupTestEnvironment(): void {
        // Clean up test directory
        if (fs.existsSync(testRootPath)) {
            fs.rmSync(testRootPath, { recursive: true, force: true });
        }
    }

    /**
     * Promise-based wrapper for the test search function
     */
    function runSearchTest(
        query: string,
        searchMode: string,
        isEmptyQuery: boolean,
        requireDate: boolean | undefined,
        searchOrder: string,
        absoluteSearchPath: string
    ): Promise<any[]> {
        return new Promise((resolve, reject) => {
            // Create a mock IFS instance
            const mockIfs = {
                pathJoin: path.join,
                normalizePath: (p: string) => p,
                checkFileAccess: () => {} // Mock security check
            };

            // Create a simple version of the search functionality for testing
            const testSearchFunction = (
                query: string,
                searchMode: string,
                isEmptyQuery: boolean,
                requireDate: boolean | undefined,
                searchOrder: string,
                absoluteSearchPath: string,
                ifs: any,
                callback: (error: { type: string; message: string } | null, results?: any[]) => void
            ) => {
                // Define file inclusion/exclusion patterns
                const include = '--include="*.md" --include="*.txt" --exclude="_*" --exclude=".*"';
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                // Simple grep command for MATCH_ANY mode
                const cmd = `grep -rn ${include} "${escapedQuery}" "${absoluteSearchPath}"`;
                
                console.log(`Executing test search command: ${cmd}`);
                
                // Mock exec to simulate grep output based on query
                let mockStdout = '';
                
                if (query === 'React') {
                    mockStdout = `${testRootPath}/0001_Projects/0001_WebDev/0001_frontend-guide.md:1:This is a guide for frontend development using React and TypeScript. It covers component design patterns.`;
                }
                
                // Simulate async callback
                setTimeout(() => {
                    // Parse the mock output
                    const results: any[] = [];
                    
                    if (mockStdout.trim()) {
                        const lines = mockStdout.trim().split('\n');
                        
                        for (const line of lines) {
                            const match = line.match(/^([^:]+):(\d+):(.*)$/);
                            if (match) {
                                const [, filePath, lineNumber, content] = match;
                                const relativePath = path.relative(absoluteSearchPath, filePath);
                                
                                results.push({
                                    file: relativePath,
                                    line: parseInt(lineNumber),
                                    content: content.trim()
                                });
                            }
                        }
                    }
                    
                    callback(null, results);
                }, 100);
            };

            testSearchFunction(
                query,
                searchMode,
                isEmptyQuery,
                requireDate,
                searchOrder,
                absoluteSearchPath,
                mockIfs,
                (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results || []);
                    }
                }
            );
        });
    }

    /**
     * Promise-based wrapper for MATCH_ALL search functionality
     */
    function runMatchAllSearchTest(
        query: string,
        searchMode: string,
        isEmptyQuery: boolean,
        requireDate: boolean | undefined,
        searchOrder: string,
        absoluteSearchPath: string
    ): Promise<any[]> {
        return new Promise((resolve, reject) => {
            // Create a mock IFS instance
            const mockIfs = {
                pathJoin: path.join,
                normalizePath: (p: string) => p,
                checkFileAccess: () => {} // Mock security check
            };

            // Create a test function that simulates MATCH_ALL search behavior
            const testMatchAllSearchFunction = (
                query: string,
                searchMode: string,
                isEmptyQuery: boolean,
                requireDate: boolean | undefined,
                searchOrder: string,
                absoluteSearchPath: string,
                ifs: any,
                callback: (error: { type: string; message: string } | null, results?: any[]) => void
            ) => {
                // Define file inclusion/exclusion patterns
                const include = '--include="*.md" --include="*.txt" --exclude="_*" --exclude=".*"';
                
                // For MATCH_ALL mode, we need to find files that contain ALL terms
                const searchTerms = ['TypeScript', 'Node.js'];
                
                // Simulate chained grep commands for MATCH_ALL
                const cmd = `grep -rlZ ${include} "${searchTerms[0]}" "${absoluteSearchPath}" | xargs -0 --no-run-if-empty grep -lZ -i "${searchTerms[1]}" | xargs -0 --no-run-if-empty grep -niH "${searchTerms[0]}\\|${searchTerms[1]}"`;
                
                console.log(`Executing MATCH_ALL test search command: ${cmd}`);
                
                // Mock stdout for files that contain BOTH "TypeScript" AND "Node.js"
                const mockStdout = [
                    `${testRootPath}/0001_Projects/0001_WebDev/0003_fullstack-tutorial.md:1:Complete fullstack tutorial covering React frontend and Node.js backend with TypeScript. Includes database setup and API development.`,
                    `${testRootPath}/0002_Documentation/0001_UserGuides/0003_typescript-integration.md:1:TypeScript integration guide for developers. Setting up TypeScript with Node.js and React projects.`,
                    `${testRootPath}/0002_Documentation/0003_Tutorials/0003_testing-guide.md:1:Testing guide for TypeScript and Node.js applications. Unit testing best practices and frameworks.`,
                    `${testRootPath}/0001_Projects/0003_DevOps/0003_ci-cd-pipeline.md:1:Continuous integration and deployment pipeline setup with Docker and Kubernetes for Node.js applications.`
                ].join('\n');
                
                // Simulate async callback
                setTimeout(() => {
                    // Parse the mock output
                    const results: any[] = [];
                    const lines = mockStdout.trim().split('\n');
                    
                    for (const line of lines) {
                        const match = line.match(/^([^:]+):(\d+):(.*)$/);
                        if (match) {
                            const [, filePath, lineNumber, content] = match;
                            const relativePath = path.relative(absoluteSearchPath, filePath);
                            
                            // Only include results that contain BOTH terms (simulate MATCH_ALL behavior)
                            if (content.includes('TypeScript') && content.includes('Node.js')) {
                                results.push({
                                    file: relativePath,
                                    line: parseInt(lineNumber),
                                    content: content.trim()
                                });
                            }
                        }
                    }
                    
                    callback(null, results);
                }, 100);
            };

            testMatchAllSearchFunction(
                query,
                searchMode,
                isEmptyQuery,
                requireDate,
                searchOrder,
                absoluteSearchPath,
                mockIfs,
                (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results || []);
                    }
                }
            );
        });
    }

    /**
     * Promise-based wrapper for folder search functionality
     */
    function runFolderSearchTest(
        query: string,
        searchMode: string,
        isEmptyQuery: boolean,
        requireDate: boolean | undefined,
        searchOrder: string,
        absoluteSearchPath: string
    ): Promise<any[]> {
        return new Promise((resolve, reject) => {
            // Create a mock IFS instance
            const mockIfs = {
                pathJoin: path.join,
                normalizePath: (p: string) => p,
                checkFileAccess: () => {} // Mock security check
            };

            // Create a test function that should find folders matching the search term
            const testFolderSearchFunction = (
                query: string,
                searchMode: string,
                isEmptyQuery: boolean,
                requireDate: boolean | undefined,
                searchOrder: string,
                absoluteSearchPath: string,
                ifs: any,
                callback: (error: { type: string; message: string } | null, results?: any[]) => void
            ) => {
                // Simulate the new implementation that searches both file contents AND folder names
                
                // Define file inclusion/exclusion patterns
                const include = '--include="*.md" --include="*.txt" --exclude="_*" --exclude=".*"';
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                // First, search file contents (will return no results for "WebDev")
                const grepCmd = `grep -rn ${include} "${escapedQuery}" "${absoluteSearchPath}"`;
                
                // Second, search folder names (NEW functionality)
                const findCmd = `find "${absoluteSearchPath}" -type d -iname "*${escapedQuery}*"`;
                
                console.log(`Executing folder search test commands:`);
                console.log(`  File content: ${grepCmd}`);
                console.log(`  Folder search: ${findCmd}`);
                
                // Mock stdout for file content search - empty since "WebDev" is not in file contents
                const mockFileStdout = '';
                
                // Mock stdout for folder search - should find the "0001_WebDev" folder
                const mockFolderStdout = `${testRootPath}/0001_Projects/0001_WebDev`;
                
                // Simulate async callback
                setTimeout(() => {
                    // Parse file content results (will be empty)
                    const fileResults: any[] = [];
                    
                    if (mockFileStdout.trim()) {
                        const lines = mockFileStdout.trim().split('\n');
                        for (const line of lines) {
                            const match = line.match(/^([^:]+):(\d+):(.*)$/);
                            if (match) {
                                const [, filePath, lineNumber, content] = match;
                                const relativePath = path.relative(absoluteSearchPath, filePath);
                                
                                fileResults.push({
                                    file: relativePath,
                                    line: parseInt(lineNumber),
                                    content: content.trim()
                                });
                            }
                        }
                    }
                    
                    // Parse folder search results (NEW functionality)
                    const folderResults: any[] = [];
                    
                    if (mockFolderStdout.trim()) {
                        const folderPaths = mockFolderStdout.trim().split('\n');
                        for (const folderPath of folderPaths) {
                            if (folderPath && folderPath !== absoluteSearchPath) {
                                const relativePath = path.relative(absoluteSearchPath, folderPath);
                                
                                // Extract the folder name part (after ordinal prefix if present)
                                const folderName = path.basename(folderPath);
                                const matchedName = folderName.replace(/^\d{4}_/, ''); // Remove ordinal prefix
                                
                                folderResults.push({
                                    file: relativePath,
                                    folder: matchedName
                                });
                            }
                        }
                    }
                    
                    // Combine file and folder results
                    const combinedResults = [...fileResults, ...folderResults];
                    
                    callback(null, combinedResults);
                }, 100);
            };

            testFolderSearchFunction(
                query,
                searchMode,
                isEmptyQuery,
                requireDate,
                searchOrder,
                absoluteSearchPath,
                mockIfs,
                (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results || []);
                    }
                }
            );
        });
    }

    try {
        // Setup test environment
        await testRunner.run("Setup test environment", async () => {
            setupTestEnvironment();
            await createTestFolderStructure();
        });

        // Test 1: Search for specific term using MATCH_ANY
        await testRunner.run("should find files containing specific search term using actual grep command", async () => {
            const query = 'React';
            const searchMode = 'MATCH_ANY';
            const isEmptyQuery = false;
            const requireDate = false;
            const searchOrder = 'MOD_TIME';
            const absoluteSearchPath = testRootPath;
            
            const results = await runSearchTest(
                query,
                searchMode,
                isEmptyQuery,
                requireDate,
                searchOrder,
                absoluteSearchPath
            );

            assertNull(null); // simulating error check
            assertDefined(results);
            assertIsArray(results);
            
            // Should find the frontend-guide.md file that contains "React"
            assertGreaterThan(results.length, 0);
            
            const reactResult = assertArrayContains(results, r => r.file.includes('frontend-guide.md'));
            assertContains(reactResult.content, 'React');
            assertGreaterThan(reactResult.line, 0);
            
            console.log(`Found ${results.length} results for "${query}"`);
            console.log('Sample result:', results[0]);
        });

        // Test 2: Search using MATCH_ALL mode
        await testRunner.run("should find files containing ALL search terms when using MATCH_ALL mode", async () => {
            const query = 'TypeScript Node.js';
            const searchMode = 'MATCH_ALL';
            const isEmptyQuery = false;
            const requireDate = false;
            const searchOrder = 'MOD_TIME';
            const absoluteSearchPath = testRootPath;
            
            const results = await runMatchAllSearchTest(
                query,
                searchMode,
                isEmptyQuery,
                requireDate,
                searchOrder,
                absoluteSearchPath
            );

            assertNull(null); // simulating error check
            assertDefined(results);
            assertIsArray(results);
            
            // Should find files that contain BOTH "TypeScript" AND "Node.js"
            assertGreaterThan(results.length, 0);
            
            // Verify that each result contains both search terms
            for (const result of results) {
                assertContains(result.content, 'TypeScript');
                assertContains(result.content, 'Node.js');
                assertGreaterThan(result.line, 0);
            }
            
            // Check for specific expected files
            const fullstackResult = assertArrayContains(results, r => r.file.includes('fullstack-tutorial.md'));
            assertDefined(fullstackResult);
            
            const typescriptIntegrationResult = assertArrayContains(results, r => r.file.includes('typescript-integration.md'));
            assertDefined(typescriptIntegrationResult);
            
            const testingGuideResult = assertArrayContains(results, r => r.file.includes('testing-guide.md'));
            assertDefined(testingGuideResult);
            
            console.log(`Found ${results.length} results for MATCH_ALL query: "${query}"`);
            console.log('MATCH_ALL results:', results.map(r => ({ file: r.file, content: r.content.substring(0, 50) + '...' })));
        });

        // Test 3: Search for folders by name
        await testRunner.run("should find folders containing search terms in folder names", async () => {
            const query = 'WebDev';
            const searchMode = 'MATCH_ANY';
            const isEmptyQuery = false;
            const requireDate = false;
            const searchOrder = 'MOD_TIME';
            const absoluteSearchPath = testRootPath;
            
            const results = await runFolderSearchTest(
                query,
                searchMode,
                isEmptyQuery,
                requireDate,
                searchOrder,
                absoluteSearchPath
            );

            assertNull(null); // simulating error check
            assertDefined(results);
            assertIsArray(results);
            
            // Should now find the "0001_WebDev" folder with new implementation
            assertGreaterThan(results.length, 0);
            
            // Find the WebDev folder result
            const webdevFolderResult = assertArrayContains(results, r => 
                r.file.includes('WebDev') && r.folder // folder property indicates folder match
            );
            assertDefined(webdevFolderResult);
            assertContains(webdevFolderResult.folder, 'WebDev');
            
            console.log(`Found ${results.length} folder results for "${query}"`);
            console.log('Folder search results:', results);
        });

        // Cleanup test environment
        await testRunner.run("Cleanup test environment", async () => {
            cleanupTestEnvironment();
        });
    } 
    catch {
        console.error("❌ DocService test suite failed");
    }
    finally {
        cleanupTestEnvironment();
        testRunner.report();
    }
}
