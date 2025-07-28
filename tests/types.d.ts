// TypeScript declarations for test utilities
import { UserProfileCompact } from '../common/types/CommonTypes';

declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidDate(): R;
            toBeValidEmail(): R;
        }
    }

    const testUtils: {
        createMockUser(): UserProfileCompact;
    };
}

export {};
