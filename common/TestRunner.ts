/**
 * A simple test runner utility that can be used by both client and server code
 * to execute tests and track results.
 */
export class TestRunner {
    private static globalFailCount: number = 0;
    private static suitesRun: string[] = [];
    
    private successCount: number = 0;
    private failCount: number = 0;
    private suiteName: string;

    /**
     * Create a new TestRunner instance
     * @param suiteName The name of the test suite for reporting purposes
     */
    constructor(suiteName: string) {
        this.suiteName = suiteName;
        // Track this test name globally
        if (!TestRunner.suitesRun.includes(suiteName)) {
            TestRunner.suitesRun.push(suiteName);
        }
    }

    /**
     * Run a test function and track its success/failure
     * @param testName The name of the test for logging purposes
     * @param testFunction The async function to execute as a test
     * @param rethrow Whether to re-throw errors after logging them (default: true)
     */
    async run(testName: string, testFunction: () => Promise<void>, rethrow: boolean = false): Promise<void> {
        console.log(`🧪 Running ${testName}...`);
        
        try {
            await testFunction();
            this.successCount++;
        } catch (error) {
            this.failCount++;
            TestRunner.globalFailCount++;
            console.error(`❌ Test failed: ${testName}`, error);
            if (rethrow) {
                throw error;
            }
        }
    }

    /**
     * Print a summary report of test results
     */
    report(): void {
        const total = this.successCount + this.failCount;
        let report = `\n________________________________________`;
        report += `\n📊 Test Results: ${this.suiteName}`;
        report += `\n✅ Successful: ${this.successCount}`;
        if (this.failCount > 0) {
            report += `\n❌ Failed: ${this.failCount}`;
            report += `\n📈 Total: ${total}`;
        }
        
        if (this.failCount === 0) {
            report += `\n🎉 All tests passed!`;
        } else {
            report += `\n⚠️  ${this.failCount} test(s) failed`;
        }
        
        // Show global failure count across all test runners
        const globalIcon = TestRunner.globalFailCount > 0 ? '❌❌❌' : '🌍';
        report += `\n${globalIcon} Global failures: ${TestRunner.globalFailCount}`;
        report += `\n📝 Suites Completed: ${TestRunner.suitesRun.join(', ')}`;
        report += `\n`;
        
        console.log(report);
    }

    /**
     * Get the current success count
     */
    getSuccessCount(): number {
        return this.successCount;
    }

    /**
     * Get the current failure count
     */
    getFailCount(): number {
        return this.failCount;
    }

    /**
     * Get the total number of tests run
     */
    getTotalCount(): number {
        return this.successCount + this.failCount;
    }

    /**
     * Reset the test counters
     */
    reset(): void {
        this.successCount = 0;
        this.failCount = 0;
    }

    /**
     * Get the global failure count across all test runners
     */
    static getGlobalFailCount(): number {
        return TestRunner.globalFailCount;
    }
}
