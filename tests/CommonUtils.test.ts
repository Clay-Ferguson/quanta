import {
    isImageFile,
    isTextFile,
    isImageExt,
    getImageContentType,
    formatDate,
    formatDateTime,
    getFilenameExtension,
    formatDisplayName,
    stripOrdinal,
    formatFullPath,
    createClickablePathComponents
} from '../common/CommonUtils.js';
import { TestRunner } from '../common/TestRunner.js';

/**
 * Simple assertion function that throws an error if the condition is false
 */
function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Assertion function for checking equality
 */
function assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
        const msg = message || `Expected ${expected}, but got ${actual}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking if a string contains another string
 */
function assertContains(haystack: string, needle: string, message?: string): void {
    if (!haystack.includes(needle)) {
        const msg = message || `Expected "${haystack}" to contain "${needle}"`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking if a string matches a regex pattern
 */
function assertMatches(str: string, pattern: RegExp, message?: string): void {
    if (!pattern.test(str)) {
        const msg = message || `Expected "${str}" to match pattern ${pattern}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking array length
 */
function assertArrayLength<T>(array: T[], expectedLength: number, message?: string): void {
    if (array.length !== expectedLength) {
        const msg = message || `Expected array length ${expectedLength}, but got ${array.length}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

/**
 * Assertion function for checking object equality (deep comparison)
 */
function assertObjectEqual<T>(actual: T, expected: T, message?: string): void {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        const msg = message || `Expected ${expectedStr}, but got ${actualStr}`;
        throw new Error(`Assertion failed: ${msg}`);
    }
}

export async function runTests() {
    console.log("🚀 Starting CommonUtils tests...");
    
    const testRunner = new TestRunner("CommonUtils");
    
    // try {
    // File Type Detection Tests
    await testRunner.run("isImageFile - should identify image files correctly", async () => {
        assert(isImageFile('photo.jpg'), 'Should identify jpg files');
        assert(isImageFile('image.png'), 'Should identify png files');
        assert(isImageFile('animation.gif'), 'Should identify gif files');
        assert(isImageFile('vector.svg'), 'Should identify svg files');
        assert(isImageFile('Picture.JPEG'), 'Should be case insensitive');
    });

    await testRunner.run("isImageFile - should reject non-image files", async () => {
        assert(!isImageFile('document.txt'), 'Should reject txt files');
        assert(!isImageFile('script.js'), 'Should reject js files');
        assert(!isImageFile('data.json'), 'Should reject json files');
        assert(!isImageFile('noextension'), 'Should reject files without extension');
    });

    await testRunner.run("isTextFile - should identify text files correctly", async () => {
        assert(isTextFile('readme.md'), 'Should identify md files');
        assert(isTextFile('config.json'), 'Should identify json files');
        assert(isTextFile('script.js'), 'Should identify js files');
        assert(isTextFile('styles.css'), 'Should identify css files');
        assert(isTextFile('Document.TXT'), 'Should be case insensitive');
    });

    await testRunner.run("isTextFile - should reject non-text files", async () => {
        assert(!isTextFile('image.jpg'), 'Should reject jpg files');
        assert(!isTextFile('binary.exe'), 'Should reject exe files');
        assert(!isTextFile('noextension'), 'Should reject files without extension');
    });

    await testRunner.run("isImageExt - should handle extensions with dots", async () => {
        assert(isImageExt('.jpg'), 'Should identify .jpg extension');
        assert(isImageExt('.PNG'), 'Should be case insensitive');
        assert(!isImageExt('.txt'), 'Should reject .txt extension');
    });

    await testRunner.run("isImageExt - should handle extensions without dots", async () => {
        assert(!isImageExt('jpg'), 'Should expect dot prefix');
        assert(!isImageExt('png'), 'Should expect dot prefix');
    });

    // Content Type Detection Tests
    await testRunner.run("getImageContentType - should return correct MIME types", async () => {
        assertEqual(getImageContentType('image.png'), 'image/png');
        assertEqual(getImageContentType('animation.gif'), 'image/gif');
        assertEqual(getImageContentType('bitmap.bmp'), 'image/bmp');
        assertEqual(getImageContentType('photo.webp'), 'image/webp');
    });

    await testRunner.run("getImageContentType - should default to jpeg for jpg files", async () => {
        assertEqual(getImageContentType('photo.jpg'), 'image/jpeg');
        assertEqual(getImageContentType('image.jpeg'), 'image/jpeg');
    });

    await testRunner.run("getImageContentType - should handle case insensitivity", async () => {
        assertEqual(getImageContentType('IMAGE.PNG'), 'image/png');
        assertEqual(getImageContentType('Photo.JPG'), 'image/jpeg');
    });

    await testRunner.run("getImageContentType - should default to jpeg for unknown extensions", async () => {
        assertEqual(getImageContentType('file.unknown'), 'image/jpeg');
        assertEqual(getImageContentType('noextension'), 'image/jpeg');
    });

    // Date Formatting Tests
    await testRunner.run("formatDate - should format timestamp to readable date", async () => {
        const timestamp = 1642780800000; // January 21, 2022 08:00:00 UTC
        const result = formatDate(timestamp);
        assertContains(result, '2022', 'Should contain the year');
        assertEqual(typeof result, 'string', 'Should return a string');
        assert(result.length > 5, 'Should return a meaningful date string');
    });

    await testRunner.run("formatDateTime - should format timestamp with specific locale format", async () => {
        const timestamp = 1642780800000;
        const result = formatDateTime(timestamp);
        assertEqual(typeof result, 'string', 'Should return a string');
        assertMatches(result, /\d{2}\/\d{2}\/\d{4}/, 'Should match MM/DD/YYYY format');
    });

    // Path and Filename Utilities Tests
    await testRunner.run("getFilenameExtension - should extract file extensions correctly", async () => {
        assertEqual(getFilenameExtension('/path/to/file.txt'), '.txt');
        assertEqual(getFilenameExtension('document.pdf'), '.pdf');
        assertEqual(getFilenameExtension('archive.tar.gz'), '.gz');
    });

    await testRunner.run("getFilenameExtension - should handle files without extensions", async () => {
        assertEqual(getFilenameExtension('README'), '');
        assertEqual(getFilenameExtension('/path/to/folder/'), '');
        assertEqual(getFilenameExtension('file.'), '');
    });

    await testRunner.run("getFilenameExtension - should handle edge cases", async () => {
        assertEqual(getFilenameExtension(''), '');
        assertEqual(getFilenameExtension('.'), '');
        assertEqual(getFilenameExtension('..'), '');
        assertEqual(getFilenameExtension('.hidden'), '.hidden');
    });

    await testRunner.run("stripOrdinal - should remove ordinal prefixes", async () => {
        assertEqual(stripOrdinal('01_introduction.md'), 'introduction.md');
        assertEqual(stripOrdinal('999_final_chapter.txt'), 'final_chapter.txt');
        assertEqual(stripOrdinal('abc_document.pdf'), 'document.pdf');
    });

    await testRunner.run("stripOrdinal - should handle files without ordinals", async () => {
        assertEqual(stripOrdinal('document.txt'), 'document.txt');
        assertEqual(stripOrdinal('no-underscore.md'), 'no-underscore.md');
    });

    await testRunner.run("stripOrdinal - should handle multiple underscores", async () => {
        assertEqual(stripOrdinal('01_chapter_one_intro.md'), 'chapter_one_intro.md');
    });

    await testRunner.run("formatDisplayName - should format names for display", async () => {
        assertEqual(formatDisplayName('01_hello_world'), 'Hello World');
        assertEqual(formatDisplayName('02_advanced-topics'), 'Advanced Topics');
        assertEqual(formatDisplayName('user_profile_settings'), 'Profile Settings');
    });

    await testRunner.run("formatDisplayName - should preserve trailing underscores", async () => {
        assertEqual(formatDisplayName('01_pullup_topic_'), 'Pullup Topic_');
        assertEqual(formatDisplayName('chapter_end_'), 'End_');
    });

    await testRunner.run("formatDisplayName - should handle .Md extension conversion", async () => {
        assertEqual(formatDisplayName('01_readme.Md'), 'Readme.md');
        assertEqual(formatDisplayName('chapter.MD'), 'Chapter.MD'); // Only .Md, not .MD
    });

    await testRunner.run("formatFullPath - should format complete paths", async () => {
        assertEqual(formatFullPath('/docs/01_intro/02_getting_started'), 'Docs / Intro / Getting Started');
        assertEqual(formatFullPath('/user/profile/settings'), 'User / Profile / Settings');
    });

    await testRunner.run("formatFullPath - should handle root and empty paths", async () => {
        assertEqual(formatFullPath('/'), '');
        assertEqual(formatFullPath(''), '');
    });

    await testRunner.run("formatFullPath - should handle single level paths", async () => {
        assertEqual(formatFullPath('/home'), 'Home');
        assertEqual(formatFullPath('/01_introduction'), 'Introduction');
    });

    await testRunner.run("createClickablePathComponents - should create navigation components", async () => {
        const result = createClickablePathComponents('/docs/tutorials/01_basic/02_advanced');
            
        assertArrayLength(result, 4);
        assertObjectEqual(result[0], {
            displayName: 'Docs',
            navigationPath: '/docs'
        });
        assertObjectEqual(result[1], {
            displayName: 'Tutorials',
            navigationPath: '/docs/tutorials'
        });
        assertObjectEqual(result[2], {
            displayName: 'Basic',
            navigationPath: '/docs/tutorials/01_basic'
        });
        assertObjectEqual(result[3], {
            displayName: 'Advanced',
            navigationPath: '/docs/tutorials/01_basic/02_advanced'
        });
    });

    await testRunner.run("createClickablePathComponents - should handle long paths with ellipsis", async () => {
        const longPath = '/a/b/c/d/e/f/g';
        const result = createClickablePathComponents(longPath);
            
        assertArrayLength(result, 7);
        // First 3 components should show ".."
        assertEqual(result[0].displayName, '..');
        assertEqual(result[1].displayName, '..');
        assertEqual(result[2].displayName, '..');
        // Last 4 should show actual names
        assertEqual(result[3].displayName, 'D');
        assertEqual(result[4].displayName, 'E');
        assertEqual(result[5].displayName, 'F');
        assertEqual(result[6].displayName, 'G');
    });

    await testRunner.run("createClickablePathComponents - should handle root and empty paths", async () => {
        assertObjectEqual(createClickablePathComponents('/'), []);
        assertObjectEqual(createClickablePathComponents(''), []);
    });

    testRunner.report();
    // } catch (error) {
    //     console.error("❌ CommonUtils test suite failed:", error);
    //     testRunner.report();
    //     throw error;
    // }
}
