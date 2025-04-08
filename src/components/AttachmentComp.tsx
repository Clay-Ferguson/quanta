import React from 'react';
import Util from '../Util';

interface MessageAttachment {
  name: string;
  type: string;
  size: number;
  data: string;
}

interface AttachmentCompProps {
  attachment: MessageAttachment;
  toggleFullSize: (src: string, name: string) => void;
  index?: number;
}

const AttachmentComp: React.FC<AttachmentCompProps> = ({ 
    attachment: att, 
    toggleFullSize, 
    index = 0 
}) => {
    const util = Util.getInst();

    const downloadFile = (attachment: MessageAttachment) => {
        const downloadLink = document.createElement('a');
        downloadLink.href = attachment.data;
        downloadLink.download = attachment.name;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    return (
        <div key={index} className="attachment-container border border-gray-600 rounded p-2 flex flex-col bg-gray-800">
            {att.type.startsWith('image/') ? (
                <>
                    {/* Image attachment */}
                    <div className="relative">
                        <img 
                            src={att.data}
                            alt={att.name}
                            className="max-w-full rounded cursor-pointer max-h-40 object-contain"
                            onClick={() => toggleFullSize(att.data, att.name)}
                            title="Click to view full size"
                        />
                        <button 
                            className="absolute top-1 right-1 bg-blue-600 text-gray-100 rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-700"
                            onClick={(e) => {
                                e.stopPropagation();
                                downloadFile(att);
                            }}
                            title={`Download ${att.name}`}
                        >
              ⬇️
                        </button>
                    </div>
                    <div className="text-xs mt-1 truncate text-gray-300">{att.name}</div>
                </>
            ) : (
                <>
                    {/* Non-image attachment */}
                    <div className="flex items-center">
                        <span className="text-2xl mr-2">📄</span>
                        <div className="flex-1">
                            <div className="font-medium text-sm truncate text-gray-200">{att.name}</div>
                            <div className="text-xs text-gray-400">{util.formatFileSize(att.size)}</div>
                        </div>
                        <button 
                            className="bg-blue-600 text-gray-100 rounded px-2 py-1 text-sm hover:bg-blue-700"
                            onClick={() => {
                                downloadFile(att);
                            }}
                            title={`Download ${att.name}`}
                        >
              Download
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default AttachmentComp;