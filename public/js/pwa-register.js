// Service Worker Registration untuk PWA
// File ini akan mendaftarkan service worker untuk enable offline support

(function() {
  'use strict';

  // Cek apakah browser support service worker
  if ('serviceWorker' in navigator) {
    // Tunggu sampai halaman fully loaded
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker registered successfully:', registration.scope);
          
          // Cek update setiap kali halaman di-load
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Ada service worker baru yang sudah terinstall
                console.log('🔄 Service Worker baru tersedia. Refresh halaman untuk update.');
                // Optional: Tampilkan notifikasi ke user untuk refresh
                // showUpdateNotification();
              }
            });
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });

      // Handle service worker messages (untuk update manual)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('🔄 Service Worker updated');
        }
      });
    });

    // Handle service worker controller change (untuk update)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('🔄 Service Worker controller changed, reloading page...');
        // Optional: Auto reload
        // window.location.reload();
      }
    });
  } else {
    console.warn('⚠️ Service Worker tidak didukung di browser ini');
  }
})();

