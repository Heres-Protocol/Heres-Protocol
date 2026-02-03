'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js').then(
                    (registration) => {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    },
                    (err) => {
                        console.log('ServiceWorker registration failed: ', err);
                    }
                );
            });
        }
    }, []);

    return null;
}
