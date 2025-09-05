import { useEffect, useState, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faMicrophone, faStop, faTags } from '@fortawesome/free-solid-svg-icons';
import { TreeNode } from '../../../../../common/types/CommonTypes';
import { DocsGlobalState, gd } from '../../DocsTypes';
import { stripOrdinal, stripFileExtension } from '../../../../../common/CommonUtils';
import { handleSaveClick, handleSplitInline, handleMakeFolder } from '../TreeViewerPageOps';
import { alertModal } from '../../../../../client/components/AlertModalComp';
import TagSelector from './TagSelector';

interface EditFileProps {
    gs: DocsGlobalState;
    reRenderTree: () => Promise<TreeNode[]>;
    treeNodes: TreeNode[];
    setTreeNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
    handleCancelClick: () => void;
    contentTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Component for editing file content and filename
 */
export default function EditFile({ 
    gs, 
    reRenderTree,
    treeNodes, 
    setTreeNodes, 
    handleCancelClick, 
    contentTextareaRef 
}: EditFileProps) {
    // Cleanup effect to clear edit node when component unmounts
    useEffect(() => {
        return () => {
            // Clear the edit node when component is unmounted (e.g., user navigates away)
            gd({ 
                type: 'clearFileEditingState', 
                payload: { 
                    docsEditNode: null,
                    docsNewFileName: null,
                    docsAutoStartSpeech: false
                }
            });
        };
    }, []);

    /**
     * Prepares a filename for editing by stripping both ordinal prefix and extension
     * This needs to be defined outside useEffect to avoid lint warnings
     */
    const prepareFilenameForEditing = useCallback((filename: string): string => {
        // First strip the ordinal prefix
        const nameWithoutOrdinal = stripOrdinal(filename);
        // Then strip the extension
        return stripFileExtension(nameWithoutOrdinal);
    }, []);
    
    // Use local state for content to avoid sluggish updates on every keystroke
    const [localContent, setLocalContent] = useState(gs.docsEditNode?.content || '');
    
    // Use local state for filename to initialize with current filename when editing
    // We need to track the current node to know when we're switching to a different file
    const [currentNodeName, setCurrentNodeName] = useState<string | null>(gs.docsEditNode?.name || null);
    const [localFileName, setLocalFileName] = useState(
        gs.docsNewFileName || 
        (gs.docsEditNode?.name ? prepareFilenameForEditing(gs.docsEditNode.name) : '')
    );

    // Tag selector state
    const [showTagSelector, setShowTagSelector] = useState(false);
    // Track last selected tags for live add
    const lastSelectedTagsRef = useRef<Set<string>>(new Set());

    // <speech>
    // Speech recognition state
    const [isListening, setIsListening] = useState(false);
    const [shouldKeepListening, setShouldKeepListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const shouldKeepListeningRef = useRef(false);

    // Keep the ref in sync with state
    useEffect(() => {
        shouldKeepListeningRef.current = shouldKeepListening;
    }, [shouldKeepListening]);
    // </speech>

    // Update local content and filename only when switching to a different node
    useEffect(() => {
        setLocalContent(gs.docsEditNode?.content || '');
        
        // Only update the filename when we're switching to a different node
        const newNodeName = gs.docsEditNode?.name || null;
        if (newNodeName !== currentNodeName) {
            setLocalFileName(
                gs.docsNewFileName || 
                (gs.docsEditNode?.name ? prepareFilenameForEditing(gs.docsEditNode.name) : '')
            );
            setCurrentNodeName(newNodeName);
        }
    }, [gs.docsEditNode, gs.docsNewFileName, currentNodeName, prepareFilenameForEditing]);

    // <speech>
    // Initialize speech recognition - only create once
    useEffect(() => {
        if (!('webkitSpeechRecognition' in window)) {
            console.warn('Speech recognition not supported in this browser');
            return;
        }

        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
        };

        recognition.onend = () => {
            setIsListening(false);
            // Auto-restart if allowed - use ref to avoid dependency
            if (shouldKeepListeningRef.current) {
                try {
                    recognition.start();
                } catch (error) {
                    console.error('Error restarting speech recognition:', error);
                    setShouldKeepListening(false);
                }
            }
        };

        recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript.trim();
                    
                    if (!contentTextareaRef.current) return;
                    
                    const textarea = contentTextareaRef.current;
                    const cursorPosition = textarea.selectionStart;
                    const selectionEnd = textarea.selectionEnd;
                    
                    // Get the current content from the textarea directly to ensure we have the latest
                    const currentContent = textarea.value;
                    
                    // Insert transcript at cursor position, replacing any selected text
                    const beforeCursor = currentContent.substring(0, cursorPosition);
                    const afterCursor = currentContent.substring(selectionEnd);
                    const insert = transcript + ' ';
                    
                    const newContent = beforeCursor + insert + afterCursor;
                    
                    // Update both the textarea value and local state
                    textarea.value = newContent;
                    setLocalContent(newContent);
                    
                    // Set cursor position after the inserted text
                    const newCursorPosition = cursorPosition + insert.length;
                    textarea.setSelectionRange(newCursorPosition, newCursorPosition);
                    textarea.focus();
                }
            }
        };

