import React from 'react';
import { ChatMessage, FileBase64Intf } from "@common/types/CommonTypes";
import { pluginsArray } from './AppService.ts';
import { scrollEffects } from './ScrollEffects';

class Util {

    // Runs the same method on all plugins and returns their components
    getPluginComponents = (method: any): React.ReactElement[] | null => {
        const components: React.ReactElement[] = [];
        for (const plugin of pluginsArray) {
            const func = (plugin as any)[method];
            if (func && typeof func === 'function') { 
                const comp = func();
                if (comp) {
                    components.push(comp);
                }
            }
        }
        return components;
    }

    getPluginComponentsWrapped = (method: string, divPrefix: string): React.ReactElement | null => {
        const components = this.getPluginComponents(method);
        if (!components || components.length === 0) {
            return null;
        }
        return React.createElement(
            React.Fragment,
            null,
            components.map((component, index) =>
                React.createElement(
                    'div',
                    { key: `${divPrefix}-${index}` },
                    component
                )
            )
        );
    }

    // Scroll to a specific DOM element by its ID
    scrollToElementById = (elementId: string) => {
        setTimeout(() => {
            const element = document.getElementById(elementId);
            if (element) {
                element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
            }
        }, 250);
    };

    // Clear saved scroll position and scroll to top for navigation
    scrollToTopAndClearPosition = (elementId: string) => {
        setTimeout(() => {
            const element = document.getElementById(elementId);
            if (element) {
                // Clear the saved scroll position for this element
                scrollEffects.scrollPositions.delete(elementId);
                // Scroll to top
                element.scrollTop = 0;
            }
        }, 100);
    };
    
    // Find the tree node element that is closest to the top of the viewport
    findClosestTreeNodeToTop = (): string | null => {
        // Get all tree node elements (those with IDs starting with 'tree-')
        const treeElements = Array.from(document.querySelectorAll('[id^="tree-"]'));
        
        if (treeElements.length === 0) {
            return null;
        }
        
        const viewportTop = window.scrollY;
        
        let closestElement: Element | null = null;
        let smallestDistance = Infinity;
        
        for (const element of treeElements) {
            const rect = element.getBoundingClientRect();
            const elementTop = rect.top + viewportTop;
            
            // Find the element closest to the actual top of the viewport
            const distance = Math.abs(elementTop - viewportTop);
            
            // Only consider elements that are visible or just above the viewport
            if (distance < smallestDistance && elementTop >= viewportTop - 50) {
                smallestDistance = distance;
                closestElement = element;
            }
        }
        
        return closestElement ? closestElement.id : null;
    };
    
    resizeEffect = () => {
        // Handle viewport height for mobile browsers
        const updateHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
            
        // Set initial height
        updateHeight();
            
        // Update on resize and orientation change
        window.addEventListener('resize', updateHeight);
        window.addEventListener('orientationchange', updateHeight);
            
        // Add extra trigger for iOS Safari - it sometimes needs a delay
        setTimeout(updateHeight, 100);
            
        return () => {
            window.removeEventListener('resize', updateHeight);
            window.removeEventListener('orientationchange', updateHeight);
        };
    }

    stubbornScroll = (elm: any, pos: number) => {
        if (!elm) return;
        elm.scrollTop = pos;
        const scrollFunc = () => {
            elm.scrollTop = pos;
        };
        
        // Additional scroll attempts with increasing delays
        setTimeout(scrollFunc, 0);
        setTimeout(scrollFunc, 1500);
    }

    // Generate a shorter random ID
    generateShortId = () => {
        const array = new Uint8Array(12);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '');
    };

    // Utility function to get URL parameters
    getUrlParameter(name: string) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    formatMessageTime = (msg: ChatMessage) => {
        return new Date(msg.timestamp).toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
        })+" "+
        new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    fileToBase64(file: File): Promise<FileBase64Intf> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                data: reader.result as string
            });
            reader.onerror = error => reject(error);
        });
    };

    onAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        // Replace with icon if image fails to load
        const target = e.currentTarget as HTMLImageElement;
        target.style.display = 'none';
        (target.nextElementSibling! as any).style.display = 'flex';
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    formatStorageSize(bytes: number) {
        if (bytes === 0) return '0 B';

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        // Return with 2 decimal places for MB and above, 0 for KB and B
        if (i >= 2) {
            return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
        } else {
            return (bytes / Math.pow(1024, i)).toFixed(0) + ' ' + units[i];
        }
    }

    downloadFile(attachment: FileBase64Intf) {
        const downloadLink = document.createElement('a');
        downloadLink.href = attachment.data;
        downloadLink.download = attachment.name;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

    // Calculate the size of a message object in bytes
    calculateMessageSize(msg: any) {
        let totalSize = 0;
    
        // Text content size
        if (msg.content) {
            totalSize += new Blob([msg.content]).size;
        }
    
        // Metadata size (sender, timestamp, etc.)
        totalSize += new Blob([JSON.stringify({
            sender: msg.sender,
            timestamp: msg.timestamp
        })]).size;
    
        // Attachments size
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach((attachment: any) => {
                // Base64 data URLs are approximately 33% larger than the original binary
                // The actual data portion is after the comma in "data:image/jpeg;base64,..."
                if (attachment.data) {
                    const dataUrl = attachment.data;
                    const base64Index = dataUrl.indexOf(',') + 1;
                    if (base64Index > 0) {
                        const base64Data = dataUrl.substring(base64Index);
                        // Convert from base64 size to binary size (approx)
                        totalSize += Math.floor((base64Data.length * 3) / 4);
                    } else {
                        // Fallback if data URL format is unexpected
                        totalSize += new Blob([dataUrl]).size;
                    }
                }
    
                // Add size of attachment metadata
                totalSize += new Blob([JSON.stringify({
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size
                })]).size;
            });
        }
        return totalSize;
    }
}

export const util = new Util();

