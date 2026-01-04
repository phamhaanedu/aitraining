const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();
const sharp = require('sharp');
const matter = require('gray-matter');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..'); // MyGallery root
const ALBUMS_DIR = path.join(ROOT, 'albums');
const PUBLIC_DIR = path.join(ROOT, 'docs');
const THUMB_DIR = path.join(PUBLIC_DIR, 'thumbnails');
const SPLIT_DIR = path.join(PUBLIC_DIR, 'split');
const DATA_FILE = path.join(PUBLIC_DIR, 'data.json');

function ensureDir(p) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function hash(str) {
    return crypto.createHash('sha256').update(String(str)).digest('hex');
}

// Load Gallery Config Global
const configPath = path.join(ROOT, 'gallery.config.json');
let galleryConfig = {};
if (fs.existsSync(configPath)) {
    try { galleryConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { console.error('Invalid config', e); }
}

ensureDir(PUBLIC_DIR);
ensureDir(THUMB_DIR);
ensureDir(SPLIT_DIR);

// Global Tags Map: Name -> { count, cover }
const globalTagsMap = new Map();
const processingTasks = []; // Track active image processing tasks

// Helper to process a single image file
function processImgFile(srcPath, albumId, images) {
    if (!fs.existsSync(srcPath)) {
        console.warn(`Image source not found: ${srcPath}`);
        return;
    }

    const imgName = path.basename(srcPath);

    // Thumbnail
    const thumbAlbumDir = path.join(THUMB_DIR, albumId);
    ensureDir(thumbAlbumDir);
    const thumbPath = path.join(thumbAlbumDir, imgName);

    // Re-check timestamp for resize
    if (!fs.existsSync(thumbPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(thumbPath).mtimeMs) {
        const layout = galleryConfig.layout || 'grid';
        let resizeOpts = { width: 200, height: 200, fit: 'cover' }; // Default Grid

        if (layout === 'masonry') {
            resizeOpts = { width: 300 }; // Fixed width, auto height
        } else if (layout === 'justified') {
            resizeOpts = { height: 220 }; // Fixed height, auto width
        }

        const task = sharp(srcPath).resize(resizeOpts).toFile(thumbPath).catch(e => console.error('Thumb error', e));
        processingTasks.push(task);
    }

    // Split vertically into two halves
    const splitAlbumDir = path.join(SPLIT_DIR, albumId);
    ensureDir(splitAlbumDir);
    const baseName = path.parse(imgName).name;
    const leftPath = path.join(splitAlbumDir, `${baseName}_a.jpg`);
    const rightPath = path.join(splitAlbumDir, `${baseName}_b.jpg`);

    if (!fs.existsSync(leftPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(leftPath).mtimeMs) {
        const task = sharp(srcPath).metadata().then(meta => {
            const half = Math.floor(meta.width / 2);
            return Promise.all([
                sharp(srcPath).extract({ left: 0, top: 0, width: half, height: meta.height }).toFile(leftPath),
                sharp(srcPath).extract({ left: half, top: 0, width: meta.width - half, height: meta.height }).toFile(rightPath)
            ]);
        }).catch(e => console.error('Split error', e));
        processingTasks.push(task);
    }

    // Metadata .md file
    const mdPath = srcPath.replace(/\.(jpg|png)$/i, '.md');
    let metaData = {};
    let htmlContent = '';

    if (fs.existsSync(mdPath)) {
        if (fs.statSync(mdPath).isDirectory()) {
            console.warn(`Ignored directory acting as metadata: ${mdPath}`);
        } else {
            try {
                const fileContent = fs.readFileSync(mdPath, 'utf8');
                const parsed = matter(fileContent);
                metaData = parsed.data || {}; // YAML frontmatter
                htmlContent = md.render(parsed.content || ''); // Rendered markdown body
            } catch (e) {
                console.error(`Error reading MD file ${mdPath}`, e);
            }
        }
    }

    const title = metaData.title || baseName;
    const tags = metaData.tags || [];

    // Process Tags
    tags.forEach(tag => {
        if (!tag) return;
        if (!globalTagsMap.has(tag)) {
            // First time seeing this tag -> use this image as cover
            globalTagsMap.set(tag, {
                count: 0,
                cover: path.relative(PUBLIC_DIR, thumbPath).replace(/\\/g, '/')
            });
        }
        const tagData = globalTagsMap.get(tag);
        tagData.count++;
    });

    // Check for duplicates in current images array by name
    if (!images.find(img => img.name === imgName)) {
        images.push({
            name: imgName,
            srcA: path.relative(PUBLIC_DIR, leftPath).replace(/\\/g, '/'),
            srcB: path.relative(PUBLIC_DIR, rightPath).replace(/\\/g, '/'),
            thumb: path.relative(PUBLIC_DIR, thumbPath).replace(/\\/g, '/'),
            meta: {
                title: title,
                tags: tags,
                description: metaData.description || '',
                content: htmlContent
            }
        });
    }
}

function processFolderImages(folderPath, albumObj) {
    const albumId = albumObj.id; // Use the ID of the PRIMARY album
    const images = albumObj.images;

    // 1. Process Local Files in this folder
    const files = fs.readdirSync(folderPath);
    const imgFiles = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png'));
    imgFiles.forEach(img => {
        const fullPath = path.join(folderPath, img);
        if (fs.statSync(fullPath).isDirectory()) return; // Skip directories
        processImgFile(fullPath, albumId, images);
    });
}

async function main() {
    const albumMap = new Map(); // Title -> Album Object

    if (fs.existsSync(ALBUMS_DIR)) {
        const dirs = fs.readdirSync(ALBUMS_DIR);
        dirs.forEach(d => {
            const folderPath = path.join(ALBUMS_DIR, d);
            if (!fs.statSync(folderPath).isDirectory()) return;

            // Read Config unique to this folder
            const configPath = path.join(folderPath, 'config.json');
            let cfg = {};
            if (fs.existsSync(configPath)) {
                try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { console.error('Invalid JSON in', configPath); }
            }

            // Determine Title (Key for merging)
            const title = cfg.name ? cfg.name.trim() : d;

            let albumObj;

            if (albumMap.has(title)) {
                // MERGE: Existing album found.
                albumObj = albumMap.get(title);
                console.log(`[Build] Merging processed folder "${d}" into existing album "${title}"`);
            } else {
                // CREATE: New album.
                const albumId = d;

                // Security: Hash unlock code
                let unlockHash = null;
                let isLocked = cfg.locked || false;

                if (cfg.unlockCode) {
                    unlockHash = hash(cfg.unlockCode);
                    isLocked = true;
                }

                albumObj = {
                    id: albumId,
                    title: title,
                    categories: cfg.category || [],
                    cover: null, // Will resolve later
                    coverImageCfg: cfg.coverImage,
                    locked: isLocked,
                    unlockHash: unlockHash,
                    images: [],
                };

                // Process 'includes' from Config (Only for Primary)
                if (cfg.includes && Array.isArray(cfg.includes)) {
                    cfg.includes.forEach(includePath => {
                        const fullPath = path.join(ALBUMS_DIR, includePath);
                        if (fs.existsSync(fullPath)) {
                            const stat = fs.statSync(fullPath);
                            if (stat.isDirectory()) {
                                processFolderImages(fullPath, albumObj);
                            } else if (stat.isFile()) {
                                // Handle single file include
                                processImgFile(fullPath, albumObj.id, albumObj.images);
                            }
                        } else {
                            console.warn(`Include path not found: ${fullPath}`);
                        }
                    });
                }

                albumMap.set(title, albumObj);
            }

            // Process Images from THIS folder
            processFolderImages(folderPath, albumObj);
        });
    }

    // Post-processing: Resolve Covers for all albums
    const albums = Array.from(albumMap.values());
    albums.forEach(album => {
        if (album.coverImageCfg) {
            const coverThumbPath = path.join(THUMB_DIR, album.id, album.coverImageCfg);
            if (fs.existsSync(coverThumbPath)) {
                album.cover = `${album.id}/${album.coverImageCfg}`;
            }
        }
        delete album.coverImageCfg; // Cleanup
    });


    // --- Category Map Generation (Restored) ---
    const categoryMap = {};
    albums.forEach(album => {
        (album.categories || []).forEach(cat => {
            if (categoryMap[cat] === undefined) {
                categoryMap[cat] = null;
            }
            if (!categoryMap[cat]) {
                if (album.cover) {
                    const thumbPathLocal = path.join(THUMB_DIR, album.cover.split('/').join(path.sep));
                    if (fs.existsSync(thumbPathLocal)) {
                        categoryMap[cat] = `thumbnails/${album.cover}`;
                    }
                }
            }
        });
    });

    Object.keys(categoryMap).forEach(cat => {
        if (galleryConfig.categoryCovers && galleryConfig.categoryCovers[cat]) {
            categoryMap[cat] = galleryConfig.categoryCovers[cat];
        }
        if (!categoryMap[cat] && galleryConfig.defaultCategoryCover) {
            categoryMap[cat] = galleryConfig.defaultCategoryCover;
        }
    });

    // Load Dictionary
    let dictionary = {};
    if (galleryConfig.dictionary) {
        const dictPath = path.join(ROOT, galleryConfig.dictionary);
        if (fs.existsSync(dictPath)) {
            try { dictionary = JSON.parse(fs.readFileSync(dictPath, 'utf8')); } catch (e) { console.error('Invalid dictionary', e); }
        }
    }

    // Convert Tags Map to Object
    const tagsObj = Object.fromEntries(globalTagsMap);

    // Prepare Config for Output (Security Sanitize)
    const outputConfig = { ...galleryConfig };
    if (outputConfig.masterCode) {
        outputConfig.masterHash = hash(outputConfig.masterCode);
        delete outputConfig.masterCode; // REMOVE PLAIN TEXT
    }

    // Write data.json
    const outputData = {
        config: outputConfig,
        categories: categoryMap,
        tags: tagsObj,
        albums: albums,
        dictionary: dictionary
    };

    try {
        if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
        fs.writeFileSync(DATA_FILE, JSON.stringify(outputData, null, 2), 'utf8');
        console.log('[build] Generated', DATA_FILE);
    } catch (e) {
        console.error('[build] Error writing data.json', e);
    }

    // Wait for all images to process
    if (processingTasks.length > 0) {
        console.log(`[build] Waiting for ${processingTasks.length} background image tasks...`);
        await Promise.all(processingTasks);
        console.log('[build] All image tasks finished.');
    }

    // --- Static Page Generation (Component-Based) ---
    const BASE_URL = galleryConfig.baseUrl || 'https://phamhaanedu.github.io/mygallery/';
    const THEME_DIR = path.join(ROOT, 'templates', 'default');

    // Load Partials
    const layoutHtml = fs.readFileSync(path.join(THEME_DIR, 'layout.html'), 'utf8');
    const headHtml = fs.readFileSync(path.join(THEME_DIR, 'partials', 'head.html'), 'utf8');
    const navbarHtml = fs.readFileSync(path.join(THEME_DIR, 'partials', 'navbar.html'), 'utf8');
    const footerHtml = fs.readFileSync(path.join(THEME_DIR, 'partials', 'footer.html'), 'utf8');

    // Helper: Assemble Page
    // replacements: { title, ogTags, extraHead, extraScripts, pathToRoot }
    function renderPage(pageName, replacements = {}) {
        const pageContentPath = path.join(THEME_DIR, 'pages', `${pageName}.html`);
        if (!fs.existsSync(pageContentPath)) {
            console.error(`Page template not found: ${pageName}`);
            return '';
        }
        let pageContent = fs.readFileSync(pageContentPath, 'utf8');

        // Prepare Tags
        const title = replacements.title || 'MyGallery';
        const ogTags = replacements.ogTags || '';
        const extraHead = replacements.extraHead || '';
        const extraScripts = replacements.extraScripts || '';
        const pathToRoot = replacements.pathToRoot || ''; // Default to empty (root)

        // Inject into Partial HEAD
        let finalHead = headHtml
            .replace('<!-- TITLE -->', title)
            .replace('<!-- OG_TAGS -->', ogTags)
            .replace('<!-- Additional HEAD -->', extraHead)
            .replace(/<!-- PREFIX -->/g, pathToRoot);

        // Inject into Partial FOOTER
        let finalFooter = footerHtml
            .replace('<!-- Additional SCRIPTS -->', extraScripts)
            .replace(/<!-- PREFIX -->/g, pathToRoot);

        // Inject into Partial NAVBAR
        let finalNavbar = navbarHtml
            .replace(/<!-- PREFIX -->/g, pathToRoot);

        // Inject prefix into Page Content too (often needed for back links etc)
        // If the page content has static links like href="categories.html", it might be an issue.
        // We should encourage using variable replacement if possible, but for now we rely on standardizing.
        // Let's replace PREFIX in page content too if it exists.
        pageContent = pageContent.replace(/<!-- PREFIX -->/g, pathToRoot);

        // Remove Navbar for Photo Page if desired (optional - but user design has subnav)
        const useNavbar = pageName !== 'photo';

        // Assemble Layout
        let html = layoutHtml
            .replace('<!-- HEAD -->', finalHead)
            .replace('<!-- NAVBAR -->', useNavbar ? finalNavbar : '') // Conditional Navbar
            .replace('<!-- MAIN -->', pageContent)
            .replace('<!-- FOOTER -->', finalFooter);

        return html;
    }

    // 1. Generate Album Pages (Depth: 1 -> ../)
    const ALBUM_OUT_DIR = path.join(PUBLIC_DIR, 'albums');
    ensureDir(ALBUM_OUT_DIR);

    albums.forEach(album => {
        // Meta Data
        const title = `${album.title} - MyGallery`;
        const description = `View ${album.images.length} photos in ${album.title}`;
        let coverUrl = '';
        if (album.cover) {
            const parts = album.cover.split('/');
            const encodedPath = parts.map(p => encodeURIComponent(p)).join('/');
            coverUrl = `${BASE_URL}thumbnails/${encodedPath}`;
        }

        const ogTags = `
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${coverUrl}" />
    <meta property="og:url" content="${BASE_URL}albums/${encodeURIComponent(album.id)}.html" />
    <meta property="og:type" content="website" />
    <script>window.initialContext = { type: 'album', id: '${album.id}' };</script>
        `;

        const html = renderPage('album', { title, ogTags, pathToRoot: '../' });
        fs.writeFileSync(path.join(ALBUM_OUT_DIR, `${album.id}.html`), html, 'utf8');
    });

    // 2. Generate Category Pages (Depth: 1 -> ../)
    const CAT_OUT_DIR = path.join(PUBLIC_DIR, 'category');
    ensureDir(CAT_OUT_DIR);

    Object.keys(categoryMap).forEach(catId => {
        // Use Dictionary for readable title if available
        const displayName = dictionary[catId] || catId;
        const title = `${displayName} - MyGallery`;
        const description = `Browse photos in ${displayName}`;

        let coverUrl = '';
        if (categoryMap[catId]) {
            const relativePath = categoryMap[catId];
            const parts = relativePath.split('/');
            const encodedPath = parts.map(p => encodeURIComponent(p)).join('/');
            coverUrl = `${BASE_URL}${encodedPath}`;
        }

        const ogTags = `
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${coverUrl}" />
    <meta property="og:url" content="${BASE_URL}category/${encodeURIComponent(catId)}.html" />
    <meta property="og:type" content="website" />
    <script>window.initialContext = { type: 'category', id: '${catId}' };</script>
        `;

        const html = renderPage('category', { title, ogTags, pathToRoot: '../' });
        fs.writeFileSync(path.join(CAT_OUT_DIR, `${catId}.html`), html, 'utf8');
    });

    // 3. Generate Home Page (Flow / Pinterest Style)
    {
        // Collect ALL photos for the Global Feed (excluding locked albums)
        let allPhotos = [];
        albums.forEach(album => {
            if (album.locked) return; // SKIP LOCKED ALBUMS

            album.images.forEach(img => {
                allPhotos.push({
                    id: img.name,
                    url: `split/${encodeURIComponent(album.id)}/${encodeURIComponent(img.name)}`,
                    thumb: `thumbnails/${encodeURIComponent(album.id)}/${encodeURIComponent(img.name)}`,
                    ratio: img.ratio,
                    albumId: album.id,
                    title: album.title // Useful for filtering/context
                });
            });
        });

        // Randomize/Shuffle the feed for discovery? Or sort by date? 
        // Let's Shuffle for Pinterest feel
        allPhotos = allPhotos.sort(() => Math.random() - 0.5);

        // Allow passing max items in JSON to keep it light? 
        // For now, write full list. JS will lazy load.
        const allPhotosPath = path.join(PUBLIC_DIR, 'all_photos.json');
        fs.writeFileSync(allPhotosPath, JSON.stringify(allPhotos), 'utf8');

        const title = `MyGallery - Home`;
        const ogTags = `
    <meta property="og:title" content="${title}" />
    <meta property="og:image" content="${BASE_URL}assets/gallery icon 32x32.png" />
    <meta property="og:url" content="${BASE_URL}index.html" />
    <script>window.initialContext = { type: 'home_feed' };</script>
        `;

        const html = renderPage('home', { title, ogTags, pathToRoot: '' });
        fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html, 'utf8');

        // Ensure categories.html still exists as a separate page
        const catTitle = `MyGallery - Categories`;
        const catOgTags = `
    <meta property="og:title" content="${catTitle}" />
    <meta property="og:url" content="${BASE_URL}categories.html" />
    <script>window.initialContext = { type: 'home' };</script>
        `;
        const catHtml = renderPage('categories', { title: catTitle, ogTags: catOgTags, pathToRoot: '' });
        fs.writeFileSync(path.join(PUBLIC_DIR, 'categories.html'), catHtml, 'utf8');
    }

    // 4. Generate Single Pages (Tags, Tag Detail, Photo)
    // Tags List (Depth: 0)
    {
        const html = renderPage('tags', { title: 'All Tags - MyGallery', pathToRoot: '' });
        fs.writeFileSync(path.join(PUBLIC_DIR, 'tags.html'), html, 'utf8');
    }

    // Tag Detail (Depth: 0 - Wait, tag.html is at root? Yes. Query params used.)
    {
        const html = renderPage('tag', { title: 'Tag - MyGallery', pathToRoot: '' });
        fs.writeFileSync(path.join(PUBLIC_DIR, 'tag.html'), html, 'utf8');
    }

    // Photo Viewer (Depth: 0 - photo.html is at root)
    {
        const extraScripts = `<script src="https://unpkg.com/@panzoom/panzoom@4.5.1/dist/panzoom.min.js"></script>`;
        const html = renderPage('photo', {
            title: 'Photo - MyGallery',
            extraScripts: extraScripts,
            pathToRoot: ''
        });
        fs.writeFileSync(path.join(PUBLIC_DIR, 'photo.html'), html, 'utf8');
    }

    // Copy static files (App)
    fs.copyFileSync(path.join(ROOT, 'app.js'), path.join(PUBLIC_DIR, 'app.js'));

    // Copy CSS Assets (Core)
    const ASSETS_CSS_DIR = path.join(PUBLIC_DIR, 'assets', 'css');
    ensureDir(ASSETS_CSS_DIR);
    fs.copyFileSync(path.join(ROOT, 'assets', 'css', 'core.css'), path.join(ASSETS_CSS_DIR, 'core.css'));

    // Copy Theme CSS
    const themeCssPath = path.join(THEME_DIR, 'theme.css');
    if (fs.existsSync(themeCssPath)) {
        fs.copyFileSync(themeCssPath, path.join(PUBLIC_DIR, 'theme.css'));
    }

    // Write serve.json
    const serveConfig = { cleanUrls: false };
    fs.writeFileSync(path.join(PUBLIC_DIR, 'serve.json'), JSON.stringify(serveConfig, null, 2), 'utf8');

    console.log('[build] Static generation complete (Templated).');
}

main();

