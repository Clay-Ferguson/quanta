
interface LogoBlockCompProps {
  subText: string;
  clazz?: string;
}

/**
 * LogoBlockComp is a React component that displays the Quanta Chat logo and a subtext.
 */
export default function LogoBlockComp({ subText = '', clazz = '' }: LogoBlockCompProps) {
    const handleLogoClick = () => {
        // todo-0: fix this.
        // const defaultPlugin: IPlugin | null = app.getDefaultPlugin();
        // defaultPlugin!.goToMainPage();
    }
    
    return (
        <div className={`hidden md:flex items-center ${clazz}`}>
            <div className="mr-3 cursor-pointer" onClick={handleLogoClick}>
                <img 
                    src="/logo-100px-tr.jpg" 
                    alt="Quanta Chat Logo" 
                    className="w-20 object-contain border-2 border-gray-200/30 rounded"
                />
            </div>
            <div className="overflow-hidden cursor-pointer min-w-[200px]" onClick={handleLogoClick}>
                <div className="font-semibold text-blue-400 text-xl">Quanta</div>
                <div className="font-semibold text-gray-300 text-lg">{subText}</div>
            </div>
        </div>
    );
}