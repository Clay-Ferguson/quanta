import FooterComponent from '../components/FooterComp';
import HeaderComp from '../components/HeaderComp';
import ImageViewerComp from '../components/ImageViewerComp';
import MainComp from '../components/MainComp';

function QuantaChatPage() {
    return (
        <div className="h-screen flex flex-col w-screen min-w-full bg-gray-900 text-gray-200 border border-blue-400/30">
            <HeaderComp/>
            <MainComp />
            <FooterComponent/>
            <ImageViewerComp />
        </div>
    )
}

export default QuantaChatPage;