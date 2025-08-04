// A simple test file for Jest to run

// Define the functions directly in the test file
function sum(a: number, b: number): number {
    return a + b;
}

function concat(a: string, b: string): string {
    return a + b;
}

describe('Embedded Test', () => {
    it('should correctly add two numbers', () => {
        expect(sum(1, 1)).toBe(2);
        expect(sum(2, 3)).toBe(5);
    });
    
    it('should correctly concatenate two strings', () => {
        expect(concat('hello', 'world')).toBe('helloworld');
        expect(concat('a', 'b')).toBe('ab');
    });
});
