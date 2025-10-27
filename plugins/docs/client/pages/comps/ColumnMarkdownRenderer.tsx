import Markdown from "@client/components/MarkdownComp";

interface ColumnMarkdownRendererProps {
    content: string;
    docMode?: boolean;
}

/**
 * Component that renders markdown content in columns if tilde delimiters (***) are found,
 * otherwise renders as a single markdown component.
 */
export default function ColumnMarkdownRenderer({ content, docMode = true }: ColumnMarkdownRendererProps) {
    // Check if content contains asterisk delimiters on their own lines
    const tildeDelimiterRegex = /\n\*\*\*\n/g;
    const hasDelimiters = tildeDelimiterRegex.test(content);
    
    if (!hasDelimiters) {
        // No delimiters found, render as single markdown component
        return <Markdown markdownContent={content} docMode={docMode} />;
    }
    
    // Split content by asterisk delimiters
    const columns = content.split(/\n\*\*\*\n/);
    
    // Remove empty columns that might result from splitting
    const nonEmptyColumns = columns.filter(col => col.trim().length > 0);
    
    if (nonEmptyColumns.length <= 1) {
        // If we end up with only one column after filtering, render normally
        return <Markdown markdownContent={content} docMode={docMode} />;
    }
    
    // Determine grid columns class based on number of columns
    const getGridClass = (numCols: number): string => {
        switch (numCols) {
        case 2: return 'grid-cols-2';
        case 3: return 'grid-cols-3';
        case 4: return 'grid-cols-4';
        default: return numCols > 4 ? 'grid-cols-4' : 'grid-cols-1'; // Max 4 columns for readability
        }
    };
    
    return (
        <div className={`grid ${getGridClass(nonEmptyColumns.length)} gap-4`}>
            {nonEmptyColumns.map((columnContent, index) => (
                <div key={index} className="min-w-0"> {/* min-w-0 prevents overflow in grid */}
                    <Markdown markdownContent={columnContent.trim()} docMode={docMode} />
                </div>
            ))}
        </div>
    );
}
