import { Server } from 'http';
import { run } from 'jest';
import { config } from './Config.js';

/**
 * Runs Jest tests programmatically after a specified delay.
 * Can optionally shut down the server after tests complete.
 * 
 * @param server The HTTP/HTTPS server instance to shut down if needed
 */
export async function runJestTests(
    server: Server,
): Promise<void> {
    const testWithCoverage = config.get("testWithCoverage") === "y";
    const exitAfterTests = config.get("exitAfterTest") === "y";

    console.log(`\n--- Scheduling Jest tests to run in 3 seconds ---`);

    // Set a timeout to run tests after the specified delay
    setTimeout(async () => {
        console.log("--- Running Jest tests programmatically ---");
        let exitCode = 0;
        try {
            // NOTE: For non-docker runs the 'jest.config.file' will be the same as the one in the root of the project, but for
            // docker runs, it will be a copy of the 'jest.docker.config.js' file.
            const jestArgs = [
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

