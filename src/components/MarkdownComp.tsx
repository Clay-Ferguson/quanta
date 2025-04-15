import ReactMarkdown from 'react-markdown';

interface MarkdownDisplayProps {
  markdownContent: string;
}

export default function Markdown({ markdownContent }: MarkdownDisplayProps) {
    return <ReactMarkdown>{markdownContent}</ReactMarkdown>;
}
