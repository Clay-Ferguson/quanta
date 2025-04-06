import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.scss'; 
import './index.css';
import QuantaChat from './QuantaChat.tsx';
import { GlobalStateProvider } from './GlobalState'; 
import AppService from './AppService';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <GlobalStateProvider> 
            <QuantaChat />
        </GlobalStateProvider>
    </StrictMode>,
);

const appService = AppService.getInst();
if (appService) {
    console.log('AppService singleton initialized successfully');
}