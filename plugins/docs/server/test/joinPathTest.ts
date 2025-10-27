import { docUtil } from "../DocUtil.js";

export async function joinPathTest(): Promise<void> {
    try {
        console.log('=== VFS Join Path Test Starting ===');

        // Test 1: Basic path joining
        const result1 = docUtil.pathJoin('folder', 'file.txt');
        const expected1 = 'folder/file.txt';
        console.log(`Test 1 - Input: ['folder', 'file.txt'], Expected: '${expected1}', Got: '${result1}'`);
        if (result1 !== expected1) {
            throw new Error(`Test 1 failed! Expected: '${expected1}', Got: '${result1}'`);
        }

        // Test 2: Multiple path parts
        const result2 = docUtil.pathJoin('folder1', 'folder2', 'folder3', 'file.txt');
        const expected2 = 'folder1/folder2/folder3/file.txt';
        console.log(`Test 2 - Input: ['folder1', 'folder2', 'folder3', 'file.txt'], Expected: '${expected2}', Got: '${result2}'`);
        if (result2 !== expected2) {
            throw new Error(`Test 2 failed! Expected: '${expected2}', Got: '${result2}'`);
        }

        // Test 3: Empty strings in parts
        const result3 = docUtil.pathJoin('folder', '', 'file.txt');
        const expected3 = 'folder/file.txt';
        console.log(`Test 3 - Input: ['folder', '', 'file.txt'], Expected: '${expected3}', Got: '${result3}'`);
        if (result3 !== expected3) {
            throw new Error(`Test 3 failed! Expected: '${expected3}', Got: '${result3}'`);
        }

        // Test 4: Parts with leading/trailing slashes
        const result4 = docUtil.pathJoin('/folder/', '/subfolder/', '/file.txt');
        const expected4 = 'folder/subfolder/file.txt';
        console.log(`Test 4 - Input: ['/folder/', '/subfolder/', '/file.txt'], Expected: '${expected4}', Got: '${result4}'`);
        if (result4 !== expected4) {
            throw new Error(`Test 4 failed! Expected: '${expected4}', Got: '${result4}'`);
        }

        // Test 5: Single part
        const result5 = docUtil.pathJoin('file.txt');
        const expected5 = 'file.txt';
        console.log(`Test 5 - Input: ['file.txt'], Expected: '${expected5}', Got: '${result5}'`);
        if (result5 !== expected5) {
            throw new Error(`Test 5 failed! Expected: '${expected5}', Got: '${result5}'`);
        }

        // Test 6: No parts (empty array)
        const result6 = docUtil.pathJoin();
        const expected6 = '';
        console.log(`Test 6 - Input: [], Expected: '${expected6}', Got: '${result6}'`);
        if (result6 !== expected6) {
            throw new Error(`Test 6 failed! Expected: '${expected6}', Got: '${result6}'`);
        }

        // Test 7: Parts with multiple slashes
        const result7 = docUtil.pathJoin('folder//subfolder', 'file.txt');
        const expected7 = 'folder/subfolder/file.txt';
        console.log(`Test 7 - Input: ['folder//subfolder', 'file.txt'], Expected: '${expected7}', Got: '${result7}'`);
        if (result7 !== expected7) {
            throw new Error(`Test 7 failed! Expected: '${expected7}', Got: '${result7}'`);
        }

        // Test 8: All empty strings
        const result8 = docUtil.pathJoin('', '', '');
        const expected8 = '';
        console.log(`Test 8 - Input: ['', '', ''], Expected: '${expected8}', Got: '${result8}'`);
        if (result8 !== expected8) {
            throw new Error(`Test 8 failed! Expected: '${expected8}', Got: '${result8}'`);
        }

        // Test 9: Complex path with dots and slashes (normalizePath doesn't resolve .. paths)
        const result9 = docUtil.pathJoin('./folder', '../other', 'file.txt');
        const expected9 = 'folder/../other/file.txt';
        console.log(`Test 9 - Input: ['./folder', '../other', 'file.txt'], Expected: '${expected9}', Got: '${result9}'`);
        if (result9 !== expected9) {
            throw new Error(`Test 9 failed! Expected: '${expected9}', Got: '${result9}'`);
        }

        // Test 10: Root-like paths
        const result10 = docUtil.pathJoin('/', 'folder', 'file.txt');
        const expected10 = 'folder/file.txt';
        console.log(`Test 10 - Input: ['/', 'folder', 'file.txt'], Expected: '${expected10}', Got: '${result10}'`);
        if (result10 !== expected10) {
            throw new Error(`Test 10 failed! Expected: '${expected10}', Got: '${result10}'`);
        }

        console.log('✅ All joinPath tests passed');
        console.log('=== VFS Join Path Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Join Path Test Failed ===');
        console.error('Error during VFS joinPath test:', error);
        throw error;
    }
}
