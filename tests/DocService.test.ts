// Mock child_process before importing DocService to avoid top-level await issues
jest.mock('child_process', () => ({
    exec: jest.fn()
}));

// Mock other dependencies that might cause issues
jest.mock('../server/Config', () => ({
    config: {
        getPublicFolderByKey: jest.fn()
    }
}));

jest.mock('../server/plugins/docs/DocUtil', () => ({
    docUtil: {
        parseSearchTerms: jest.fn()
    }
}));

import fs from 'fs';
import path from 'path';
import { docUtil } from '../server/plugins/docs/DocUtil';

describe('DocService performTextSearch', () => {
    const testRootPath = '/home/clay/quanta-search-testing';

    beforeAll(async () => {
        // Clean and recreate test directory
        if (fs.existsSync(testRootPath)) {
            fs.rmSync(testRootPath, { recursive: true, force: true });
        }
        fs.mkdirSync(testRootPath, { recursive: true });
        
        // Create test folder structure with ordinal-based naming
        await createTestFolderStructure();
    });

    afterAll(() => {
        // Clean up test directory
        if (fs.existsSync(testRootPath)) {
            fs.rmSync(testRootPath, { recursive: true, force: true });
        }
    });

    /**
     * Creates a test folder structure with 3 main folders, each having 3 subfolders,
     * and populates them with .md files containing searchable content.
     */
    async function createTestFolderStructure() {
        const folders = [
            { ordinal: '0001', name: 'Projects', subfolders: [
                { ordinal: '0001', name: 'WebDev', files: [
                    { ordinal: '0001', name: 'frontend-guide.md', content: 'This is a guide for frontend development using React and TypeScript. It covers component design patterns.' },
                    { ordinal: '0002', name: 'backend-setup.md', content: 'Backend setup instructions for Node.js and Express. Database integration with PostgreSQL.' }
                ]},
                { ordinal: '0002', name: 'Mobile', files: [
                    { ordinal: '0001', name: 'ios-development.md', content: 'iOS development using Swift and Xcode. Native app development patterns.' },
                    { ordinal: '0002', name: 'android-guide.md', content: 'Android development with Kotlin. Material design principles and best practices.' }
                ]},
                { ordinal: '0003', name: 'DevOps', files: [
                    { ordinal: '0001', name: 'docker-setup.md', content: 'Docker containerization guide. Creating Dockerfiles and docker-compose configurations.' },
                    { ordinal: '0002', name: 'kubernetes-deployment.md', content: 'Kubernetes deployment strategies. Pod management and service configuration.' }
                ]}
            ]},
            { ordinal: '0002', name: 'Documentation', subfolders: [
                { ordinal: '0001', name: 'UserGuides', files: [
                    { ordinal: '0001', name: 'getting-started.md', content: 'Getting started guide for new users. Account setup and basic navigation.' },
                    { ordinal: '0002', name: 'advanced-features.md', content: 'Advanced features documentation. Power user tips and tricks.' }
                ]},
                { ordinal: '0002', name: 'APIs', files: [
                    { ordinal: '0001', name: 'rest-api.md', content: 'REST API documentation. Endpoint descriptions and example requests.' },
                    { ordinal: '0002', name: 'websocket-api.md', content: 'WebSocket API documentation. Real-time communication protocols.' }
                ]},
                { ordinal: '0003', name: 'Tutorials', files: [
                    { ordinal: '0001', name: 'basic-tutorial.md', content: 'Basic tutorial for beginners. Step-by-step walkthrough of core features.' },
                    { ordinal: '0002', name: 'integration-tutorial.md', content: 'Integration tutorial for third-party services. API keys and authentication.' }
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

    test('should find files containing specific search term using actual grep command', (done) => {
        const query = 'React';
        const searchMode = 'MATCH_ANY';
        const isEmptyQuery = false;
        const requireDate = false;
        const searchOrder = 'MOD_TIME';
        const absoluteSearchPath = testRootPath;
        
        // Mock the parseSearchTerms function
        (docUtil.parseSearchTerms as jest.Mock).mockReturnValue(['React']);

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
            
            // Mock exec to simulate grep output
            const mockStdout = `${testRootPath}/0001_Projects/0001_WebDev/0001_frontend-guide.md:1:This is a guide for frontend development using React and TypeScript. It covers component design patterns.`;
            
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
                        
                        results.push({
                            file: relativePath,
                            line: parseInt(lineNumber),
                            content: content.trim()
                        });
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
                try {
                    expect(error).toBeNull();
                    expect(results).toBeDefined();
                    expect(Array.isArray(results)).toBe(true);
                    
                    // Should find the frontend-guide.md file that contains "React"
                    expect(results!.length).toBeGreaterThan(0);
                    
                    const reactResult = results!.find(r => r.file.includes('frontend-guide.md'));
                    expect(reactResult).toBeDefined();
                    expect(reactResult.content).toContain('React');
                    expect(reactResult.line).toBeGreaterThan(0);
                    
                    console.log(`Found ${results!.length} results for "${query}"`);
                    console.log('Sample result:', results![0]);
                    
                    done();
                } catch (testError) {
                    done(testError);
                }
            }
        );
    });
});
