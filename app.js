// app.js – Simple client‑side router & UI logic for MyGallery
// ---------------------------------------------------------------
// This script is loaded on every page (index.html, category.html, album.html, photo.html)
// It fetches the generated data.json, parses URL parameters and renders the appropriate view.
// It also handles navigation, zoom, and metadata toggles.

// Global data holder
let galleryData = null;

// Utility: get path prefix based on depth
function getPathPrefix() {
    const path = window.location.pathname;
    if (path.includes('/albums/') || path.includes('/category/')) return '../';
    return '';
}

// Utility: get query parameters as an object
function getQueryParams() {
    const params = {};
    const search = window.location.search.substring(1);
    if (!search) return params;
    search.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return params;
}

// Fetch the manifest (public/data.json). All pages are served from the same root, so we can use a relative path.
async function loadData() {
    try {
        const prefix = getPathPrefix();
        const resp = await fetch(`${prefix}data.json`);
        if (!resp.ok) throw new Error('Failed to load data.json');
        galleryData = await resp.json();
        applyBranding(); // Apply globally
        route();
    } catch (e) {
        console.error(e);
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `<div class="container mt-5"><div class="alert alert-danger">
                <h4>Error Loading Gallery</h4>
                <p>Unable to load gallery data.</p>
                <code class="d-block mt-2">${e.message}</code>
                <pre class="mt-2 small text-muted">${e.stack}</pre>
             </div></div>`;
        }
    }
}

