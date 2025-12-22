const CACHE = "lpm-digi-cache-v1";

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches
            .open(CACHE)
            .then((c) =>
                c.addAll(["/", "/index.html", "/app.js", "/style.css"])
            )
    );
});

self.addEventListener("fetch", (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});
