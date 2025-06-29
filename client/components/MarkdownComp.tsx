import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { setFullSizeImage } from './ImageViewerComp';
import yaml from 'js-yaml';
import { httpClientUtil } from '../HttpClientUtil';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css'; 

declare const DOC_ROOT_KEY: string;

// Run function that calls the server endpoint
async function run(item: any) {
    console.log(`Running command: ${item.cmd} with args: ${item.args}`);
    try {
        const response = await httpClientUtil.secureHttpPost('/api/admin/run-cmd/', item);
        console.log('Server response:', response);
    } catch (error) {
        console.error('Error calling server:', error);
    }
}

interface MarkdownDisplayProps {
  markdownContent: string;
  docMode?: boolean;
  basePath?: string; // Optional base path for images
}

/**
 * Displays a markdown content using ReactMarkdown. It uses rehypeRaw and rehypeSanitize for security and remarkGfm for GitHub Flavored Markdown support.
 */
export default function Markdown({ markdownContent, docMode, basePath }: MarkdownDisplayProps) {
    // Function to parse YAML content and render as buttons for "menu yaml" code blocks
    const parseMenuAndRenderButtons = (yamlContent: string) => {
        const buttons: React.ReactElement[] = [];

        try {
            const parsedYaml = yaml.load(yamlContent) as any;
            if (Array.isArray(parsedYaml)) {
                parsedYaml.forEach((item, itemIndex) => {
                    if (typeof item === 'object' && item !== null && item.title) {
                        buttons.push(
                            <button
                                key={itemIndex}
                                onClick={() => run(item)}
                                className="inline-block px-2 py-1 mr-2 mb-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md border border-gray-300 transition-colors duration-200"
                            >
                                {item.title}
                            </button>
                        );
                    }
                });
            }
        } catch (error) {
            console.error('Error parsing MENU YAML:', error);
        }

        return buttons.length > 0 ? <div className="yaml-menu-buttons mb-4 flex flex-wrap">{buttons}</div> : null;
    };

    const comps: Components = {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
        ),
        // Custom pre component to handle 'menu yaml' fenced code blocks
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        pre: ({ node, children, ...props }) => {
            // Check if this pre contains a code element with language-menu
            const codeElement = React.Children.toArray(children).find(
                (child: any) => 
                    React.isValidElement(child) && 
                    (child.props as any)?.className?.includes('language-menu')
            );

            if (codeElement && React.isValidElement(codeElement)) {
                const yamlContent = String((codeElement.props as any).children).replace(/\n$/, '');
                return parseMenuAndRenderButtons(yamlContent);
            }

            // Regular pre blocks with styling
            return (
                <pre 
                    {...props} 
                    style={{
                        border: '1px solid #374151',
                        borderRadius: '6px',
                        padding: '6px',
                        margin: '8px 0',
                        backgroundColor: '#1f2937',
                        overflow: 'auto'
                    }}
                >
                    {children}
                </pre>
            );
        }
    };

    // When displayed in the TreeViewerPage we have very specific way of handling images due to the variable
    // DOC_ROOT_KEY which is used to transform relative paths to absolute paths.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    comps.img = ({ node, src, ...props }) => {
        let imgSrc = src;

        if (basePath) {
            imgSrc = `${basePath}/${src}`;
            // console.log(`Transformed image path: basePath=[${basePath}] / srcPart=[${src}]`);
        }
        // If we have a DOC_ROOT_KEY and the src is a relative path (doesn't start with http or /)
        else if (docMode && DOC_ROOT_KEY && src && !src.startsWith('http') && !src.startsWith('/')) {
            // Transform relative paths to use the docs images API
            imgSrc = `/api/docs/images/${DOC_ROOT_KEY}/${src}`;
            // console.log(`Transformed image path: docRoot=[${DOC_ROOT_KEY}] / src=[${src}`);
        }
        return <img src={imgSrc} {...props} onClick={() => setFullSizeImage({src: imgSrc!, name: "Markdown image"})} />;
    };

    return (
        <>
            <ReactMarkdown
                rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]} // Add rehypeHighlight here
                remarkPlugins={[remarkGfm]}
                components={comps}
            >
                {markdownContent}
            </ReactMarkdown>
        </>
    );
}