// Router – decide which view to render based on query params
// Router – decide which view to render based on query params or page context
// Router – decide which view to render based on query params or page context
function route() {
    const params = getQueryParams();

    // --- Dynamic Navbar ---
    const renderNavbar = () => {
        const navMenu = document.getElementById('nav-menu'); // If you have a specific UL for menu items
        // Wait, standard Bootstrap navbar structure in your template might be hardcoded as just "MyGallery" brand.
        // We need to inject links. Let's assume there's a container or we append.
        // Checking navbar.html: 
        // <div class="container-fluid"><a class="navbar-brand">MyGallery</a></div>
        // There is no query selector for specific links yet. 
        // We should probably update navbar.html to include a collapse target first, OR just append a simple list.
        // User requested: "Nav bar of the home page... consists of what is in the configuration".

        // Let's Find the container
        const navContainer = document.querySelector('.navbar .container-fluid');
        if (!navContainer) return;

        // Check if we already have the collapse/list, if not create it (Dynamic Injection)
        let collapseDiv = document.getElementById('navbar-content');
        if (!collapseDiv) {
            // Create Toggler
            const toggler = document.createElement('button');
            toggler.className = 'navbar-toggler';
            toggler.type = 'button';
            toggler.setAttribute('data-bs-toggle', 'collapse');
            toggler.setAttribute('data-bs-target', '#navbar-content');
            toggler.innerHTML = '<span class="navbar-toggler-icon"></span>';
            navContainer.appendChild(toggler);

            // Create Collapse Content
            collapseDiv = document.createElement('div');
            collapseDiv.id = 'navbar-content';
            collapseDiv.className = 'collapse navbar-collapse';
            navContainer.appendChild(collapseDiv);
        }

        const navList = document.createElement('ul');
        navList.className = 'navbar-nav ms-auto mb-2 mb-lg-0';

        const navConfig = galleryData.config.navbar || [
            { label: 'Home', url: 'index.html' },
            { label: 'Categories', url: 'categories.html' }
        ];

        navConfig.forEach(item => {
            const li = document.createElement('li');
            li.className = 'nav-item';
            // Handle prefix if we are in subpage. 
            // WAIT. build.js handled prefix for static links in template.
            // But dynamic JS doesn't know "where" it is easily unless we pass `pathToRoot` var to JS too?
            // Or we just use absolute / params? Static pages are relative.
            // Quick fix: Check if we are in a subfolder (URL check)
            let href = item.url;
            // Basic detection for "depth"
            const depth = window.location.pathname.split('/').length -
                (window.location.pathname.endsWith('/') ? 1 : 0) -
                (galleryData.config.baseUrl ? new URL(galleryData.config.baseUrl).pathname.split('/').length : 2); // Very rough

            // Simpler: If we are in 'albums/' or 'category/', prepend '../'
            const pathStr = window.location.pathname;
            if (pathStr.includes('/albums/') || pathStr.includes('/category/')) {
                if (!href.startsWith('http') && !href.startsWith('../')) {
                    href = '../' + href;
                }
            }

            li.innerHTML = `<a class="nav-link" href="${href}">${item.label}</a>`;
            navList.appendChild(li);
        });

        collapseDiv.innerHTML = '';
        collapseDiv.appendChild(navList);
    }

    // --- Home Feed (Pinterest Style) ---
    const renderHomeFeed = async () => {
        const feedContainer = document.getElementById('home-feed');
        if (!feedContainer) return;

        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'block';

        try {
            // Determine path to all_photos.json
            let jsonPath = 'all_photos.json';
            if (window.location.pathname.includes('/albums/') || window.location.pathname.includes('/category/')) {
                jsonPath = '../all_photos.json';
            }

            const res = await fetch(jsonPath);
            if (!res.ok) throw new Error('Failed to load photos');
            const allPhotos = await res.json();

            // State for pagination
            let currentIndex = 0;
            const BATCH_SIZE = 20;

            const loadMore = () => {
                const batch = allPhotos.slice(currentIndex, currentIndex + BATCH_SIZE);
                if (batch.length === 0) {
                    if (loading) loading.style.display = 'none';
                    return;
                }

                // Determine prefix for assets based on current location
                // If we are in /albums/ or /category/, we need '../'
                // But wait, getPathPrefix() helper exists at top of file? 
                // Let's rely on manual check to be safe inside this function or use the helper if available scope-wise.
                // The loadData() uses getPathPrefix(), let's reuse logic.
                let prefix = '';
                if (window.location.pathname.includes('/albums/') || window.location.pathname.includes('/category/')) {
                    prefix = '../';
                }

                batch.forEach(photo => {
                    const el = document.createElement('div');
                    el.className = 'gallery-item';

                    // Link to PHOTO VIEWER
                    // Fix: Use 'photo' parameter instead of 'id' to match route() logic
                    const viewerUrl = `${prefix}photo.html?album=${encodeURIComponent(photo.albumId)}&photo=${encodeURIComponent(photo.id)}`;
                    const thumbUrl = prefix + photo.thumb;

                    el.innerHTML = `
                        <a href="${viewerUrl}" class="album-card-hover d-block text-decoration-none">
                            <div class="card bg-transparent border-0">
                                <img src="${thumbUrl}" class="rounded shadow-sm" style="width:100%; display:block;" loading="lazy" alt="${photo.title}">
                                <div class="mt-2 text-dark small fw-bold px-1 text-truncate">${photo.title}</div>
                            </div>
                        </a>
                    `;
                    feedContainer.appendChild(el);
                });

                currentIndex += BATCH_SIZE;

                // Keep loading button or intersection observer?
                // Let's use simple Intersection Observer for infinite scroll
                if (currentIndex < allPhotos.length) {
                    observeFooter();
                } else {
                    if (loading) loading.style.display = 'none';
                }
            };

            // Observer
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            }, { rootMargin: '200px' });

            const observeFooter = () => {
                if (loading) observer.observe(loading);
            };

            loadMore(); // Initial load

        } catch (err) {
            console.error(err);
            if (feedContainer) feedContainer.innerHTML = '<p class="text-center text-muted col-12">Failed to load feed.</p>';
        }
    };


    // Routing Logic Update
    const init = () => {
        const context = window.initialContext || {};

        if (context.type === 'home_feed') {
            renderHomeFeed();
        } else if (context.type === 'home' || context.type === 'categories') { // 'home' was old categories page type
            renderHome(); // Assuming renderHome now handles categories
        } else if (context.type === 'category') {
            renderCategory(context.id);
        } else if (context.type === 'album') {
            renderAlbum(context.id);
        } else {
            // Fallback for query params (like photo.html, tag.html)
            // Check specific pages based on unique DOM elements (Fallback or dynamic pages like Tags/Photo)
            const isCategoryPage = !!document.getElementById('category-title');
            const isAlbumPage = !!document.getElementById('album-title');
            const isPhotoPage = !!document.getElementById('photo-container');
            const isHomePage = !!document.getElementById('categories'); // This is for the old categories page
            const isTagsPage = !!document.getElementById('tags-container');
            const isTagDetailPage = !!document.getElementById('tag-photos');
            const isHomeFeedPage = !!document.getElementById('home-feed'); // New check for home feed

            // Filename checks for Index/Categories (Fallback)
            const pathname = window.location.pathname;
            if (pathname.endsWith('categories.html') || pathname.endsWith('index.html') || pathname.endsWith('/')) {
                if (isHomePage) {
                    renderHome();
                } else if (isHomeFeedPage) { // If it's the home feed page
                    renderHomeFeed();
                }
            }

            if (isPhotoPage) {
                if (params.album && params.photo) {
                    renderPhoto(params.album, params.photo);
                } else {
                    showError('Missing album or photo parameter.');
                }
            } else if (isAlbumPage) {
                if (params.album) {
                    renderAlbum(params.album);
                } else {
                    showError('Missing album parameter.');
                }
            } else if (isCategoryPage) {
                if (params.category) {
                    renderCategory(params.category);
                } else {
                    showError('Missing category parameter.');
                }
            } else if (isTagsPage) {
                renderTags();
            } else if (isTagDetailPage) {
                if (params.tag) {
                    renderTagDetail(params.tag);
                } else {
                    showError('Missing tag parameter.');
                }
            } else if (isHomePage) { // Fallback for old categories page
                renderHome();
            } else if (isHomeFeedPage) { // Fallback for home feed page
                renderHomeFeed();
            }
        }

        renderNavbar(); // Call immediately
        updateNavbar(); // This is the old updateNavbar, keep for now if it does something else
    };

    init(); // Call the new init function to start routing

    // Old logic removed. Routing is now handled by init().
}

