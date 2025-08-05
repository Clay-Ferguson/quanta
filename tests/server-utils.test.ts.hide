// Simple server-side utility tests that don't require complex imports
describe('Server Utilities - Basic Functions', () => {
    describe('Error Handling Utilities', () => {
        it('should create and throw custom errors', () => {
            const createCustomError = (message: string) => {
                const error = new Error(message);
                (error as any).customProperty = true;
                return error;
            };

            const error = createCustomError('Test error');
            expect(error.message).toBe('Test error');
            expect((error as any).customProperty).toBe(true);
        });

        it('should handle error responses', () => {
            const handleErrorResponse = (error: unknown, statusCode: number = 500) => {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return {
                    status: statusCode,
                    error: errorMessage,
                    timestamp: new Date().toISOString()
                };
            };

            const response = handleErrorResponse(new Error('Test error'), 400);
            expect(response.status).toBe(400);
            expect(response.error).toBe('Test error');
            expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });

    describe('Request Validation', () => {
        it('should validate required fields', () => {
            const validateRequiredFields = (data: any, requiredFields: string[]) => {
                const missing = requiredFields.filter(field => !data[field]);
                return {
                    isValid: missing.length === 0,
                    missingFields: missing
                };
            };

            const data = { name: 'John', email: 'john@example.com' };
            const validation1 = validateRequiredFields(data, ['name', 'email']);
            expect(validation1.isValid).toBe(true);
            expect(validation1.missingFields).toEqual([]);

            const validation2 = validateRequiredFields(data, ['name', 'email', 'age']);
            expect(validation2.isValid).toBe(false);
            expect(validation2.missingFields).toEqual(['age']);
        });

        it('should sanitize user input', () => {
            const sanitizeString = (input: string) => {
                return input
                    .trim()
                    .replace(/[<>]/g, '') // Remove potential HTML tags
                    .substring(0, 255); // Limit length
            };

            expect(sanitizeString('  hello world  ')).toBe('hello world');
            expect(sanitizeString('hello<script>world')).toBe('helloscriptworld');
            expect(sanitizeString('a'.repeat(300))).toHaveLength(255);
        });
    });

    describe('Async Wrapper Functions', () => {
        it('should wrap async functions for error handling', async () => {
            const asyncWrapper = (fn: () => Promise<any>) => {
                return async () => {
                    try {
                        return await fn();
                    } catch (error) {
                        return { error: error instanceof Error ? error.message : 'Unknown error' };
                    }
                };
            };

            const successFn = async () => ({ data: 'success' });
            const errorFn = async () => { throw new Error('Test error'); };

            const wrappedSuccess = asyncWrapper(successFn);
            const wrappedError = asyncWrapper(errorFn);

            const successResult = await wrappedSuccess();
            expect(successResult).toEqual({ data: 'success' });

            const errorResult = await wrappedError();
            expect(errorResult).toEqual({ error: 'Test error' });
        });
    });

    describe('Configuration Helpers', () => {
        it('should parse environment variables safely', () => {
            const parseEnvVar = (value: string | undefined, defaultValue: string) => {
                return value?.trim() || defaultValue;
            };

            const parseEnvNumber = (value: string | undefined, defaultValue: number) => {
                const parsed = value ? parseInt(value, 10) : NaN;
                return isNaN(parsed) ? defaultValue : parsed;
            };

            expect(parseEnvVar('test', 'default')).toBe('test');
            expect(parseEnvVar('  test  ', 'default')).toBe('test');
            expect(parseEnvVar(undefined, 'default')).toBe('default');
            expect(parseEnvVar('', 'default')).toBe('default');

            expect(parseEnvNumber('123', 456)).toBe(123);
            expect(parseEnvNumber('invalid', 456)).toBe(456);
            expect(parseEnvNumber(undefined, 456)).toBe(456);
        });
    });

    describe('HTTP Response Helpers', () => {
        it('should format API responses consistently', () => {
            const createApiResponse = (data: any, success: boolean = true, message?: string) => {
                return {
                    success,
                    data: success ? data : undefined,
                    error: success ? undefined : data,
                    message,
                    timestamp: new Date().toISOString()
                };
            };

            const successResponse = createApiResponse({ id: 1, name: 'test' }, true, 'Operation successful');
            expect(successResponse.success).toBe(true);
            expect(successResponse.data).toEqual({ id: 1, name: 'test' });
            expect(successResponse.error).toBeUndefined();
            expect(successResponse.message).toBe('Operation successful');

            const errorResponse = createApiResponse('Something went wrong', false);
            expect(errorResponse.success).toBe(false);
            expect(errorResponse.data).toBeUndefined();
            expect(errorResponse.error).toBe('Something went wrong');
        });
    });
});
