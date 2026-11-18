const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Election = require('../models/Election');

let cachedIndexHtml = null;
let lastIndexReadTime = 0;

function getIndexHtml() {
    const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
    const now = Date.now();
    // Cache for 10 seconds in production
    if (cachedIndexHtml && (now - lastIndexReadTime < 10000)) {
        return cachedIndexHtml;
    }
    try {
        if (fs.existsSync(indexPath)) {
            cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
            lastIndexReadTime = now;
            return cachedIndexHtml;
        }
    } catch (err) {
        console.error('Error reading index.html:', err.message);
    }
    return null;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * GET /robots.txt
 * Dynamic host-aware robots.txt
 */
router.get('/robots.txt', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost';
    const robotsTxt = `# robots.txt for ClassVote
User-agent: *
Allow: /
Allow: /entry
Allow: /e/
Allow: /signup
Allow: /login
Allow: /privacy-policy

# Keep internal ballot voting sessions, kiosk stations, and organizer dashboards private
Disallow: /dashboard/
Disallow: /dashboard
Disallow: /e/*/kiosk
Disallow: /e/*/voting
Disallow: /api/

Sitemap: ${protocol}://${host}/sitemap.xml
`;
    res.type('text/plain').send(robotsTxt);
});

/**
 * GET /sitemap.xml
 * Dynamic XML sitemap listing public static routes and active/public elections
 */
router.get('/sitemap.xml', async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.get('host') || 'localhost';
        const baseUrl = `${protocol}://${host}`;
        const nowIso = new Date().toISOString().split('T')[0];

        // Fetch public elections (excluding kiosk-only)
        const elections = await Election.find({
            accessMode: { $in: ['roster', 'open'] }
        })
            .select('slug updatedAt title')
            .lean()
            .limit(1000);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        // 1. Static Core Landing Pages
        const staticPages = [
            { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
            { loc: `${baseUrl}/entry`, priority: '0.8', changefreq: 'weekly' },
            { loc: `${baseUrl}/signup`, priority: '0.7', changefreq: 'monthly' },
            { loc: `${baseUrl}/login`, priority: '0.5', changefreq: 'monthly' },
            { loc: `${baseUrl}/privacy-policy`, priority: '0.3', changefreq: 'monthly' },
        ];

        for (const page of staticPages) {
            xml += `  <url>\n`;
            xml += `    <loc>${page.loc}</loc>\n`;
            xml += `    <lastmod>${nowIso}</lastmod>\n`;
            xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
            xml += `    <priority>${page.priority}</priority>\n`;
            xml += `  </url>\n`;
        }

        // 2. Dynamic Election Pages
        for (const el of elections) {
            const lastMod = el.updatedAt ? new Date(el.updatedAt).toISOString().split('T')[0] : nowIso;
            // Public Voter Portal
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/e/${encodeURIComponent(el.slug)}</loc>\n`;
            xml += `    <lastmod>${lastMod}</lastmod>\n`;
            xml += `    <changefreq>daily</changefreq>\n`;
            xml += `    <priority>0.9</priority>\n`;
            xml += `  </url>\n`;

            // Public Results Page
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/e/${encodeURIComponent(el.slug)}/results</loc>\n`;
            xml += `    <lastmod>${lastMod}</lastmod>\n`;
            xml += `    <changefreq>daily</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
        }

        xml += `</urlset>`;
        res.type('application/xml').send(xml);
    } catch (err) {
        console.error('Error generating sitemap.xml:', err);
        res.status(500).send('Error generating sitemap');
    }
});

/**
 * Express middleware to inject dynamic OpenGraph and title metadata into index.html
 * for crawler bots and social sharing platforms.
 */
async function handleElectionSocialCard(req, res, next) {
    if (process.env.SERVE_FRONTEND !== 'true') {
        return next();
    }

    const pathname = req.path;
    // Match /e/:slug or /e/:slug/results
    const match = pathname.match(/^\/e\/([a-zA-Z0-9_-]+)(\/results|\/voting|\/embed)?$/i);
    if (!match) {
        return next();
    }

    const slug = match[1].toLowerCase();
    const subRoute = match[2] || '';

    // If subroute is kiosk, skip to normal index (kiosk is protected)
    if (subRoute === '/kiosk') {
        return next();
    }

    const rawHtml = getIndexHtml();
    if (!rawHtml) {
        return next();
    }

    try {
        const election = await Election.findOne({ slug }).select('title description organization').lean();
        if (!election) {
            return next();
        }

        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.get('host') || 'localhost';
        const fullUrl = `${protocol}://${host}${pathname}`;

        const isResults = subRoute === '/results';
        const pageTitle = isResults
            ? `Live Results: ${election.title} | ClassVote`
            : `Vote: ${election.title} | ClassVote`;

        const orgNote = election.organization ? ` (${election.organization})` : '';
        const pageDesc = isResults
            ? `Live certified vote tallies and candidate standings for ${election.title}${orgNote}.`
            : (election.description || `Official voter portal for ${election.title}${orgNote}. Cast your verified ballot online.`);

        // Inject dynamic tags into HTML head
        let modifiedHtml = rawHtml;

        // Replace <title>...</title>
        modifiedHtml = modifiedHtml.replace(
            /<title>[\s\S]*?<\/title>/i,
            `<title>${escapeHtml(pageTitle)}</title>`
        );

        // Replace or inject OpenGraph meta tags
        const dynamicMeta = `
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="title" content="${escapeHtml(pageTitle)}" />
    <meta name="description" content="${escapeHtml(pageDesc)}" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(pageDesc)}" />
    <meta property="og:url" content="${escapeHtml(fullUrl)}" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(pageDesc)}" />
    <link rel="canonical" href="${escapeHtml(fullUrl)}" />
`;

        modifiedHtml = modifiedHtml.replace('</head>', `${dynamicMeta}\n  </head>`);
        return res.send(modifiedHtml);
    } catch (err) {
        console.error('Error injecting election social card:', err);
        return next();
    }
}

module.exports = {
    seoRouter: router,
    handleElectionSocialCard
};