function updateNavbar() {
    const navMenu = document.getElementById('nav-menu');
    if (navMenu) {
        const prefix = getPathPrefix();
        navMenu.innerHTML = `
            <li class="nav-item"><a class="nav-link" href="${prefix}categories.html">Categories</a></li>
            <li class="nav-item"><a class="nav-link" href="${prefix}tags.html">Tags</a></li>
        `;
    }
}

function showError(msg) {
    const main = document.getElementById('main-content');
    if (main) main.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
}

// ---------- Rendering functions ----------
// ---------- Rendering functions ----------
function applyBranding() {
    const cfg = galleryData.config || {};
    const prefix = getPathPrefix();

    if (cfg.projectName) {
        document.title = cfg.projectName;
        const brand = document.querySelector('.navbar-brand');
        if (brand) {
            // Logo + Text
            brand.innerHTML = `
                ${cfg.projectLogo ? `<img src="${prefix}${cfg.projectLogo}" alt="Logo" width="30" height="30" class="d-inline-block align-text-top me-2">` : ''}
                ${cfg.projectName}
            `;
            // Fix Brand Link
            brand.href = `${prefix}categories.html`;
        }
    }
    if (cfg.browserIcon) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = prefix + (cfg.browserIcon.startsWith('http') ? cfg.browserIcon : cfg.browserIcon);
    }
}

function renderHome() {
    applyBranding();
    const container = document.getElementById('categories');
    if (!container) return;
    container.innerHTML = '';

    // Use the categories map generated by build.js
    const catMap = galleryData.categories || {};
    const catList = Object.keys(catMap);

    // Layout
    const layout = (galleryData.config && galleryData.config.layout) || 'grid';
    container.className = 'layout-' + layout;

    // Switch to container-fluid for modern layouts to use full width
    const parentContainer = container.parentElement;
    if (parentContainer && (parentContainer.classList.contains('container') || parentContainer.classList.contains('container-fluid'))) {
        if (layout === 'grid') {
            parentContainer.classList.add('container');
            parentContainer.classList.remove('container-fluid', 'px-4');
        } else {
            parentContainer.classList.remove('container');
            parentContainer.classList.add('container-fluid', 'px-4');
        }
    }

    // JS Helper for Masonry Centering
    if (layout === 'masonry') {
        // Center the wrapper itself using Flexbox on parent - REMOVED conflict
        if (parentContainer) parentContainer.classList.remove('d-flex', 'justify-content-center');

        // Constrain width so it doesn't take full width unnecessarily
        // 250px col + 1.5rem (24px) gap. Use 280 to be safe.
        container.style.maxWidth = (catList.length * 280) + 'px';
        container.style.margin = '0 auto';  // Extra safety
    } else {
        if (parentContainer) parentContainer.classList.remove('d-flex', 'justify-content-center');
        container.style.maxWidth = '';
        container.style.margin = '';
    }

    const prefix = getPathPrefix();

    catList.forEach(cat => {
        let cover = catMap[cat];
        // Prepend prefix to cover if it's a relative path
        if (cover && !cover.startsWith('http')) {
            cover = prefix + cover;
        }

        const col = document.createElement('div');
        col.className = 'gallery-item'; // Generic item wrapper
        col.innerHTML = `
      <a href="${prefix}category/${encodeURIComponent(cat)}.html" class="text-decoration-none">
        <div class="category-card">
            ${cover ? `<img src="${cover}" alt="${cat}">` : '<div class="w-100 h-100 bg-secondary"></div>'}
            <div class="category-overlay">
                <h5 class="category-title-overlay">${cat}</h5>
            </div>
        </div>
      </a>`;
        container.appendChild(col);
    });
}

