import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { useState, useEffect } from 'react';
import './LinkPreview.css';

interface MarkdownDisplayProps {
  markdownContent: string;
}

interface LinkPreviewData {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
}

export default function Markdown({ markdownContent }: MarkdownDisplayProps) {
    // Store URLs found in the markdown
    const [urls, setUrls] = useState<string[]>([]);
    // Store link preview data
    const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreviewData | null>>({});
    
    // Extract URLs from markdown content
    useEffect(() => {
        // Simple regex to find URLs in the markdown
        const urlRegex = /(https?:\/\/[^\s)]+)/g;
        const matches = markdownContent.match(urlRegex);
        if (matches) {
            setUrls(Array.from(new Set(matches)));
        } else {
            setUrls([]);
        }
    }, [markdownContent]);
    
    // Fetch link previews for URLs
    useEffect(() => {
        const fetchLinkPreviews = async () => {
            const previews: Record<string, LinkPreviewData | null> = {};
            
            for (const url of urls) {
                // Skip if we already have this preview
                if (linkPreviews[url]) continue;
                
                try {
                    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
                    const data = await response.json();
                    
                    if (data.success) {
                        previews[url] = data.data;
                    } else {
                        previews[url] = null;
                    }
                } catch (error) {
                    console.error('Failed to fetch link preview:', error);
                    previews[url] = null;
                }
            }
            
            setLinkPreviews(prev => ({ ...prev, ...previews }));
        };
        
        if (urls.length > 0) {
            fetchLinkPreviews();
        }
    }, [urls]);

    return (
        <>
            {/* Render link previews for extracted URLs */}
            {urls.map((url, index) => {
                const preview = linkPreviews[url];
                if (!preview) return null;
                
                return (
                    <div key={`preview-${index}`} className="link-preview mb-3">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="link-preview-card">
                            {preview.image && (
                                <div className="link-preview-image">
                                    <img src={preview.image} alt={preview.title || url} />
                                </div>
                            )}
                            <div className="link-preview-content">
                                {preview.title && <h4>{preview.title}</h4>}
                                {preview.description && <p>{preview.description}</p>}
                                {preview.siteName && <span className="link-preview-site">{preview.siteName}</span>}
                            </div>
                        </a>
                    </div>
                );
            })}
            
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
