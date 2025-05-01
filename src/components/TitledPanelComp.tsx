import React from 'react';

interface TitledPanelProps {
  title: string;
  children: React.ReactNode;
}

export default function TitledPanelComp({ title, children }: TitledPanelProps) {
    return (
        <div className={`bg-gray-800/80 border border-blue-700/30 rounded-lg overflow-hidden`}>
            <div className="text-xl font-medium text-white bg-blue-900 py-2 px-4 shadow-md">{title}</div>
            <div className="p-4">
                <div className="bg-gray-700/90 rounded-lg p-4 border border-blue-800/20 shadow-inner">
                    {children}
                </div>
            </div>
        </div>
    );
};
