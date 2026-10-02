const Groq = require('groq-sdk');
const cron = require('node-cron');
const Perk = require('../models/Perk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const syncPerksWithAI = async () => {
    try {
        console.log("Starting AI Perk Sync...");

        // Fetch current perks to give AI context
        const currentPerks = await Perk.find({}, 'title provider category discount').limit(20);
        const perksContext = currentPerks.map(p => `${p.title} by ${p.provider}`).join(', ');

        const prompt = `
You are an expert on global and Indian student discounts. Analyze this context of existing perks (to understand the standard): ${perksContext}.
Apart from GitHub Student Pack or UNiDAYS, search your knowledge base for ANY highly valuable, genuine student discounts available today.
Think across all categories:
- Software/Productivity (e.g., Notion, Canva, JetBrains, Evernote)
- Entertainment (e.g., Apple Music, YouTube Premium)
- Hardware/Shopping (e.g., Apple Education Pricing, Samsung Student Advantage)
- Travel/Lifestyle (e.g., Indigo Student Discount)

Return exactly 5 new or top genuine student perks.
Return them in the exact JSON object format shown below.
{
  "perks": [
    {
      "title": "String",
      "description": "String",
      "provider": "String",
      "category": "String (e.g., Software, Entertainment, Hardware, Travel)",
      "discount": "String",
      "eligibility": "String",
      "instructions": ["String"],
      "officialUrl": "String (must be valid domain like https://spotify.com)",
      "domainForLogo": "String (just the domain e.g., spotify.com, apple.com)"
    }
  ]
}
`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'qwen/qwen3.8-27b',
            temperature: 0.2,
            response_format: { type: 'json_object' }
        });

        const jsonString = chatCompletion.choices[0].message.content;
        const parsedResponse = JSON.parse(jsonString);
        const newPerks = parsedResponse.perks;

        if (newPerks && Array.isArray(newPerks) && newPerks.length > 0) {
            for (let perkData of newPerks) {
                const iconUrl = `https://logo.clearbit.com/${perkData.domainForLogo}`;

                // create deduplication key
                const dedupKey = perkData.provider.toLowerCase().replace(/[^a-z0-9]/g, '');

                await Perk.findOneAndUpdate(
                    { deduplicationKey: dedupKey },
                    {
                        title: perkData.title,
                        description: perkData.description,
                        provider: perkData.provider,
                        category: perkData.category,
                        discount: perkData.discount,
                        eligibility: perkData.eligibility,
                        instructions: perkData.instructions,
                        officialUrl: perkData.officialUrl,
                        icon: iconUrl,
                        source: 'ai_autopilot',
                        status: 'active',
                        deduplicationKey: dedupKey
                    },
                    { upsert: true, new: true }
                );
            }
            console.log(`✅ Successfully synced ${newPerks.length} perks via AI.`);
        }
    } catch (error) {
        console.error("❌ Error in AI Perk Sync:", error.message);
    }
};

const initializePerkCron = () => {
    // Run daily at midnight (12:00 AM) IST
    cron.schedule('0 0 * * *', () => {
        console.log("Running daily AI Perk Sync cron job...");
        syncPerksWithAI();
    }, {
        timezone: "Asia/Kolkata"
    });
    console.log("✅ AI Perk Sync Cron Job initialized (runs daily at midnight IST).");
};

module.exports = {
    syncPerksWithAI,
    initializePerkCron
};
