 
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

// NOTE: 'root' is of course the element in "index.html" that we are mounting our React app to.
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <GlobalStateProvider> 
            {/* 
                The AppServiceConnector is a component that connects to the AppService and provides the global state.
                It is important to have this component at the root of the application so that all components can access the global state.
            */}
            <AppServiceConnector />

            {/* 
                The PageRouter is a component that handles the routing of the application.
                It is important to have this component at the root of the application so that all components can access the routing.
            */}
            <PageRouter />

            {/* 
                The AlertModalComp, ConfirmModalComp, and PromptModalComp are components that handle the modals in the application.
                It is important to have these components at the root of the application so that all components can access the modals.
            */}
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
