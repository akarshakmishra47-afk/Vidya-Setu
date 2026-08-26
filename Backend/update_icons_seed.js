const fs = require('fs');
const path = require('path');

const seedFile = path.join(__dirname, 'seedPerks.js');
let code = fs.readFileSync(seedFile, 'utf8');

const brandToLogoMap = {
    // Travel
    'indigo': 'indigo',
    'air india': 'air-india',
    'indian railways': 'irctc',
    'upsrtc': 'upsrtc',
    'flixbus': 'flixbus',
    'emirates': 'emirates',
    'qatar airways': 'qatar-airways',
    'kayak': 'kayak',

    // Tech
    'github': 'github',
    'jetbrains': 'jetbrains',
    'notion': 'notion',
    'autodesk': 'autodesk',
    'microsoft 365': 'microsoft',
    'adobe': 'adobe',
    'canva': 'canva',
    'figma': 'figma',
    'grammarly': 'grammarly',
    'evernote': 'evernote',
    'cursor': 'cursor',
    'perplexity': 'perplexity',
    'google gemini': 'gemini',
    'aws': 'aws',
    'digitalocean': 'digitalocean',
    'microsoft azure': 'azure',

    // Hardware
    'apple education store': 'apple',
    'samsung': 'samsung',
    'lenovo': 'lenovo',
    'dell': 'dell',
    'hp student': 'hp',
    'asus': 'asus',
    'acer': 'acer',
    'oneplus': 'oneplus',
    'oppo': 'oppo',
    'razer': 'razer',

    // Entertainment
    'spotify': 'spotify',
    'apple music': 'apple',
    'youtube': 'youtube',
    'amazon prime': 'amazon',
    'apple tv': 'apple',
    'tidal': 'tidal',
    'chess.com': 'chess',

    // Fashion
    'h&m': 'hm',
    'ajio': 'ajio',
    'myntra': 'myntra',
    'puma': 'puma',
    'adidas': 'adidas',
    'nike': 'nike',
    'crocs': 'crocs',
    'converse': 'converse',
    'levi': 'levis',
    'asos': 'asos',

    // Food
    'swiggy': 'swiggy',
    'zomato': 'zomato',
    'starbucks': 'starbucks',
    'domino': 'dominos',
    'pizza hut': 'pizza-hut',
    'mcdonald': 'mcdonalds',
    'subway': 'subway',

    // Education
    'coursera': 'coursera',
    'udemy': 'udemy',
    'skillshare': 'skillshare',
    'datacamp': 'datacamp',
    'quizlet': 'quizlet',
    'wolfram': 'wolfram',
    'matlab': 'mathworks',
    'overleaf': 'overleaf',
    'rosetta stone': 'rosetta-stone',

    // Fitness
    'cult.fit': 'cultfit',
    'strava': 'strava',
    'headspace': 'headspace',
    'calm': 'calm',

    // Beauty
    'mac cosmetics': 'mac',
    'nykaa': 'nykaa',
    'sephora': 'sephora',
    'iherb': 'iherb',
    'apollo pharmacy': 'apollo-pharmacy'
};

const frontendAssetsDir = path.join(__dirname, '..', 'Frontend', 'assets', 'logos');

// We will find each `title: "..."` and replace the subsequent `icon: "..."`
const blockRegex = /{[\s\S]*?}/g;

code = code.replace(blockRegex, (block) => {
    if (!block.includes('title:')) return block;

    const titleMatch = block.match(/title:\s*"([^"]+)"/);
    if (!titleMatch) return block;
    
    const title = titleMatch[1].toLowerCase();

    let matchedBrand = null;
    let matchedLogoName = null;

    for (const [brand, logoName] of Object.entries(brandToLogoMap)) {
        if (title.includes(brand)) {
            matchedBrand = brand;
            matchedLogoName = logoName;
            break; // found match
        }
    }

    if (matchedLogoName) {
        // Find the actual file extension in the Frontend/assets/logos folder
        let ext = '.svg';
        if (fs.existsSync(path.join(frontendAssetsDir, matchedLogoName + '.svg'))) ext = '.svg';
        else if (fs.existsSync(path.join(frontendAssetsDir, matchedLogoName + '.png'))) ext = '.png';
        else if (fs.existsSync(path.join(frontendAssetsDir, matchedLogoName + '.jpg'))) ext = '.jpg';
        else if (fs.existsSync(path.join(frontendAssetsDir, matchedLogoName + '.webp'))) ext = '.webp';
        else if (fs.existsSync(path.join(frontendAssetsDir, matchedLogoName + '.ico'))) ext = '.ico';
        
        const newPath = `./assets/logos/${matchedLogoName}${ext}`;
        // replace icon url
        block = block.replace(/icon:\s*"([^"]+)"/, `icon: "${newPath}"`);
    }

    return block;
});

fs.writeFileSync(seedFile, code);
console.log("Updated seedPerks.js with local logo paths.");

