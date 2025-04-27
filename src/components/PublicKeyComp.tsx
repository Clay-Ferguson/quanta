interface PublicKeyComp {
  publicKey: string;
}

export default function PublicKeyComp({ publicKey }: PublicKeyComp) {
    return (
        <div className="flex items-center">
            <span className="font-mono text-sm truncate max-w-[200px]" title={publicKey}>
                {publicKey.length > 20
                    ? `${publicKey.substring(0, 10)}...${publicKey.substring(publicKey.length - 10)}`
                    : publicKey}
            </span>
            <button 
                className="ml-2 text-xs bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded"
                onClick={() => navigator.clipboard.writeText(publicKey)}
            >
        Copy 
            </button>
        </div>
    );
}