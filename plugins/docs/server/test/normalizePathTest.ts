import { docUtil } from "../DocUtil.js";

export async function normalizePathTest(): Promise<void> {
    try {
        console.log('=== VFS Normalize Path Test Starting ===');

        // Test 1: Remove leading slashes
        const result1 = docUtil.normalizePath('/test/path');
        const expected1 = 'test/path';
        console.log(`Test 1 - Input: '/test/path', Expected: '${expected1}', Got: '${result1}'`);
        if (result1 !== expected1) {
            throw new Error(`Test 1 failed! Expected: '${expected1}', Got: '${result1}'`);
        }

        // Test 2: Remove leading dots and slashes
        const result2 = docUtil.normalizePath('./test/path');
        const expected2 = 'test/path';
        console.log(`Test 2 - Input: './test/path', Expected: '${expected2}', Got: '${result2}'`);
        if (result2 !== expected2) {
            throw new Error(`Test 2 failed! Expected: '${expected2}', Got: '${result2}'`);
        }

        // Test 3: Remove multiple leading slashes
        const result3 = docUtil.normalizePath('///test/path');
        const expected3 = 'test/path';
        console.log(`Test 3 - Input: '///test/path', Expected: '${expected3}', Got: '${result3}'`);
        if (result3 !== expected3) {
            throw new Error(`Test 3 failed! Expected: '${expected3}', Got: '${result3}'`);
        }

        // Test 4: Replace multiple slashes with single slash
        const result4 = docUtil.normalizePath('test//path///file');
        const expected4 = 'test/path/file';
        console.log(`Test 4 - Input: 'test//path///file', Expected: '${expected4}', Got: '${result4}'`);
        if (result4 !== expected4) {
            throw new Error(`Test 4 failed! Expected: '${expected4}', Got: '${result4}'`);
        }

        // Test 5: Remove trailing slashes
        const result5 = docUtil.normalizePath('test/path/');
        const expected5 = 'test/path';
        console.log(`Test 5 - Input: 'test/path/', Expected: '${expected5}', Got: '${result5}'`);
        if (result5 !== expected5) {
            throw new Error(`Test 5 failed! Expected: '${expected5}', Got: '${result5}'`);
        }

        // Test 6: Remove multiple trailing slashes
        const result6 = docUtil.normalizePath('test/path///');
        const expected6 = 'test/path';
        console.log(`Test 6 - Input: 'test/path///', Expected: '${expected6}', Got: '${result6}'`);
        if (result6 !== expected6) {
            throw new Error(`Test 6 failed! Expected: '${expected6}', Got: '${result6}'`);
        }

        // Test 7: Handle empty string
        const result7 = docUtil.normalizePath('');
        const expected7 = '';
        console.log(`Test 7 - Input: '', Expected: '${expected7}', Got: '${result7}'`);
        if (result7 !== expected7) {
            throw new Error(`Test 7 failed! Expected: '${expected7}', Got: '${result7}'`);
        }

        // Test 8: Handle single slash
        const result8 = docUtil.normalizePath('/');
        const expected8 = '';
        console.log(`Test 8 - Input: '/', Expected: '${expected8}', Got: '${result8}'`);
        if (result8 !== expected8) {
            throw new Error(`Test 8 failed! Expected: '${expected8}', Got: '${result8}'`);
        }

        // Test 9: Handle multiple slashes only
        const result9 = docUtil.normalizePath('///');
        const expected9 = '';
        console.log(`Test 9 - Input: '///', Expected: '${expected9}', Got: '${result9}'`);
        if (result9 !== expected9) {
            throw new Error(`Test 9 failed! Expected: '${expected9}', Got: '${result9}'`);
        }

        // Test 10: Complex case with all issues
        const result10 = docUtil.normalizePath('./////test///path//file///');
        const expected10 = 'test/path/file';
        console.log(`Test 10 - Input: './////test///path//file///', Expected: '${expected10}', Got: '${result10}'`);
        if (result10 !== expected10) {
            throw new Error(`Test 10 failed! Expected: '${expected10}', Got: '${result10}'`);
        }

        // Test 11: Single filename
        const result11 = docUtil.normalizePath('filename.txt');
        const expected11 = 'filename.txt';
        console.log(`Test 11 - Input: 'filename.txt', Expected: '${expected11}', Got: '${result11}'`);
        if (result11 !== expected11) {
            throw new Error(`Test 11 failed! Expected: '${expected11}', Got: '${result11}'`);
        }

        // Test 12: Single filename with leading slash
        const result12 = docUtil.normalizePath('/filename.txt');
        const expected12 = 'filename.txt';
        console.log(`Test 12 - Input: '/filename.txt', Expected: '${expected12}', Got: '${result12}'`);
        if (result12 !== expected12) {
            throw new Error(`Test 12 failed! Expected: '${expected12}', Got: '${result12}'`);
        }

        console.log('✅ All normalizePath tests passed');
        console.log('=== VFS Normalize Path Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS Normalize Path Test Failed ===');
        console.error('Error during VFS normalizePath test:', error);
        throw error;
    }
}
