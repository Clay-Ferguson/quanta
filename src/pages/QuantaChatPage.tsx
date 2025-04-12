import FooterComponent from '../components/FooterComp';
import HeaderComp from '../components/HeaderComp';
import ImageViewerComp from '../components/ImageViewerComp';
import MainComp from '../components/MainComp';

function QuantaChatPage() {
    return (
        <div className="page-container">
            <HeaderComp/>
            <MainComp />
            <FooterComponent/>
            <ImageViewerComp />
        </div>
    )
}

export default QuantaChatPage;