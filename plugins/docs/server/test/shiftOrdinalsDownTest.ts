import vfs from '../VFS.js';

export async function shiftOrdinalsDownTest(owner_id: number): Promise<void> {
    try {
        console.log('=== VFS ShiftOrdinalsDown Test Starting ===');

        // Test 1: Test shifting ordinals in root directory (should return empty mapping)
        console.log('Test 1 - Testing shiftOrdinalsDown in root directory');
        const result1 = await vfs.shiftOrdinalsDown(owner_id, '', 1, 1);
        console.log(`Test 1 - Root directory shift result (${result1.size} items):`, 
            Array.from(result1.entries()).map(([key, value]) => ({ old: key, new: value })));
        
        if (!result1 || !(result1 instanceof Map)) {
            throw new Error('Test 1 failed! shiftOrdinalsDown should return a Map');
        }

        // Test 2: Test shifting ordinals in non-existent directory (should return empty mapping)
        console.log('Test 2 - Testing shiftOrdinalsDown in non-existent directory');
        const result2 = await vfs.shiftOrdinalsDown(owner_id, 'nonexistent-folder', 1, 1);
        console.log(`Test 2 - Non-existent directory shift result (${result2.size} items):`, 
            Array.from(result2.entries()).map(([key, value]) => ({ old: key, new: value })));
        
        if (!result2 || !(result2 instanceof Map)) {
            throw new Error('Test 2 failed! shiftOrdinalsDown should return a Map');
        }
        
        // Should return empty map since directory doesn't exist
        if (result2.size !== 0) {
            throw new Error('Test 2 failed! Non-existent directory should return empty mapping');
        }

        // Test 3: Test shifting ordinals with different parameters
        console.log('Test 3 - Testing shiftOrdinalsDown with various parameters');
        const testCases = [
            { path: 'folder1', insertOrdinal: 0, slotsToAdd: 1 },
            { path: 'folder2', insertOrdinal: 5, slotsToAdd: 2 },
            { path: 'nested/folder', insertOrdinal: 10, slotsToAdd: 3 },
            { path: 'deeply/nested/folder/structure', insertOrdinal: 1, slotsToAdd: 5 }
        ];
        
        for (const testCase of testCases) {
            const result = await vfs.shiftOrdinalsDown(owner_id, testCase.path, testCase.insertOrdinal, testCase.slotsToAdd);
            console.log(`Test 3 - Path '${testCase.path}' with ordinal ${testCase.insertOrdinal}, slots ${testCase.slotsToAdd}: ${result.size} items shifted`);
            
            if (!result || !(result instanceof Map)) {
                throw new Error(`Test 3 failed! shiftOrdinalsDown should return a Map for path '${testCase.path}'`);
            }
            
            // Should return empty map since directories don't exist
            if (result.size !== 0) {
                throw new Error(`Test 3 failed! Non-existent directory '${testCase.path}' should return empty mapping`);
            }
        }

        // Test 4: Test path normalization in shiftOrdinalsDown
        console.log('Test 4 - Testing path normalization');
        const result4 = await vfs.shiftOrdinalsDown(owner_id, '//test///path//', 1, 1);
        console.log(`Test 4 - Normalized path shift result (${result4.size} items):`, 
            Array.from(result4.entries()).map(([key, value]) => ({ old: key, new: value })));
        
        if (!result4 || !(result4 instanceof Map)) {
            throw new Error('Test 4 failed! shiftOrdinalsDown with path normalization should return a Map');
        }
        
        if (result4.size !== 0) {
            throw new Error('Test 4 failed! Non-existent normalized path should return empty mapping');
        }

        // Test 5: Test error handling with negative values
        console.log('Test 5 - Testing error handling with edge case values');
        try {
            // Test with negative insertOrdinal (might be valid depending on implementation)
            const result5a = await vfs.shiftOrdinalsDown(owner_id, 'test', -1, 1);
            console.log('Test 5a - Negative insertOrdinal handled:', result5a.size);
            
            if (!result5a || !(result5a instanceof Map)) {
                throw new Error('Test 5a failed! Should return a Map even with negative insertOrdinal');
            }
        } catch (error) {
            // It's acceptable for negative values to cause errors
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5a - Negative insertOrdinal caused error (acceptable):', errorMessage);
        }
        
        try {
            // Test with negative slotsToAdd (might be valid for shifting up instead of down)
            const result5b = await vfs.shiftOrdinalsDown(owner_id, 'test', 1, -1);
            console.log('Test 5b - Negative slotsToAdd handled:', result5b.size);
            
            if (!result5b || !(result5b instanceof Map)) {
                throw new Error('Test 5b failed! Should return a Map even with negative slotsToAdd');
            }
        } catch (error) {
            // It's acceptable for negative values to cause errors
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Test 5b - Negative slotsToAdd caused error (acceptable):', errorMessage);
        }

        // Test 6: Test with zero values
        console.log('Test 6 - Testing with zero values');
        const result6a = await vfs.shiftOrdinalsDown(owner_id, 'test', 0, 1);
        console.log(`Test 6a - Zero insertOrdinal result (${result6a.size} items)`);
        
        if (!result6a || !(result6a instanceof Map)) {
            throw new Error('Test 6a failed! shiftOrdinalsDown with zero insertOrdinal should return a Map');
        }
        
        const result6b = await vfs.shiftOrdinalsDown(owner_id, 'test', 1, 0);
        console.log(`Test 6b - Zero slotsToAdd result (${result6b.size} items)`);
        
        if (!result6b || !(result6b instanceof Map)) {
            throw new Error('Test 6b failed! shiftOrdinalsDown with zero slotsToAdd should return a Map');
        }

        // Test 7: Test with large values
        console.log('Test 7 - Testing with large values');
        const result7 = await vfs.shiftOrdinalsDown(owner_id, 'test', 9999, 9999);
        console.log(`Test 7 - Large values result (${result7.size} items)`);
        
        if (!result7 || !(result7 instanceof Map)) {
            throw new Error('Test 7 failed! shiftOrdinalsDown with large values should return a Map');
        }

        // Test 8: Test consistency between multiple calls
        console.log('Test 8 - Testing consistency between multiple calls');
        for (let i = 0; i < 3; i++) {
            const resultA = await vfs.shiftOrdinalsDown(owner_id, 'test', 1, 1);
            const resultB = await vfs.shiftOrdinalsDown(owner_id, 'nonexistent', 1, 1);
            
            if (!(resultA instanceof Map) || !(resultB instanceof Map)) {
                throw new Error(`Test 8 failed! All calls should return Maps (iteration ${i})`);
            }
            
            // Both should be empty since directories don't exist
            if (resultA.size !== 0 || resultB.size !== 0) {
                throw new Error(`Test 8 failed! Non-existent directories should consistently return empty mappings (iteration ${i})`);
            }
        }

        // Test 9: Test with different owner_id values
        console.log('Test 9 - Testing with different owner_id values');
        const result9a = await vfs.shiftOrdinalsDown(owner_id, 'test', 1, 1);
        const result9b = await vfs.shiftOrdinalsDown(999999, 'test', 1, 1); // Non-existent user
        
        console.log(`Test 9a - Valid owner_id result (${result9a.size} items)`);
        console.log(`Test 9b - Invalid owner_id result (${result9b.size} items)`);
        
        if (!(result9a instanceof Map) || !(result9b instanceof Map)) {
            throw new Error('Test 9 failed! Both calls should return Maps');
        }

        // Test 10: Test mapping format when result is not empty (conceptual test)
        console.log('Test 10 - Testing mapping format (conceptual)');
        // Since we don't have any actual files to shift, we can't test the actual mapping
        // But we can verify that the return type and structure are correct
        const result10 = await vfs.shiftOrdinalsDown(owner_id, '', 1, 1);
        
        if (!(result10 instanceof Map)) {
            throw new Error('Test 10 failed! Result should be a Map instance');
        }
        
        // Test that we can iterate over the map (even if empty)
        for (const [oldPath, newPath] of result10) {
            console.log(`Test 10 - Mapping: ${oldPath} -> ${newPath}`);
            
            if (typeof oldPath !== 'string' || typeof newPath !== 'string') {
                throw new Error('Test 10 failed! Map keys and values should be strings');
            }
        }

        console.log('✅ All shiftOrdinalsDown tests passed');
        console.log('=== VFS ShiftOrdinalsDown Test Completed Successfully ===');
        
    } catch (error) {
        console.error('=== VFS ShiftOrdinalsDown Test Failed ===');
        console.error('Error during VFS shiftOrdinalsDown test:', error);
        throw error;
    }
}