function renderCategory(category) {
    const title = document.getElementById('category-title');
    if (title) {
        // Add back button to title area if not already there (though easier to do in HTML)
        title.textContent = `Category: ${category}`;
    }
    const container = document.getElementById('albums');
    if (!container) return;
    container.innerHTML = '';
    const albums = galleryData.albums.filter(a => (a.categories || []).includes(category));

    const layout = (galleryData.config && galleryData.config.layout) || 'grid';
    container.className = 'layout-' + layout;

    // Switch to container-fluid for modern layouts
    const parentContainer = container.parentElement;
    if (parentContainer && (parentContainer.classList.contains('container') || parentContainer.classList.contains('container-fluid'))) {
        if (layout === 'grid') {
            parentContainer.classList.add('container');
            parentContainer.classList.remove('container-fluid', 'px-4');
        } else {
            parentContainer.classList.remove('container');
            parentContainer.classList.add('container-fluid', 'px-4');
        }
    }

    if (layout === 'masonry') {
        if (parentContainer) parentContainer.classList.remove('d-flex', 'justify-content-center');
        container.style.maxWidth = (albums.length * 280) + 'px';
        container.style.margin = '0 auto';
    } else {
        if (parentContainer) parentContainer.classList.remove('d-flex', 'justify-content-center');
        container.style.maxWidth = '';
        container.style.margin = '';
    }

    // Determine depth for relative links
    const prefix = getPathPrefix();

    albums.forEach(album => {
        const col = document.createElement('div');
        col.className = 'gallery-item';

        let coverSrc = '';
        if (album.cover) {
            coverSrc = `${prefix}thumbnails/${album.cover}`;
        } else if (galleryData.config && galleryData.config.defaultAlbumCover) {
            coverSrc = (galleryData.config.defaultAlbumCover.startsWith('http')) ? galleryData.config.defaultAlbumCover : prefix + galleryData.config.defaultAlbumCover;
        }

        const count = album.images ? album.images.length : 0;

        // STATIC LINK GENERATION: ../albums/[id].html?category=[cat]
        // We append the category param so the Album page knows where to go back to.
        col.innerHTML = `
      <a href="${prefix}albums/${encodeURIComponent(album.id)}.html?category=${encodeURIComponent(category)}" class="album-item">
        <div class="album-thumb-wrapper">
             ${coverSrc ? `<img src="${coverSrc}" alt="${album.title}" onerror="this.onerror=null; this.src='${prefix}${galleryData.config.defaultAlbumCover || ''}';">` : '<div class="w-100 h-100 bg-secondary"></div>'}
        </div>
        <div class="album-title">${album.title}</div>
        <div class="album-count">${count} items</div>
      </a>`;
        container.appendChild(col);
    });

    // Check for back button in subnav specifically
    const backBtn = document.getElementById('back-link');
    if (backBtn) {
        backBtn.href = `${prefix}categories.html`;
    }
}

// Render Tags (Cloud Style)
function renderTags() {
    const container = document.getElementById('tags-container');
    if (!container) return;
    container.innerHTML = '';
    const prefix = getPathPrefix();

    if (!galleryData.tags || Object.keys(galleryData.tags).length === 0) {
        container.innerHTML = '<p class="text-center text-white">No tags found.</p>';
        return;
    }

    const tags = Object.keys(galleryData.tags).sort();
    const tagCounts = tags.map(t => galleryData.tags[t].count);
    const maxCount = Math.max(...tagCounts);
    const minCount = Math.min(...tagCounts);

    // Font size range (in rem)
    const minSize = 0.5;
    const maxSize = 1.5;

    tags.forEach(tag => {
        const data = galleryData.tags[tag];
        const count = data.count;

        // Calculate size weight (0 to 1)
        let weight = 0;
        if (maxCount > minCount) {
            weight = (count - minCount) / (maxCount - minCount);
        }

        // Linear interpolation for font size
        const fontSize = minSize + (weight * (maxSize - minSize));

        // Opacity/Brightness tweak based on weight for depth (optional, keeping it simple simple first)
        const opacity = 0.7 + (weight * 0.3); // 0.7 to 1.0

        const tagLink = document.createElement('a');
        tagLink.href = `${prefix}tag.html?tag=${encodeURIComponent(tag)}`;
        tagLink.className = 'tag-cloud-item text-decoration-none badge rounded-pill shadow-sm';
        tagLink.style.fontSize = `${fontSize}rem`; // Dynamic size is fine to keep inline
        tagLink.title = `${count} photos`;

        // Remove manual hover/out handlers to rely on CSS
        tagLink.innerHTML = `${tag} <span class="tag-count rounded-circle ms-1">${count}</span>`;

        container.appendChild(tagLink);
    });
}

