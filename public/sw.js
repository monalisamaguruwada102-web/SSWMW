const CACHE_NAME = 'smartstore-v5';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/utils.js',
    './js/auth.js',
    './js/dashboard.js',
    './js/products.js',
    './js/inventory.js',
    './js/movements.js',
    './js/storage.js',
    './js/orders.js',
    './js/reports.js',
    './js/users.js',
    './js/notifications.js',
    './js/stockMaster.js',
    './js/procurement.js',
    './js/grn.js',
    './js/transfers.js',
    './js/picking.js',
    './js/analytics.js',
    './manifest.json',
    './icons/icon.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
