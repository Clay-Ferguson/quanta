import FooterComponent from './components/FooterComp';
import HeaderComp from './components/HeaderComp';
import ImageViewerComp from './components/ImageViewerComp';
import MainComp from './components/MainComp';

// todo-0: move this to pages folder because it's really a page.
function QuantaChat() {
    return (
        <div className="h-screen flex flex-col w-screen min-w-full bg-gray-900 text-gray-200 border border-blue-400/30">
            <HeaderComp/>
            <MainComp />
            <FooterComponent/>
            <ImageViewerComp />
        </div>
    )
}

export default QuantaChat;