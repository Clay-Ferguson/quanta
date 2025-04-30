import { app } from '../AppService';
import { PageNames } from '../AppServiceTypes';

interface LogoBlockCompProps {
  subText: string;
  clazz?: string;
}



export default function LogoBlockComp({ subText = '', clazz = '' }: LogoBlockCompProps) {
    const handleLogoClick = () => app.goToPage(PageNames.quantaChat);
    
    return (
        <div className={`flex-1 flex items-center ${clazz}`} >
            <div className="mr-3 cursor-pointer" onClick={handleLogoClick}>
                <img 
                    src="/logo-100px-tr.jpg" 
                    alt="Quanta Chat Logo" 
                    className="h-auto object-contain border-2 border-gray-200/30 rounded"
                />
            </div>
            <div className="overflow-hidden cursor-pointer" onClick={handleLogoClick}>
                <h3 className="font-semibold text-blue-400">Quanta Chat</h3>
                <h5 className="font-semibold text-gray-300 truncate">{subText}</h5>
            </div>
        </div>
    );
}