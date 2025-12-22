import { docUtil } from "../DocUtil.js";

/**
 * Additional edge case tests for pathJoin that complement joinPathTest.ts
 * 
 * Focus areas:
 * - Unicode and special characters in filenames
 * - Backslash handling (Windows-style paths)
 * - Mixed slash styles
 * - Whitespace in paths
 * - Numeric path parts
 * - Boundary conditions (very long paths, deeply nested)
 * - Unusual but valid path patterns
 */
export async function joinPathTest2(): Promise<void> {
    try {
        console.log('=== VFS Join Path Test 2 (Edge Cases) Starting ===');

        // Test 1: Filenames with spaces
        const result1 = docUtil.pathJoin('my folder', 'my file.txt');
        const expected1 = 'my folder/my file.txt';
        console.log(`Test 1 - Spaces in names: Expected: '${expected1}', Got: '${result1}'`);
        if (result1 !== expected1) {
            throw new Error(`Test 1 failed! Expected: '${expected1}', Got: '${result1}'`);
        }

        // Test 2: Unicode characters in path
        const result2 = docUtil.pathJoin('文档', 'файл.txt');
        const expected2 = '文档/файл.txt';
        console.log(`Test 2 - Unicode chars: Expected: '${expected2}', Got: '${result2}'`);
        if (result2 !== expected2) {
            throw new Error(`Test 2 failed! Expected: '${expected2}', Got: '${result2}'`);
        }

        // Test 3: Emoji in filename
        const result3 = docUtil.pathJoin('notes', '📝readme.md');
        const expected3 = 'notes/📝readme.md';
        console.log(`Test 3 - Emoji in filename: Expected: '${expected3}', Got: '${result3}'`);
        if (result3 !== expected3) {
            throw new Error(`Test 3 failed! Expected: '${expected3}', Got: '${result3}'`);
        }

        // Test 4: Backslashes (Windows-style) - should be preserved as-is since normalizePath doesn't convert them
        const result4 = docUtil.pathJoin('folder\\subfolder', 'file.txt');
        const expected4 = 'folder\\subfolder/file.txt';
        console.log(`Test 4 - Backslashes: Expected: '${expected4}', Got: '${result4}'`);
        if (result4 !== expected4) {
            throw new Error(`Test 4 failed! Expected: '${expected4}', Got: '${result4}'`);
        }

        // Test 5: Deeply nested path (many levels)
        const result5 = docUtil.pathJoin('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'file.txt');
        const expected5 = 'a/b/c/d/e/f/g/h/i/j/file.txt';
        console.log(`Test 5 - Deep nesting: Expected: '${expected5}', Got: '${result5}'`);
        if (result5 !== expected5) {
            throw new Error(`Test 5 failed! Expected: '${expected5}', Got: '${result5}'`);
        }

        // Test 6: Numeric folder/file names
        const result6 = docUtil.pathJoin('123', '456', '789.txt');
        const expected6 = '123/456/789.txt';
        console.log(`Test 6 - Numeric names: Expected: '${expected6}', Got: '${result6}'`);
        if (result6 !== expected6) {
            throw new Error(`Test 6 failed! Expected: '${expected6}', Got: '${result6}'`);
        }

        // Test 7: Path with only a single dot (current directory reference)
        const result7 = docUtil.pathJoin('.', 'file.txt');
        const expected7 = 'file.txt';
        console.log(`Test 7 - Single dot prefix: Expected: '${expected7}', Got: '${result7}'`);
        if (result7 !== expected7) {
            throw new Error(`Test 7 failed! Expected: '${expected7}', Got: '${result7}'`);
        }

        // Test 8: Trailing slashes on all parts
        const result8 = docUtil.pathJoin('folder/', 'subfolder/', 'file.txt/');
        const expected8 = 'folder/subfolder/file.txt';
        console.log(`Test 8 - All trailing slashes: Expected: '${expected8}', Got: '${result8}'`);
        if (result8 !== expected8) {
            throw new Error(`Test 8 failed! Expected: '${expected8}', Got: '${result8}'`);
        }

        // Test 9: Very long filename
        const longName = 'a'.repeat(200) + '.txt';
        const result9 = docUtil.pathJoin('folder', longName);
        const expected9 = `folder/${longName}`;
        console.log(`Test 9 - Very long filename: Length=${result9.length}, Expected length=${expected9.length}`);
        if (result9 !== expected9) {
            throw new Error(`Test 9 failed! Expected length: ${expected9.length}, Got length: ${result9.length}`);
        }

        // Test 10: Special characters in filename (except path separators)
        const result10 = docUtil.pathJoin('folder', 'file@#$%^&()_+=-[]{}|;,.<>.txt');
        const expected10 = 'folder/file@#$%^&()_+=-[]{}|;,.<>.txt';
        console.log(`Test 10 - Special chars: Expected: '${expected10}', Got: '${result10}'`);
        if (result10 !== expected10) {
            throw new Error(`Test 10 failed! Expected: '${expected10}', Got: '${result10}'`);
        }

        // Test 11: Triple forward slashes between parts
        const result11 = docUtil.pathJoin('folder///subfolder', '///file.txt');
        const expected11 = 'folder/subfolder/file.txt';
        console.log(`Test 11 - Triple slashes: Expected: '${expected11}', Got: '${result11}'`);
        if (result11 !== expected11) {
            throw new Error(`Test 11 failed! Expected: '${expected11}', Got: '${result11}'`);
        }

        // Test 12: Mixed leading dots and slashes
        const result12 = docUtil.pathJoin('./././folder', 'file.txt');
        const expected12 = 'folder/file.txt';
        console.log(`Test 12 - Mixed dots/slashes prefix: Expected: '${expected12}', Got: '${result12}'`);
        if (result12 !== expected12) {
            throw new Error(`Test 12 failed! Expected: '${expected12}', Got: '${result12}'`);
        }

        // Test 13: Hidden file (Unix-style dotfile)
        const result13 = docUtil.pathJoin('folder', '.hidden', '.gitignore');
        const expected13 = 'folder/.hidden/.gitignore';
        console.log(`Test 13 - Hidden files: Expected: '${expected13}', Got: '${result13}'`);
        if (result13 !== expected13) {
            throw new Error(`Test 13 failed! Expected: '${expected13}', Got: '${result13}'`);
        }

        // Test 14: File with multiple extensions
        const result14 = docUtil.pathJoin('folder', 'archive.tar.gz');
        const expected14 = 'folder/archive.tar.gz';
        console.log(`Test 14 - Multiple extensions: Expected: '${expected14}', Got: '${result14}'`);
        if (result14 !== expected14) {
            throw new Error(`Test 14 failed! Expected: '${expected14}', Got: '${result14}'`);
        }

        // Test 15: Path part that is just slashes
        const result15 = docUtil.pathJoin('folder', '///', 'file.txt');
        const expected15 = 'folder/file.txt';
        console.log(`Test 15 - Slash-only part: Expected: '${expected15}', Got: '${result15}'`);
        if (result15 !== expected15) {
            throw new Error(`Test 15 failed! Expected: '${expected15}', Got: '${result15}'`);
        }

        // Test 16: Single character names
        const result16 = docUtil.pathJoin('a', 'b', 'c');
        const expected16 = 'a/b/c';
        console.log(`Test 16 - Single char names: Expected: '${expected16}', Got: '${result16}'`);
        if (result16 !== expected16) {
            throw new Error(`Test 16 failed! Expected: '${expected16}', Got: '${result16}'`);
        }

        // Test 17: Path with tab or newline characters (unusual but possible)
        const result17 = docUtil.pathJoin('folder\twith\ttabs', 'file.txt');
        const expected17 = 'folder\twith\ttabs/file.txt';
        console.log(`Test 17 - Tab chars (should preserve): Got: '${result17}'`);
        if (result17 !== expected17) {
            throw new Error(`Test 17 failed! Expected: '${expected17}', Got: '${result17}'`);
        }

        // Test 18: Case sensitivity preservation
        const result18 = docUtil.pathJoin('Folder', 'SubFolder', 'FILE.TXT');
        const expected18 = 'Folder/SubFolder/FILE.TXT';
        console.log(`Test 18 - Case preservation: Expected: '${expected18}', Got: '${result18}'`);
        if (result18 !== expected18) {
            throw new Error(`Test 18 failed! Expected: '${expected18}', Got: '${result18}'`);
        }

        // Test 19: Path with parent directory references preserved (.. not resolved)
        const result19 = docUtil.pathJoin('a/b', '..', 'c');
        const expected19 = 'a/b/../c';
        console.log(`Test 19 - Parent refs preserved: Expected: '${expected19}', Got: '${result19}'`);
        if (result19 !== expected19) {
            throw new Error(`Test 19 failed! Expected: '${expected19}', Got: '${result19}'`);
        }

        // Test 20: Combining pre-joined path with additional parts
        const result20 = docUtil.pathJoin('a/b/c', 'd/e/f');
        const expected20 = 'a/b/c/d/e/f';
        console.log(`Test 20 - Pre-joined paths: Expected: '${expected20}', Got: '${result20}'`);
        if (result20 !== expected20) {
            throw new Error(`Test 20 failed! Expected: '${expected20}', Got: '${result20}'`);
        }

        console.log('✅ All joinPath edge case tests passed');
        console.log('=== VFS Join Path Test 2 (Edge Cases) Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Join Path Test 2 (Edge Cases) Failed ===');
        console.error('Error during VFS joinPath test 2:', error);
        throw error;
    }
}