function renderTagDetail(tagName) {
    // Collect all photos with this tag
    const allPhotos = [];
    galleryData.albums.forEach(album => {
        if (!checkLock(album)) return; // Skip locked albums

        album.images.forEach(img => {
            if (img.meta && img.meta.tags && img.meta.tags.includes(tagName)) {
                allPhotos.push({
                    albumId: album.id,
                    ...img
                });
            }
        });
    });

    const title = document.getElementById('tag-title-header');
    if (title) title.textContent = `${tagName} (${allPhotos.length})`;

    // Breadcrumb update
    const pathName = document.getElementById('path-tag-name');
    if (pathName) pathName.textContent = tagName;

    const container = document.getElementById('tag-photos');
    if (!container) return;
    container.innerHTML = '';
    const prefix = getPathPrefix();

    const countElem = document.getElementById('tag-count');
    if (countElem) countElem.textContent = `${allPhotos.length} items`;

    // Render Logic (Duplicate from renderAlbum but using flat list)
    // Reuse Config Layout logic if desirable, but simple grid is usually fine for Tags

    // Setup generic Grid layout classes for container
    const layout = (galleryData.config && galleryData.config.layout) || 'grid';
    container.className = 'layout-' + layout;

    // Switch to container-fluid for modern layouts
    const parentContainer = container.parentElement;
    if (parentContainer && (parentContainer.classList.contains('container') || parentContainer.classList.contains('container-fluid'))) {
        if (layout === 'grid') {
            parentContainer.classList.add('container');
            parentContainer.classList.remove('container-fluid', 'px-4');
        } else {
            parentContainer.classList.remove('container');
            parentContainer.classList.add('container-fluid', 'px-4');
        }
    }

    if (layout === 'masonry') {
        if (parentContainer) parentContainer.classList.remove('d-flex', 'justify-content-center');
        container.style.maxWidth = (allPhotos.length * 280) + 'px';
        container.style.margin = '0 auto';
    } else {
        if (parentContainer) parentContainer.classList.remove('d-flex', 'justify-content-center');
        container.style.maxWidth = '';
        container.style.margin = '';
    }

    allPhotos.forEach(img => {
        const col = document.createElement('div');
        col.className = 'gallery-item';
        const thumb = prefix + img.thumb;

        col.innerHTML = `
      <a href="${prefix}photo.html?album=${encodeURIComponent(img.albumId)}&photo=${encodeURIComponent(img.name)}&tag=${encodeURIComponent(tagName)}" class="text-decoration-none text-dark">
        <div class="card h-100 album-card-hover">
            <img src="${thumb}" class="card-img-top" alt="${img.name}">
        </div>
      </a>`;
        container.appendChild(col);
    });
}

// Security Helpers
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkLock(album) {
    if (!album.locked) return true;
    if (localStorage.getItem('unlocked_' + album.id) === 'true') return true;
    return false;
}

