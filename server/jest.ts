import { Server } from 'http';
import { run } from 'jest';

/**
 * Runs Jest tests programmatically after a specified delay.
 * Can optionally shut down the server after tests complete.
 * 
 * @param server The HTTP/HTTPS server instance to shut down if needed
 * @param delayMs Delay in milliseconds before running tests
 * @param testWithCoverage Whether to run tests with code coverage
 * @param exitAfterTests Whether to exit the process after tests complete
 */
export async function runJestTests(
    server: Server,
    testWithCoverage: boolean = false,
    exitAfterTests: boolean = true
): Promise<void> {
    console.log(`\n--- Scheduling Jest tests to run in 3 seconds ---`);

    // Set a timeout to run tests after the specified delay
    setTimeout(async () => {
        console.log("--- Running Jest tests programmatically ---");
        let exitCode = 0;
        try {
            // Configure Jest arguments - use config file for most settings
            const jestArgs = [
                // '--forceExit',
                '--silent',
                '--config=jest.config.js'
            ];
            
            // Add coverage options if requested
            if (testWithCoverage) {
                // WARNING: This code currently fails. We get lots of import errors.
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
        } catch (error) {
            console.error('Error running Jest tests:', error);
            exitCode = 1; // Set exit code to 1 if tests fail
        }
        finally {
            if (exitAfterTests) {
                console.log("Shutting down server gracefully...");
                // Give time for any pending operations to complete
                setTimeout(() => {
                    server.close(() => {
                        console.log("Server has been gracefully shut down.");
                        if (exitAfterTests) {
                            process.exit(exitCode);
                        }
                    });
                }, 1000);
            }
        }
    }, 3000);
}

