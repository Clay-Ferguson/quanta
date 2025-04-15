import FooterComp from '../components/FooterComp';
import HeaderComp from '../components/HeaderComp';
import ImageViewerComp from '../components/ImageViewerComp';
import MainComp from '../components/MainComp';

export default function QuantaChatPage() {
    return (
        <div className="page-container">
            <HeaderComp/>
            <MainComp />
            <FooterComp/>
            <ImageViewerComp />
        </div>
    );
}