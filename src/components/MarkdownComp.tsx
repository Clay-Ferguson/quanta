import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface MarkdownDisplayProps {
  markdownContent: string;
}

export default function Markdown({ markdownContent }: MarkdownDisplayProps) {
    return (
        <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
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
    );
}
