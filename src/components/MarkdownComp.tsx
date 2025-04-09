import ReactMarkdown from 'react-markdown';

interface MarkdownDisplayProps {
  markdownContent: string;
}

const Markdown = ({ markdownContent }: MarkdownDisplayProps) => {
    return <ReactMarkdown>{markdownContent}</ReactMarkdown>;
};

export default Markdown;
