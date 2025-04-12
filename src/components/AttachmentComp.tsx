import React from 'react';
import {util} from '../Util';
import { app } from '../AppService';
import { MessageAttachment } from '../AppServiceIntf';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faFile } from '@fortawesome/free-solid-svg-icons';

interface AttachmentCompProps {
  attachment: MessageAttachment;
  index?: number;
}

const AttachmentComp: React.FC<AttachmentCompProps> = ({ 
    attachment: att,
    index = 0 
}) => {
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
                            onClick={() => app.setFullSizeImage(att)}
                            title="Click to view full size"
                        />
                        <button 
                            className="btn-secondary absolute top-2 right-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                downloadFile(att);
                            }}
                            title={`Download ${att.name}`}
                        >
                            <FontAwesomeIcon icon={faDownload} className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="text-xs mt-1 truncate text-gray-300">{att.name}</div>
                </>
            ) : (
                <>
                    {/* Non-image attachment */}
                    <div className="flex items-center">
                        <span className="text-2xl mr-2"><FontAwesomeIcon icon={faFile} className="h-5 w-5" /></span>
                        <div className="flex-1">
                            <div className="font-medium text-sm truncate text-gray-200">{att.name}</div>
                            <div className="text-xs text-gray-400">{util.formatFileSize(att.size)}</div>
                        </div>
                        <button 
                            className="btn-secondary"
                            onClick={() => {
                                downloadFile(att);
                            }}
                            title={`Download ${att.name}`}
                        >
                            <FontAwesomeIcon icon={faDownload} className="h-5 w-5" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default AttachmentComp;