        recognitionRef.current = recognition;

        // Cleanup on unmount
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (error) {
                    console.error('Error stopping speech recognition on cleanup:', error);
                }
            }
        };
    }, [contentTextareaRef]); // Only contentTextareaRef is stable and needed

    // Auto-start speech recognition if flag is set
    useEffect(() => {
        if (gs.docsAutoStartSpeech && recognitionRef.current && contentTextareaRef.current) {
            // Clear the flag first to prevent repeated auto-starts
            gd({ type: 'clearAutoStartSpeech', payload: { docsAutoStartSpeech: false }});
            
            // Check if speech recognition is supported
            if (!('webkitSpeechRecognition' in window)) {
                console.warn('Speech recognition not supported in this browser');
                return;
            }
            
            // Auto-start speech recognition
            setShouldKeepListening(true);
            shouldKeepListeningRef.current = true;
            try {
                recognitionRef.current.start();
                // Focus the textarea to make it clear where the text will go
                contentTextareaRef.current.focus();
            } catch (error) {
                console.error('Error auto-starting speech recognition:', error);
                setShouldKeepListening(false);
                shouldKeepListeningRef.current = false;
            }
        }
    }, [gs.docsAutoStartSpeech, contentTextareaRef]);

    // Stop listening when component unmounts or editing stops
    useEffect(() => {
        return () => {
            // Cleanup when component unmounts
            setShouldKeepListening(false);
            shouldKeepListeningRef.current = false;
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (error) {
                    console.error('Error stopping speech recognition on cleanup:', error);
                }
            }
        };
    }, []); // Empty dependency array - only run on mount/unmount
    // </speech>

    const handleLocalContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalContent(event.target.value);
    };

    const handleLocalFileNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newFileName = event.target.value;
        setLocalFileName(newFileName);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault(); // Prevent browser's default save dialog
            handleSaveClick(gs, treeNodes, setTreeNodes, reRenderTree, localContent, localFileName);
        } else if (event.key === 'Escape') {
            event.preventDefault(); // Prevent any default behavior
            handleCancelClick();
        }
    };

    const handleInsertTime = () => {
        if (!contentTextareaRef.current) return;
        
        const textarea = contentTextareaRef.current;
        const cursorPosition = textarea.selectionStart;
        const currentContent = localContent;
        
        // Create formatted timestamp: YYYY/MM/DD HH:MM:SS AM/PM
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const hoursStr = String(hours).padStart(2, '0');
        
        const timestamp = `[${year}/${month}/${day} ${hoursStr}:${minutes}:${seconds} ${ampm}]`;
        
        // Insert timestamp at cursor position
        const beforeCursor = currentContent.substring(0, cursorPosition);
        const afterCursor = currentContent.substring(cursorPosition);
        const newContent = beforeCursor + timestamp + afterCursor;
        
        // Update local content only
        setLocalContent(newContent);
        
        // Set cursor position after the inserted timestamp
        setTimeout(() => {
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(cursorPosition + timestamp.length, cursorPosition + timestamp.length);
            }
        }, 0);
    };

    // Live tag add: insert only newly checked tag
    const handleLiveTagAdd = (selectedTags: string[]) => {
        // Only insert if a new tag was checked (not unchecked)
        const prevTags = lastSelectedTagsRef.current;
        // Find the tag that was just added
        const newTag = selectedTags.find(tag => !prevTags.has(tag));
        if (newTag && contentTextareaRef.current) {
            const textarea = contentTextareaRef.current;
            const cursorPosition = textarea.selectionStart;
            const currentContent = localContent;
            // Insert tag at cursor position
            const beforeCursor = currentContent.substring(0, cursorPosition);
            const afterCursor = currentContent.substring(cursorPosition);
            const tagText = newTag + ' ';
            const newContent = beforeCursor + tagText + afterCursor;
            setLocalContent(newContent);
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(cursorPosition + tagText.length, cursorPosition + tagText.length);
            }, 0);
        }
        // Update lastSelectedTagsRef for next call
        lastSelectedTagsRef.current = new Set(selectedTags);
    };

    const handleToggleTagSelector = () => {
        setShowTagSelector(!showTagSelector);
    };

    const handleCancelTagSelector = () => {
        setShowTagSelector(false);
    };

    // <speech>
    const handleSpeechToggle = () => {
        if (!('webkitSpeechRecognition' in window)) {
            alertModal('Speech recognition is not supported in this browser. Please use Google Chrome.');
            return;
        }

        if (!recognitionRef.current) {
            console.error('Speech recognition not initialized');
            return;
        }

        if (shouldKeepListening) {
            // Stop listening
            setShouldKeepListening(false);
            shouldKeepListeningRef.current = false;
            try {
                recognitionRef.current.stop();
            } catch (error) {
                console.error('Error stopping speech recognition:', error);
            }
        } else {
            // Start listening
            setShouldKeepListening(true);
            shouldKeepListeningRef.current = true;
            try {
                recognitionRef.current.start();
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                setShouldKeepListening(false);
                shouldKeepListeningRef.current = false;
            }
        }
    };
    // </speech>

    const calculateRows = () => {
        let min = 10;
        if (!localContent || localContent.length < 300) {
            min = 3; // Default minimum rows if content is empty
        }
        if (localContent.length > 1000) {
            min = 20;
        }
        const newlineCount = (localContent.match(/\n/g) || []).length;
        return Math.max(min, newlineCount + 1); // Minimum of 'min' rows, always +1 more than content needs
    };
    
    return (
        <div>
            <input
                type="text"
                value={localFileName}
                onChange={handleLocalFileNameChange}
                className="w-full mb-3 p-2 bg-gray-800 border border-gray-600 text-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Filename (optional)"
            />
            <textarea
                ref={contentTextareaRef}
                value={localContent}
                onChange={handleLocalContentChange}
                onKeyDown={handleKeyDown}
                rows={calculateRows()}
                className={`w-full p-3 bg-gray-800 border text-gray-200 font-mono resize-vertical focus:outline-none focus:ring-2 focus:border-transparent ${
                    isListening 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-600 focus:ring-blue-500'
                }`}
                placeholder="Enter content here..."
            />
            <div className="flex gap-2 mt-2 mb-3">
                <button
                    onClick={() => {
                        handleSaveClick(gs, treeNodes, setTreeNodes, reRenderTree, localContent, localFileName);
                    }}
                    className="btn-primary"
                >
                    Save
                </button>
                <button 
                    onClick={() => handleSplitInline(gs, treeNodes, setTreeNodes, reRenderTree, localContent)}
                    className="btn-secondary"
                >
                    Split
                </button>
                <button 
                    onClick={() => handleMakeFolder(gs, treeNodes, setTreeNodes, reRenderTree, localContent)}
                    className="btn-secondary"
                >
                    Make Folder
                </button>
                <button 
                    onClick={handleToggleTagSelector}
                    className={showTagSelector ? "bg-blue-600 text-white rounded-md flex items-center justify-center h-10 w-10" : "btn-icon"}
                    title="Insert Tags"
                >
                    <FontAwesomeIcon icon={faTags} className="h-5 w-5" />
                </button>
                <button 
                    onClick={handleInsertTime}
                    className="btn-icon"
                    title="Insert Time"
                >
                    <FontAwesomeIcon icon={faClock} className="h-5 w-5" />
                </button>
                {/* <speech> */}
                <button 
                    onClick={handleSpeechToggle}
                    className={isListening ? "btn-danger" : "btn-icon"}
                    title={isListening ? "Stop Speech Recognition" : "Start Speech Recognition"}
                >
                    <FontAwesomeIcon icon={isListening ? faStop : faMicrophone} className="h-5 w-5" />
                </button>
                {/* </speech> */}
                <button
                    onClick={handleCancelClick}
                    className="btn-danger"
                >
                    Cancel
                </button>
            </div>
            
            {/* Tag Selector */}
            {showTagSelector && (
                <TagSelector 
                    onCancel={handleCancelTagSelector}
                    handleLiveTagAdd={handleLiveTagAdd}
                />
            )}
        </div>
    );
}
