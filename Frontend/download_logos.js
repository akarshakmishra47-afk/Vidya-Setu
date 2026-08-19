const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const logosDir = path.join(__dirname, 'assets', 'logos');

const logosToFetch = [
    { name: 'apollo-pharmacy', url: 'https://s2.googleusercontent.com/s2/favicons?domain=apollopharmacy.in&sz=128' },
    { name: 'nykaa', url: 'https://s2.googleusercontent.com/s2/favicons?domain=nykaa.com&sz=128' },
    { name: 'mac', url: 'https://s2.googleusercontent.com/s2/favicons?domain=maccosmetics.in&sz=128' },
    { name: 'calm', url: 'https://s2.googleusercontent.com/s2/favicons?domain=calm.com&sz=128' },
    { name: 'ajio', url: 'https://s2.googleusercontent.com/s2/favicons?domain=ajio.com&sz=128' },
    { name: 'crocs', url: 'https://s2.googleusercontent.com/s2/favicons?domain=crocs.com&sz=128' },
    { name: 'levis', url: 'https://s2.googleusercontent.com/s2/favicons?domain=levi.in&sz=128' },
    { name: 'rosetta-stone', url: 'https://s2.googleusercontent.com/s2/favicons?domain=rosettastone.com&sz=128' },
    { name: 'matlab', url: 'https://s2.googleusercontent.com/s2/favicons?domain=mathworks.com&sz=128' },
    { name: 'cultfit', url: 'https://s2.googleusercontent.com/s2/favicons?domain=cult.fit&sz=128' }
];

function downloadFile(url, dest, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 10) return reject(new Error('Too many redirects'));

        const client = url.startsWith('https') ? https : http;
        const options = {
            headers: { 
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'image/svg+xml,image/webp,image/apng,image/*,*/*;q=0.8'
            }
        };

        client.get(url, options, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                let redirectUrl = response.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    const parsedUrl = new URL(url);
                    redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`;
                }
                return downloadFile(redirectUrl, dest, redirectCount + 1).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Status: ${response.statusCode}`));
            }
            const contentType = response.headers['content-type'] || '';
            if (contentType.includes('text/html')) {
                return reject(new Error('Returned HTML instead of image'));
            }
            let ext = '.png'; // default fallback for google favicon API
            if (contentType.includes('image/svg')) ext = '.svg';
            if (contentType.includes('image/jpeg')) ext = '.jpg';
            if (contentType.includes('image/webp')) ext = '.webp';
            if (contentType.includes('image/x-icon') || contentType.includes('image/vnd.microsoft.icon')) ext = '.ico';
            
            ['.svg', '.png', '.jpg', '.webp', '.ico'].forEach(e => {
                if (fs.existsSync(dest + e)) fs.unlinkSync(dest + e);
            });

            const fileDest = dest + ext;
            const file = fs.createWriteStream(fileDest);
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(fileDest));
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function run() {
    console.log("Downloading 10 remaining missing logos...");
    let success = 0;
    let failed = 0;

    for (const item of logosToFetch) {
        try {
            const destPath = path.join(logosDir, item.name);
            const savedFile = await downloadFile(item.url, destPath);
            console.log(`✓ ${path.basename(savedFile)}`);
            success++;
        } catch (e) {
            console.log(`✗ ${item.name} — ${e.message} (${item.url})`);
            failed++;
        }
        await new Promise(r => setTimeout(r, 500)); 
    }
    console.log("\nRemaining Downloaded:", success);
    console.log("Failed:", failed);
}

run();
