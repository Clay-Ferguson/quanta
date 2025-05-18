 
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.scss'; 
import {  AppServiceConnector, GlobalStateProvider } from './GlobalState'; 
import AlertModalComp from './components/AlertModalComp.tsx';
import {ConfirmModalComp} from './components/ConfirmModalComp.tsx';
import { PromptModalComp } from './components/PromptModalComp.tsx';
import {logInit} from './ClientLogger.ts';
import { app } from './AppService.ts';
import PageRouter from './PageRouter.tsx';

logInit(); // Initialize the logger

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <GlobalStateProvider> 
            <AppServiceConnector />
            <PageRouter />
            <AlertModalComp />
            <ConfirmModalComp />
            <PromptModalComp />
        </GlobalStateProvider>
    </StrictMode>
);

// We do the initialization on a delay so that a render cycle is guaranteed to have completed 
// before we start the app, which is important to get our global state ref set up correctly.
setTimeout(() => {
    app.init();
}, 250)
