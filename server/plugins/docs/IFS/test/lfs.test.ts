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
import { docSvc } from '../../DocService.js';
import { config } from '../../../../Config.js';

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