function showUnlockPrompt(album) {
    const main = document.getElementById('main-content');
    if (!main) return;

    const prefix = getPathPrefix();

    const dict = galleryData.dictionary || {};
    const txtTitle = dict.lockedTitle || 'Locked Album';
    const txtMsg = dict.lockedMsg || 'This album requires a code to access.';
    const txtPlaceholder = dict.enterCodePlaceholder || 'Enter Access Code';
    const txtBtn = dict.unlockBtn || 'Unlock';
    const txtError = dict.incorrectCode || 'Incorrect code';
    const txtBack = dict.backToGallery || 'Back to Gallery';
    const txtWaiting = dict.waitingUnlock || 'Waiting to unlock: ';

    main.innerHTML = `
        <div class="container d-flex justify-content-center align-items-center" style="min-height: 60vh;">
            <div class="card p-4 shadow-lg text-center" style="max-width: 400px; width: 100%;">
                <div class="mb-3">
                    <ion-icon name="lock-closed-outline" size="large"></ion-icon>
                </div>
                <h4 class="mb-3">${txtTitle}</h4>
                <p class="text-muted mb-2">${txtMsg}</p>
                <p class="fw-bold mb-4">${txtWaiting}${album.title}</p>
                <div class="mb-3">
                     <input type="password" id="unlock-code" class="form-control text-center" placeholder="${txtPlaceholder}" autofocus>
                </div>
                <button id="unlock-btn" class="btn btn-primary w-100">${txtBtn}</button>
                <div id="unlock-error" class="text-danger mt-2 small" style="display:none;">${txtError}</div>
                <div class="mt-3">
                    <a href="${prefix}categories.html" class="text-decoration-none small text-secondary">${txtBack}</a>
                </div>
            </div>
        </div>
    `;

    const btn = document.getElementById('unlock-btn');
    const input = document.getElementById('unlock-code');
    const err = document.getElementById('unlock-error');

    const handleUnlock = async () => {
        const code = input.value;
        if (!code) return;

        // Clear previous error
        err.style.display = 'none';

        const codeHash = await sha256(code);
        const masterHash = galleryData.config ? galleryData.config.masterHash : null;

        // Check against Album Hash OR Master Hash
        const matchAlbum = album.unlockHash && codeHash === album.unlockHash;
        const matchMaster = masterHash && codeHash === masterHash;

        if (matchAlbum || matchMaster) {
            localStorage.setItem('unlocked_' + album.id, 'true');
            // Reload page to restore full UI structure and re-run checkLock (which will now pass)
            window.location.reload();
        } else {
            err.style.display = 'block';
            input.value = '';
            input.focus();
        }
    };

    btn.onclick = handleUnlock;
    input.onkeyup = (e) => {
        if (e.key === 'Enter') handleUnlock();
    };
}

function renderAlbum(albumId) {
    const params = getQueryParams(); // Need access to 'category' param
    const album = galleryData.albums.find(a => a.id === albumId);
    if (!album) {
        document.getElementById('main-content').innerHTML = `<div class="alert alert-warning">Album not found.</div>`;
        return;
    }

    if (!checkLock(album)) {
        showUnlockPrompt(album);
        return;
    }
    const title = document.getElementById('album-title');
    if (title) title.textContent = album.title;

    // Configure Back Button
    const backLink = document.getElementById('back-link');
    const prefix = getPathPrefix();

    if (backLink) {
        if (params.category) {
            backLink.href = `${prefix}category/${encodeURIComponent(params.category)}.html`;
        } else {
            backLink.href = `${prefix}categories.html`; // Default fallback
        }
    }
    const container = document.getElementById('photos');
    if (!container) return;
    container.innerHTML = '';

    const layout = (galleryData.config && galleryData.config.layout) || 'grid';
    container.className = 'layout-' + layout;

    // Switch to container-fluid for modern layouts
    const parentContainer = container.parentElement;
    if (parentContainer && (parentContainer.classList.contains('container') || parentContainer.classList.contains('container-fluid'))) {
        if (layout === 'grid') {
            parentContainer.classList.add('container');
            parentContainer.classList.remove('container-fluid', 'px-4');
        } else {
            parentContainer.classList.remove('container');
            parentContainer.classList.add('container-fluid', 'px-4');
        }
    }

    if (layout === 'masonry') {
        if (parentContainer) parentContainer.classList.remove('d-flex', 'justify-content-center');
        container.style.maxWidth = (album.images.length * 280) + 'px';
        container.style.margin = '0 auto';
    } else {
        if (parentContainer) parentContainer.classList.remove('d-flex', 'justify-content-center');
        container.style.maxWidth = '';
        container.style.margin = '';
    }

    album.images.forEach(img => {
        const col = document.createElement('div');
        col.className = 'gallery-item';
        const thumb = prefix + img.thumb;
        // Make the whole card clickable
        col.innerHTML = `
      <a href="${prefix}photo.html?album=${encodeURIComponent(album.id)}&photo=${encodeURIComponent(img.name)}" class="text-decoration-none text-dark">
        <div class="card h-100 album-card-hover">
            <img src="${thumb}" class="card-img-top" alt="${img.name}">
        </div>
      </a>`;
        container.appendChild(col);
    });
}

// Global Panzoom instance
let panzoomInstance = null;

