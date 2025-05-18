import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
interface MarkdownDisplayProps {
  markdownContent: string;
}

/**
 * Displays a markdown content using ReactMarkdown. It uses rehypeRaw and rehypeSanitize for security and remarkGfm for GitHub Flavored Markdown support.
 */
export default function Markdown({ markdownContent }: MarkdownDisplayProps) {    
    return (
        <>            
            {/* Regular markdown rendering */}
            <ReactMarkdown
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                remarkPlugins={[remarkGfm]}
                components={{
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    a: ({ node, ...props }) => (
                        <a target="_blank" rel="noopener noreferrer" {...props} />
                    )
                }}
            >
                {markdownContent}
            </ReactMarkdown>
        </>
    );
}
