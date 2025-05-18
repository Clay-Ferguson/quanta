import { app } from "../AppService";

interface HexKeyCompProps {
  hexKey: string;
}

/**
 * Displays a hex key with options to copy it to the clipboard or show it in an alert.
 */
export default function HexKeyComp({ hexKey }: HexKeyCompProps) {
    // Check if hexKey is a valid non-empty string
    if (!hexKey || typeof hexKey !== 'string') {
        return <div className="text-sm text-gray-400">Key not set</div>;
    }
    
    return (
        <div className="flex items-center">
            <span className="font-mono text-sm truncate max-w-[200px]" title={hexKey}>
                {hexKey.length > 20
                    ? `${hexKey.substring(0, 10)}...${hexKey.substring(hexKey.length - 10)}`
                    : hexKey}
            </span>
            <button 
                className="ml-2 text-xs bg-amber-700 hover:bg-amber-600 px-2 py-0.5 rounded"
                onClick={() => {
                    navigator.clipboard.writeText(hexKey);
                    app.alert("Key copied to clipboard");
                }}
            >
                Copy 
            </button>
            <button 
                className="ml-2 text-xs bg-amber-700 hover:bg-amber-600 px-2 py-0.5 rounded"
                // We intentionally use the browser alert here to show the hexKey, rather than using app.alert
                // because app.alert is not designed to show long strings.
                onClick={() => alert(hexKey)}
            >
                Show
            </button>
        </div>
    );
}