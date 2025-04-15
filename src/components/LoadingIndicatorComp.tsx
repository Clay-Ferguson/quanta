
export default function LoadingIndicatorComp() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
                <div className="inline-block relative">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-400 border-t-transparent animate-spin mb-4"></div>
                </div>
                <h2 className="text-xl font-semibold text-blue-400 mt-4">Loading Quanta Chat</h2>
            </div>
        </div>
    );
};

