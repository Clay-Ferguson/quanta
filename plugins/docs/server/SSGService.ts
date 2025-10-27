import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export interface GenerateDocOptions {
	includeFileNames: boolean;
	includeSeparatorLines: boolean;
	generateRecursively: boolean;
}

/**
 * Static Site Generation Service
 * 
 * Scans ordered files/folders (by numeric prefix) and generates a consolidated markdown file
 * containing all content with proper relative image paths.
 * 
 * todo-1: This will need to be completely rewritten for VFS. 
 */
class SSGService {
    /**
     * Generates static site by creating _index.md files containing
     * concatenated markdown content from ordered files in the folder structure
     * 
     * @param res - Express response object for sending back the result
     */
    generateStaticSite = async (req: Request, res: Response) => {
        try {
            const { treeFolder } = req.body;
            console.log(`SSG: Generating static site for folder: ${treeFolder}`);
            
            // Construct the absolute path to the target folder
            let absolutePath: string;
            if (!treeFolder || treeFolder === '/') {
                absolutePath = "/";
            } else {
                // Remove leading slash if present for path.join
                const cleanTreeFolder = treeFolder.startsWith('/') ? treeFolder.substring(1) : treeFolder;
                absolutePath = path.join("/", cleanTreeFolder);
            }
            
            // Verify the path exists
            if (!fs.existsSync(absolutePath)) {
                res.status(404).json({ 
                    error: `Path not found: ${absolutePath}` 
                });
                return;
            }
            
            // Generate the consolidated document
            const options: GenerateDocOptions = {
                includeFileNames: false,
                includeSeparatorLines: true,
                generateRecursively: true
            };
            
            this.generateDoc(absolutePath, options, absolutePath);
            
            res.json({ 
                message: `SSG generation completed for folder: ${treeFolder}`,
                treeFolder: treeFolder,
                absolutePath: absolutePath
            });
            
        } catch (error) {
            console.error('SSG Error:', error);
            res.status(500).json({ 
                error: 'Failed to generate static site' 
            });
        }
    };

    /**
     * Generates a consolidated markdown document by recursively processing all ordered files
     * Creates _index.md with all content concatenated together with proper relative image paths
     * 
     * @param folderPath - Absolute path to the folder to process
     * @param options - Configuration options for document generation
     * @param generationFolderPath - Path to the folder where _index.md is being generated (for relative paths)
     */
    private generateDoc = (folderPath: string, options: GenerateDocOptions, generationFolderPath: string) => {
        try {
            const content = this.processFolder(folderPath, options, generationFolderPath);
            const outputFilePath = path.join(folderPath, '_index.md');
            
            fs.writeFileSync(outputFilePath, content.trim(), 'utf8');
            console.log(`Generated: ${outputFilePath}`);
            
        } catch (error) {
            console.error('Error generating document:', error);
            throw error;
        }
    };

    /**
     * Recursively processes a folder and all its contents, building up consolidated markdown content
     * 
     * @param folderPath - Absolute path to the folder to process
     * @param options - Configuration options
     * @param generationFolderPath - Path to the folder where _index.md is being generated (for relative paths)
     * @returns Consolidated markdown content as string
     */
    private processFolder = (folderPath: string, options: GenerateDocOptions, generationFolderPath: string): string => {
        let content = '';
        
        console.log(`\n=== Processing folder: ${folderPath} ===`);
        
        try {
            const files = fs.readdirSync(folderPath);
            const sortedFiles = this.getSortedOrderedFiles(files);
            console.log(`Found ${sortedFiles.length} ordered files:`, sortedFiles);
            
            for (const fileName of sortedFiles) {
                const filePath = path.join(folderPath, fileName);
                const stats = fs.statSync(filePath);
                                
                if (stats.isFile()) {
                    const fileContent = this.processFile(filePath, fileName, options, generationFolderPath);
                    if (fileContent.trim()) {
                        content += fileContent;                        
                    } 
                    if (options.includeSeparatorLines) {
                        content += '----\n';
                    }
                } else if (stats.isDirectory()) {
                    // Recursively process subdirectories
                    const folderContent = this.processFolder(filePath, options, generationFolderPath);
                    if (folderContent.trim()) {
                        content += folderContent;
                    } 
                }
            }
            
        } catch (error) {
            console.error(`Error processing folder: ${folderPath}`, error);
        }
        
        console.log(`=== Finished folder: ${folderPath}. Final content length: ${content.length} ===\n`);
        return content;
    };

