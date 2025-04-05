import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import QuantaChat from './QuantaChat.ts';
import { GlobalStateProvider } from './GlobalState'; // Import the provider

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <GlobalStateProvider> {/* Wrap your QuantaChat component with the provider */}
            <QuantaChat />
        </GlobalStateProvider>
    </StrictMode>,
);