import React from 'react';

interface LogoBlockCompProps {
  subText: string;
}

const LogoBlockComp: React.FC<LogoBlockCompProps> = ({ 
    subText = ''
}) => {
    return (
        <div className="flex-1 flex items-center">
            <div className="mr-3">
                <img 
                    src="/logo-100px-tr.jpg" 
                    alt="Quanta Chat Logo" 
                    className="h-auto object-contain border border-blue-400/30 rounded"
                />
            </div>
            <div className="overflow-hidden">
                <h3 className="font-semibold text-blue-400">Quanta Chat</h3>
                <h5 className="font-semibold text-gray-300 truncate">{subText}</h5>
            </div>
        </div>
    );
};

export default LogoBlockComp;