    /**
     * Processes a single file and returns its content formatted for the consolidated document
     * 
     * @param filePath - Absolute path to the file
     * @param fileName - Name of the file
     * @param options - Configuration options
     * @param generationFolderPath - Path to the folder where _index.md is being generated (for relative paths)
     * @returns Formatted file content as string
     */
    private processFile = (filePath: string, fileName: string, options: GenerateDocOptions, generationFolderPath: string): string => {
        let content = '';
        
        console.log(`Processing file: ${fileName}`);
        
        try {
            // Add file name header if option is enabled
            if (options.includeFileNames) {
                content += `📄 ${fileName}\n`;
                console.log(`    Added filename header`);
            }
            
            // Handle image files
            if (this.isImageFile(fileName)) {
                const relativePath = this.getRelativePath(filePath, generationFolderPath);
                const displayName = fileName;
                content += `![${displayName}](${relativePath})\n`;
                console.log(`    Added image: ${displayName} -> ${relativePath}`);
            } else {
                // Handle text/markdown files
                const fileContent = fs.readFileSync(filePath, 'utf8');
                content += `${fileContent}\n`;
                console.log(`    Added text content (${fileContent.length} chars): "${fileContent.substring(0, 20)}..."`);
            }
            
        } catch (error) {
            console.error(`Error processing file: ${filePath}`, error);
            content += `<!-- Error reading file: ${fileName} -->\n`;
            console.log(`    Added error comment`);
        }
        
        console.log(`    File ${fileName} generated ${content.length} chars total`);
        return content;
    };

    /**
     * Checks if a file is an image based on its extension
     */
    private isImageFile = (fileName: string): boolean => {
        return /\.(png|jpe?g|gif|svg|webp)$/i.test(fileName);
    };

    /**
     * Calculates the relative path from a file to the generation folder (where _index.md is created)
     */
    private getRelativePath = (filePath: string, generationFolderPath: string): string => {
        return path.relative(generationFolderPath, filePath).replace(/\\/g, '/');
    };

    /**
     * Sorts files based on their numeric prefix and filters to only include ordered files
     * Files must start with a number followed by an underscore (e.g., "01_", "02_")
     * 
     * @param files - Array of file names to sort
     * @returns Array of file names sorted by their numeric prefix
     */
    private getSortedOrderedFiles = (files: string[]): string[] => {
        return files
            .filter(file => /^\d+_/.test(file))
            .sort((a, b) => this.getFileNumber(a) - this.getFileNumber(b));
    };

    /**
     * Extracts the numeric prefix from a file name for sorting purposes
     * 
     * @param fileName - File name with numeric prefix (e.g., "01_example.md")
     * @returns The numeric value of the prefix
     */
    private getFileNumber = (fileName: string): number => {
        const match = fileName.match(/^(\d+)_/);
        return match ? parseInt(match[1], 10) : 0;
    };

    /**
     * Removes the numeric prefix from a file or folder name
     * Useful for displaying clean names without the ordering prefix
     * 
     * @param fileName - File name with numeric prefix (e.g., "01_example.md")
     * @returns File name without the numeric prefix (e.g., "example.md")
     */
    private removeNumberPrefix = (fileName: string): string => {
        const underscoreIndex = fileName.indexOf('_');
        return underscoreIndex !== -1 ? fileName.substring(underscoreIndex + 1) : fileName;
    }
}

export const ssg = new SSGService();