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
} from '../common/CommonUtils';

describe('CommonUtils', () => {
    describe('File Type Detection', () => {
        describe('isImageFile', () => {
            it('should identify image files correctly', () => {
                expect(isImageFile('photo.jpg')).toBe(true);
                expect(isImageFile('image.png')).toBe(true);
                expect(isImageFile('animation.gif')).toBe(true);
                expect(isImageFile('vector.svg')).toBe(true);
                expect(isImageFile('Picture.JPEG')).toBe(true); // Case insensitive
            });

            it('should reject non-image files', () => {
                expect(isImageFile('document.txt')).toBe(false);
                expect(isImageFile('script.js')).toBe(false);
                expect(isImageFile('data.json')).toBe(false);
                expect(isImageFile('noextension')).toBe(false);
            });
        });

        describe('isTextFile', () => {
            it('should identify text files correctly', () => {
                expect(isTextFile('readme.md')).toBe(true);
                expect(isTextFile('config.json')).toBe(true);
                expect(isTextFile('script.js')).toBe(true);
                expect(isTextFile('styles.css')).toBe(true);
                expect(isTextFile('Document.TXT')).toBe(true); // Case insensitive
            });

            it('should reject non-text files', () => {
                expect(isTextFile('image.jpg')).toBe(false);
                expect(isTextFile('binary.exe')).toBe(false);
                expect(isTextFile('noextension')).toBe(false);
            });
        });

        describe('isImageExt', () => {
            it('should handle extensions with dots', () => {
                expect(isImageExt('.jpg')).toBe(true);
                expect(isImageExt('.PNG')).toBe(true);
                expect(isImageExt('.txt')).toBe(false);
            });

            it('should handle extensions without dots', () => {
                expect(isImageExt('jpg')).toBe(false); // Expects dot
                expect(isImageExt('png')).toBe(false);
            });
        });
    });

    describe('Content Type Detection', () => {
        describe('getImageContentType', () => {
            it('should return correct MIME types', () => {
                expect(getImageContentType('image.png')).toBe('image/png');
                expect(getImageContentType('animation.gif')).toBe('image/gif');
                expect(getImageContentType('bitmap.bmp')).toBe('image/bmp');
                expect(getImageContentType('photo.webp')).toBe('image/webp');
            });

            it('should default to jpeg for jpg files', () => {
                expect(getImageContentType('photo.jpg')).toBe('image/jpeg');
                expect(getImageContentType('image.jpeg')).toBe('image/jpeg');
            });

            it('should handle case insensitivity', () => {
                expect(getImageContentType('IMAGE.PNG')).toBe('image/png');
                expect(getImageContentType('Photo.JPG')).toBe('image/jpeg');
            });

            it('should default to jpeg for unknown extensions', () => {
                expect(getImageContentType('file.unknown')).toBe('image/jpeg');
                expect(getImageContentType('noextension')).toBe('image/jpeg');
            });
        });
    });

    describe('Date Formatting', () => {
        describe('formatDate', () => {
            it('should format timestamp to readable date', () => {
                const timestamp = 1642780800000; // January 21, 2022 08:00:00 UTC
                const result = formatDate(timestamp);
                expect(result).toContain('2022'); // Should contain the year
                expect(typeof result).toBe('string');
                expect(result.length).toBeGreaterThan(5);
            });
        });

        describe('formatDateTime', () => {
            it('should format timestamp with specific locale format', () => {
                const timestamp = 1642780800000;
                const result = formatDateTime(timestamp);
                expect(typeof result).toBe('string');
                expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/); // MM/DD/YYYY format
            });
        });
    });

    describe('Path and Filename Utilities', () => {
        describe('getFilenameExtension', () => {
            it('should extract file extensions correctly', () => {
                expect(getFilenameExtension('/path/to/file.txt')).toBe('.txt');
                expect(getFilenameExtension('document.pdf')).toBe('.pdf');
                expect(getFilenameExtension('archive.tar.gz')).toBe('.gz');
            });

            it('should handle files without extensions', () => {
                expect(getFilenameExtension('README')).toBe('');
                expect(getFilenameExtension('/path/to/folder/')).toBe('');
                expect(getFilenameExtension('file.')).toBe('');
            });

            it('should handle edge cases', () => {
                expect(getFilenameExtension('')).toBe('');
                expect(getFilenameExtension('.')).toBe('');
                expect(getFilenameExtension('..')).toBe('');
                expect(getFilenameExtension('.hidden')).toBe('.hidden');
            });
        });

        describe('stripOrdinal', () => {
            it('should remove ordinal prefixes', () => {
                expect(stripOrdinal('01_introduction.md')).toBe('introduction.md');
                expect(stripOrdinal('999_final_chapter.txt')).toBe('final_chapter.txt');
                expect(stripOrdinal('abc_document.pdf')).toBe('document.pdf');
            });

            it('should handle files without ordinals', () => {
                expect(stripOrdinal('document.txt')).toBe('document.txt');
                expect(stripOrdinal('no-underscore.md')).toBe('no-underscore.md');
            });

            it('should handle multiple underscores', () => {
                expect(stripOrdinal('01_chapter_one_intro.md')).toBe('chapter_one_intro.md');
            });
        });

        describe('formatDisplayName', () => {
            it('should format names for display', () => {
                expect(formatDisplayName('01_hello_world')).toBe('Hello World');
                expect(formatDisplayName('02_advanced-topics')).toBe('Advanced Topics');
                // Note: stripOrdinal removes the first part before underscore
                expect(formatDisplayName('user_profile_settings')).toBe('Profile Settings');
            });

            it('should preserve trailing underscores', () => {
                expect(formatDisplayName('01_pullup_topic_')).toBe('Pullup Topic_');
                // Note: stripOrdinal removes the first part before underscore
                expect(formatDisplayName('chapter_end_')).toBe('End_');
            });

            it('should handle .Md extension conversion', () => {
                expect(formatDisplayName('01_readme.Md')).toBe('Readme.md');
                expect(formatDisplayName('chapter.MD')).toBe('Chapter.MD'); // Only .Md, not .MD
            });
        });

        describe('formatFullPath', () => {
            it('should format complete paths', () => {
                // formatFullPath formats ALL path components, not just ordinal ones
                expect(formatFullPath('/docs/01_intro/02_getting_started')).toBe('Docs / Intro / Getting Started');
                expect(formatFullPath('/user/profile/settings')).toBe('User / Profile / Settings');
            });

            it('should handle root and empty paths', () => {
                expect(formatFullPath('/')).toBe('');
                expect(formatFullPath('')).toBe('');
            });

            it('should handle single level paths', () => {
                expect(formatFullPath('/home')).toBe('Home');
                expect(formatFullPath('/01_introduction')).toBe('Introduction');
            });
        });

        describe('createClickablePathComponents', () => {
            it('should create navigation components', () => {
                const result = createClickablePathComponents('/docs/tutorials/01_basic/02_advanced');
                
                expect(result).toHaveLength(4);
                expect(result[0]).toEqual({
                    displayName: 'Docs',
                    navigationPath: '/docs'
                });
                expect(result[1]).toEqual({
                    displayName: 'Tutorials',
                    navigationPath: '/docs/tutorials'
                });
                expect(result[2]).toEqual({
                    displayName: 'Basic',
                    navigationPath: '/docs/tutorials/01_basic'
                });
                expect(result[3]).toEqual({
                    displayName: 'Advanced',
                    navigationPath: '/docs/tutorials/01_basic/02_advanced'
                });
            });

            it('should handle long paths with ellipsis', () => {
                const longPath = '/a/b/c/d/e/f/g';
                const result = createClickablePathComponents(longPath);
                
                expect(result).toHaveLength(7);
                // First 3 components should show ".."
                expect(result[0].displayName).toBe('..');
                expect(result[1].displayName).toBe('..');
                expect(result[2].displayName).toBe('..');
                // Last 4 should show actual names
                expect(result[3].displayName).toBe('D');
                expect(result[4].displayName).toBe('E');
                expect(result[5].displayName).toBe('F');
                expect(result[6].displayName).toBe('G');
            });

            it('should handle root and empty paths', () => {
                expect(createClickablePathComponents('/')).toEqual([]);
                expect(createClickablePathComponents('')).toEqual([]);
            });
        });
    });
});
