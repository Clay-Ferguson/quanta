import {util} from '../Util';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faFile } from '@fortawesome/free-solid-svg-icons';
import { FileBase64Intf } from '../../common/types/CommonTypes';
import { setFullSizeImage } from './ImageViewerComp';

interface AttachmentCompProps {
  attachment: FileBase64Intf;
  index?: number;
}

/**
 * Displays an attachment (image or other file) with options to download or view it in full size. Images are displayed inline with an IMG tag
 */
export default function AttachmentComp({ attachment: att, index = 0 }: AttachmentCompProps) {
    return (
        <div key={index} className="attachment-container border border-gray-600 rounded p-2 flex flex-col bg-gray-800">
            {att.type.startsWith('image/') ? (
                <>
                    {/* Image attachment with fixed height container */}
                    <div className="relative h-40 flex items-center justify-center">
                        <img 
                            src={att.data}
                            alt={att.name}
                            className="max-w-full rounded cursor-pointer max-h-40 object-contain"
                            onClick={() => setFullSizeImage(att)}
                            title="Click to view full size"
                        />
                        <button 
                            className="btn-secondary absolute top-2 right-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                util.downloadFile(att);
                            }}
                            title={`Download ${att.name}`}
                        >
                            <FontAwesomeIcon icon={faDownload} className="h-5 w-5" />
                        </button>
                    </div>
                </>
            ) : (
                <>
                    {/* Non-image attachment */}
                    <div className="flex items-center h-16">
                        <span className="text-2xl mr-2"><FontAwesomeIcon icon={faFile} className="h-5 w-5" /></span>
                        <div className="flex-1">
                            <div className="font-medium text-sm truncate text-gray-200">{att.name}</div>
                            <div className="text-xs text-gray-400">{util.formatFileSize(att.size)}</div>
                        </div>
                        <button 
                            className="btn-secondary"
                            onClick={() => {
                                util.downloadFile(att);
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
}