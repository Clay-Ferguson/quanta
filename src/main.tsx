import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.scss'; 
import './index.css';
import QuantaChat from './QuantaChat.tsx';
import { GlobalStateProvider } from './GlobalState'; 

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <GlobalStateProvider> 
            <QuantaChat />
        </GlobalStateProvider>
    </StrictMode>,
);