function renderPhoto(albumId, imageName) {
    const params = getQueryParams();
    const tagContext = params.tag;

    const album = galleryData.albums.find(a => a.id === albumId);
    if (!album) {
        document.getElementById('main-content').innerHTML = `<div class="alert alert-warning">Album not found.</div>`;
        return;
    }

    if (!checkLock(album)) {
        window.location.href = `album.html?album=${encodeURIComponent(albumId)}`;
        return;
    }

    const container = document.getElementById('photo-container');
    if (!container) return;

    // Find image object by name
    const imgObj = album.images.find(img => img.name === imageName);
    if (!imgObj) {
        container.innerHTML = '<div class="text-white">Image not found.</div>';
        return;
    }

    // Render split images without gaps (d-flex is enough, no spacing classes)
    container.innerHTML = `
            <div class="d-flex justify-content-center" style="transform-origin: center; height: 100%;">
      <img src="${imgObj.srcA}" draggable="false" alt="Part A" />
      <img src="${imgObj.srcB}" draggable="false" alt="Part B" />
    </div>`;

    // Initialize Panzoom
    if (panzoomInstance) panzoomInstance.dispose();
    const elem = container.querySelector('.d-flex');
    // Wait for images to load for proper sizing, but init immediately for responsiveness
    panzoomInstance = Panzoom(elem, {
        maxScale: 5,
        minScale: 0.1,
        // contain: 'outside', // Removed to prevent clipping on non-covering images
        startScale: 1
    });
    // Enable mouse wheel
    elem.parentElement.addEventListener('wheel', panzoomInstance.zoomWithWheel);

    // NAVIGATION LOGIC
    let photoList = [];
    let currentIndex = -1;
    let backUrl = `album.html?album=${encodeURIComponent(album.id)}`;

    if (tagContext) {
        // TAG CONTEXT: Collect all photos for this tag
        galleryData.albums.forEach(a => {
            if (!checkLock(a)) return;
            a.images.forEach(img => {
                const imgTags = (img.meta && img.meta.tags) ? img.meta.tags : [];
                if (imgTags.includes(tagContext)) {
                    photoList.push({ ...img, albumId: a.id });
                }
            });
        });

        // Find current photo in the aggregated list
        // We need to match both albumId and name to be unique
        currentIndex = photoList.findIndex(p => p.albumId === albumId && p.name === imageName);
        backUrl = `tag.html?tag=${encodeURIComponent(tagContext)}`;
    } else {
        // ALBUM CONTEXT (Default)
        photoList = album.images.map(img => ({ ...img, albumId: album.id }));
        currentIndex = photoList.findIndex(p => p.name === imageName);
    }

    // Calculate Next/Prev
    let prevParams = '';
    let nextParams = '';

    if (currentIndex !== -1 && photoList.length > 0) {
        const prevIndex = (currentIndex - 1 + photoList.length) % photoList.length;
        const nextIndex = (currentIndex + 1) % photoList.length;
        const prevPhoto = photoList[prevIndex];
        const nextPhoto = photoList[nextIndex];

        let tagQuery = tagContext ? `&tag=${encodeURIComponent(tagContext)}` : '';

        prevParams = `?album=${encodeURIComponent(prevPhoto.albumId)}&photo=${encodeURIComponent(prevPhoto.name)}${tagQuery}`;
        nextParams = `?album=${encodeURIComponent(nextPhoto.albumId)}&photo=${encodeURIComponent(nextPhoto.name)}${tagQuery}`;
    }

    const navPrev = document.getElementById('nav-prev');
    const navNext = document.getElementById('nav-next');
    const backBtn = document.getElementById('back-btn');

    // Back Button
    backBtn.onclick = () => {
        window.location.href = backUrl;
    };

    // Nav Buttons
    navPrev.onclick = () => {
        if (prevParams) window.location.search = prevParams;
    };
    navNext.onclick = () => {
        if (nextParams) window.location.search = nextParams;
    };

    // Info Logic
    const infoBtn = document.getElementById('info-btn');
    const infoPanel = document.getElementById('info-panel');
    const infoOverlay = document.getElementById('info-overlay');
    const closeInfoBtn = document.getElementById('close-info-btn');
    const wrapper = document.getElementById('photo-wrapper');
    const overlayTitle = document.getElementById('overlay-title');

    // Set default overlay title
    // Logic: Title from MD > Filename without extension
    const metaTitle = imgObj.meta && imgObj.meta.title ? imgObj.meta.title : '';
    const cleanName = imgObj.name.replace(/\.[^/.]+$/, ""); // Remove extension
    overlayTitle.textContent = metaTitle || cleanName;

    const overlayDesc = document.getElementById('overlay-desc');
    if (overlayDesc) {
        overlayDesc.textContent = imgObj.meta && imgObj.meta.description ? imgObj.meta.description : '';
    }

    // Render metadata content
    const meta = imgObj.meta || {};
    const titleHtml = meta.title ? `<div class="fw-bold text-white mb-2" style="font-size: 1.1rem;">${meta.title}</div>` : '';

    // Format tags: "Tag: tag1, tag2"
    let tagsHtml = '';
    if (meta.tags && meta.tags.length > 0) {
        const tagLinks = meta.tags.map(tag =>
            `<a href="tag.html?tag=${encodeURIComponent(tag)}" class="text-info text-decoration-none hover-white">${tag}</a>`
        ).join(', ');
        tagsHtml = `<div class="text-white-50 mb-3" style="font-size: 0.9rem;"><span class="text-white fw-bold">Tags:</span> ${tagLinks}</div>`;
    }

    // Description + Content
    // Description + Content
    const descHtml = meta.description ? `<p class="mb-2">${meta.description}</p>` : '';
    const contentHtml = meta.content || '';

    const finalHtml = `
        ${titleHtml}
        ${tagsHtml}
        <div id="metadata-text" class="text-white-50" style="font-size: 0.95rem;">
            ${descHtml}
            ${contentHtml}
        </div>
        `;

    document.getElementById('metadata-content').innerHTML = finalHtml || '<p class="text-white-50">No metadata found.</p>';

    function toggleInfo(show) {
        if (show) {
            infoPanel.style.transform = 'translateX(0)';
            infoOverlay.style.opacity = '0'; // Hide bottom overlay
            // Shrink photo wrapper
            wrapper.style.width = '66.666%';
            wrapper.style.marginRight = '33.333%';
            // Shift Next button
            navNext.classList.add('shifted');
            localStorage.setItem('infoOpen', 'true');
        } else {
            infoPanel.style.transform = 'translateX(100%)';
            infoOverlay.style.opacity = '1'; // Show bottom overlay
            wrapper.style.width = '100%';
            wrapper.style.marginRight = '0';
            navNext.classList.remove('shifted');
            localStorage.setItem('infoOpen', 'false');
        }
        // Resize panzoom after layout change
        setTimeout(() => panzoomInstance.resize(), 300);
    }

    infoBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent navigation
        const isHidden = infoPanel.style.transform === 'translateX(100%)';
        toggleInfo(isHidden);
    };

    // Restore state from localStorage
    if (localStorage.getItem('infoOpen') === 'true') {
        toggleInfo(true);
    }

    // Copy Button Logic
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        copyBtn.onclick = async (e) => {
            e.stopPropagation(); // Prevent navigation
            const textElem = document.getElementById('metadata-text');
            const textToCopy = textElem ? textElem.innerText : '';
            if (textToCopy) {
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    // Visual feedback
                    const originalIcon = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<ion-icon name="checkmark-outline" style="font-size: 16px;"></ion-icon>';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalIcon;
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                }
            }
        };
    }
}

