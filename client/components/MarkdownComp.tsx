import ReactMarkdown, { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { setFullSizeImage } from './ImageViewerComp';

declare const DOC_ROOT_KEY: string; 

interface MarkdownDisplayProps {
  markdownContent: string;
  docMode?: boolean;
}

/**
 * Displays a markdown content using ReactMarkdown. It uses rehypeRaw and rehypeSanitize for security and remarkGfm for GitHub Flavored Markdown support.
 */
export default function Markdown({ markdownContent, docMode }: MarkdownDisplayProps) {
    const comps: Components = {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
        )
    };

    // When displayed in the TreeViewerPage we have very specific way of handling images due to the variable
    // DOC_ROOT_KEY which is used to transform relative paths to absolute paths.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    comps.img = ({ node, src, ...props }) => {
        let imgSrc = src;
                        
        // If we have a DOC_ROOT_KEY and the src is a relative path (doesn't start with http or /)
        if (docMode && DOC_ROOT_KEY && src && !src.startsWith('http') && !src.startsWith('/')) {
            // Transform relative paths to use the docs images API
            imgSrc = `/api/docs/images/${DOC_ROOT_KEY}/${src}`;
            console.log(`Transformed image path: ${src} -> ${imgSrc}`);
        }    
        return <img src={imgSrc} {...props} onClick={() => setFullSizeImage({src: imgSrc!, name: "Markdown image"})} />;
    };

    return (
        <>            
            {/* Regular markdown rendering */}
            <ReactMarkdown
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                remarkPlugins={[remarkGfm]}
                components={comps}
            >
                {markdownContent}
            </ReactMarkdown>
        </>
    );
}
