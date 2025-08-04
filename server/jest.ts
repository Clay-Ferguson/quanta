import { Server } from 'http';
import { run } from 'jest';

/**
 * Runs Jest tests programmatically after a specified delay.
 * Can optionally shut down the server after tests complete.
 * 
 * @param server The HTTP/HTTPS server instance to shut down if needed
 * @param testMatch The pattern to match test files
 * @param delayMs Delay in milliseconds before running tests
 * @param testWithCoverage Whether to run tests with code coverage
 * @param shouldExit Whether to exit the process after tests complete
 */
export async function runJestTests(
    server: Server,
    testMatch: string = '**/embedded-test.test.ts',
    delayMs: number = 3000,
    testWithCoverage: boolean = false,
    shouldExit: boolean = true
): Promise<void> {
    // Run Jest programmatically after a delay
    console.log(`\n--- Scheduling Jest tests to run in ${delayMs/1000} seconds ---`);

    // Set a timeout to run tests after the specified delay
    setTimeout(async () => {
        console.log("--- Running Jest tests programmatically ---");
        try {
            // Configure Jest arguments
            const jestArgs = [
                // '--forceExit',
                '--silent',
                '--testMatch',
                testMatch,
                '--no-cache'
            ];
            
            // Add coverage options if requested
            if (testWithCoverage) {
                console.log("Running with code coverage enabled");
                jestArgs.push('--coverage');
                jestArgs.push('--coverageReporters=text');
                jestArgs.push('--coverageReporters=lcov');
                jestArgs.push('--coverageDirectory=./coverage');
            }
            
            // Run the tests
            const result = await run(jestArgs);
            
            console.log(`Jest tests completed with exit code: ${result}`);
            
            if (testWithCoverage) {
                console.log("Coverage report generated in ./coverage directory");
            }
            
            if (shouldExit) {
                console.log("Shutting down server gracefully...");
                // Give time for any pending operations to complete
                setTimeout(() => {
                    server.close(() => {
                        console.log("Server has been gracefully shut down.");
                        if (shouldExit) {
                            process.exit(0);
                        }
                    });
                }, 1000);
            }
        } catch (error) {
            console.error('Error running Jest tests:', error);
            if (shouldExit) {
                setTimeout(() => {
                    server.close(() => {
                        console.log("Server has been gracefully shut down.");
                        if (shouldExit) {
                            process.exit(1);
                        }
                    });
                }, 1000);
            }
        }
    }, delayMs);
}