// Initialise when DOM is ready
// Initialise when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupGlobalInteractions();
});

function setupGlobalInteractions() {
    // Only active on Photo Page
    if (!document.getElementById('photo-container')) return;

    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input (unlikely here but good practice)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Navigation
        if (e.key === 'ArrowLeft') {
            document.getElementById('nav-prev')?.click();
        } else if (e.key === 'ArrowRight') {
            document.getElementById('nav-next')?.click();
        }
        // Info Toggle
        else if (e.key === 'i' || e.key === 'I') {
            document.getElementById('info-btn')?.click();
        }
        // Zoom Controls (Global shortcuts)
        else if (panzoomInstance) {
            if (e.key === 'Escape') panzoomInstance.reset();
            if (e.key === '+' || e.key === '=') panzoomInstance.zoomIn();
            if (e.key === '-') panzoomInstance.zoomOut();
            if (e.key === '0') panzoomInstance.reset();
        }
    });

    document.addEventListener('wheel', (e) => {
        // check if hovering over the zoomable image container
        // If inside photo-container, let Panzoom or default scroll happen (Panzoom handles wheel usually)
        if (e.target.closest('#photo-container')) return;
        if (e.target.closest('.sticky-subnav')) return; // Ignore wheel on nav

        // Otherwise (black background), use wheel for navigation
        if (e.deltaY < 0) {
            // Scroll Up -> Previous
            document.getElementById('nav-prev')?.click();
        } else if (e.deltaY > 0) {
            // Scroll Down -> Next
            document.getElementById('nav-next')?.click();
        }
    });
}
