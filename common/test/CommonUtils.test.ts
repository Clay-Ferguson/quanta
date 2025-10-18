import {
    isImageFile,
    isTextFile,
    isImageExt,
    getImageContentType,
    formatDate,
    formatDateTime,
    getFilenameExtension,
    createClickablePathComponents,
    stripFileExtension,
    fixName,
    assert,
    assertEqual,
    assertContains,
    assertMatches,
    assertArrayLength,
    assertObjectEqual
} from '../CommonUtils.js';
import { TestRunner } from '../TestRunner.js'; 

export async function runTests() {
    console.log("🚀 Starting CommonUtils tests...");
    
    const testRunner = new TestRunner("CommonUtils");
    
    try {
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

        await testRunner.run("formatDate - should handle edge cases", async () => {
            assertEqual(typeof formatDate(0), 'string', 'Should handle Unix epoch');
            assertEqual(typeof formatDate(-1), 'string', 'Should handle negative timestamps');
            // Unix epoch should contain either 1969 or 69 (depending on locale and timezone)
            const epochResult = formatDate(0);
            assert(epochResult.includes('1969') || epochResult.includes('69'), 'Unix epoch should contain year reference');
        });

        await testRunner.run("formatDateTime - should handle edge cases", async () => {
            assertEqual(typeof formatDateTime(0), 'string', 'Should handle Unix epoch');
            assertEqual(typeof formatDateTime(-1), 'string', 'Should handle negative timestamps');
            // Unix epoch should contain either 1969 or 69 (depending on locale and timezone)
            const epochResult = formatDateTime(0);
            assert(epochResult.includes('1969') || epochResult.includes('69'), 'Unix epoch should contain year reference');
        });

        // File Extension Stripping Tests
        await testRunner.run("stripFileExtension - should remove extensions correctly", async () => {
            assertEqual(stripFileExtension('document.pdf'), 'document');
            assertEqual(stripFileExtension('archive.tar.gz'), 'archive.tar');
            assertEqual(stripFileExtension('file.txt'), 'file');
            assertEqual(stripFileExtension('image.jpeg'), 'image');
        });

        await testRunner.run("stripFileExtension - should handle files without extensions", async () => {
            assertEqual(stripFileExtension('README'), 'README');
            assertEqual(stripFileExtension('file.'), 'file');
            assertEqual(stripFileExtension('noextension'), 'noextension');
        });

        await testRunner.run("stripFileExtension - should handle edge cases", async () => {
            assertEqual(stripFileExtension(''), '');
            assertEqual(stripFileExtension('.'), '');
            assertEqual(stripFileExtension('..'), '.');
            assertEqual(stripFileExtension('.hidden'), '');
        });

        // File Name Sanitization Tests
        await testRunner.run("fixName - should replace invalid characters with underscores", async () => {
            assertEqual(fixName('file@name#.txt'), 'file_name_.txt');
            assertEqual(fixName('test/file\\name'), 'test_file_name');
            assertEqual(fixName('file<>:"|?*.txt'), 'file_______.txt');
            assertEqual(fixName('valid_file-name 123.txt'), 'valid_file-name 123.txt');
        });

        await testRunner.run("fixName - should preserve allowed characters", async () => {
            assertEqual(fixName('file with spaces'), 'file with spaces');
            assertEqual(fixName('file_name-123.txt'), 'file_name-123.txt');
            assertEqual(fixName('UPPERCASE.TXT'), 'UPPERCASE.TXT');
            assertEqual(fixName('lowercase.txt'), 'lowercase.txt');
        });

        await testRunner.run("fixName - should handle edge cases", async () => {
            assertEqual(fixName(''), '');
            assertEqual(fixName('!@#$%^*()'), '_________');
            assertEqual(fixName('...'), '...');
            assertEqual(fixName('123'), '123');
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
    }
    catch {
        console.error("❌ CommonUtils test suite failed");
    }
    finally {
        // Final report
        testRunner.report();}
}
