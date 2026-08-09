require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Perk = require('./models/Perk');

async function seed() {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) { console.log('No MONGO_URI'); return; }
  await mongoose.connect(mongoURI);
  
  await Perk.deleteMany({});
  
  const initialPerks = [
    // Entertainment & Lifestyle
    {
      title: "Spotify Student Premium", description: "₹99/month (vs ₹119)", provider: "Spotify", category: "🎵 Entertainment & Lifestyle", discount: "₹20/month",
      icon: "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg", officialUrl: "https://www.spotify.com/in-en/student/",
      instructions: ["Go to spotify.com/in/student", "Sign up or log in", "Verify via SheerID", "Get student discount instantly", "Renew every 12 months"],
      color: "#1DB954", source: "manual", sourceId: "1", deduplicationKey: "manual::spotify_spotifystudentpremium"
    },
    {
      title: "Amazon Prime Student Youth Offer", description: "₹749/year (vs ₹1499)", provider: "Amazon", category: "🎵 Entertainment & Lifestyle", discount: "50% Off",
      icon: "https://www.tuttotech.net/wp-content/uploads/2020/10/amazon-prime-student.jpg", officialUrl: "https://www.amazon.in/amazonprime",
      instructions: ["Visit amazon.in/prime/student", "Sign in with Amazon account", "Verify student status", "Pay ₹1499 upfront & get ₹750 cashback", "Includes Prime Video + fast delivery"],
      color: "#1DB954", source: "manual", sourceId: "2", deduplicationKey: "manual::amazon_amazonprimestudentyouthoffer"
    },
    {
      title: "Apple Music Student", description: "₹59/month + Free Apple TV+", provider: "Apple", category: "🎵 Entertainment & Lifestyle", discount: "Special Rate",
      icon: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg", officialUrl: "https://www.apple.com/in/apple-music/",
      instructions: ["Open Apple Music App", "Select 'Student' subscription", "Verify enrollment via UNiDAYS", "Enjoy Music + Free Apple TV+"],
      color: "#1DB954", source: "manual", sourceId: "3", deduplicationKey: "manual::apple_applemusicstudent"
    },
    {
      title: "YouTube Premium Student", description: "₹79/month", provider: "YouTube", category: "🎵 Entertainment & Lifestyle", discount: "Special Rate",
      icon: "https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg", officialUrl: "https://www.youtube.com/premium/student",
      instructions: ["Visit youtube.com/premium/student", "Verify using SheerID", "Enjoy ad-free YouTube & YT Music"],
      color: "#1DB954", source: "manual", sourceId: "4", deduplicationKey: "manual::youtube_youtubepremiumstudent"
    },
    // Tech & Software
    {
      title: "GitHub Student Developer Pack", description: "$200k+ tools FREE", provider: "GitHub", category: "💻 Tech & Software", discount: "100% Free",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg", officialUrl: "https://education.github.com/pack",
      instructions: ["Go to education.github.com/pack", "Sign in with GitHub account", "Verify with college email", "Submit and wait 24–48 hrs", "Access 100+ developer tools"],
      color: "#6366F1", source: "manual", sourceId: "5", deduplicationKey: "manual::github_githubstudentdeveloperpack"
    },
    {
      title: "JetBrains All Products Pack", description: "All IDEs Free", provider: "JetBrains", category: "💻 Tech & Software", discount: "100% Free",
      icon: "https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg", officialUrl: "https://www.jetbrains.com/community/education/#students",
      instructions: ["Visit jetbrains.com/student", "Apply with .edu email", "Download JetBrains Toolbox", "Activate via student license", "Renew annually"],
      color: "#6366F1", source: "manual", sourceId: "6", deduplicationKey: "manual::jetbrains_jetbrainsallproductspack"
    },
    {
      title: "Notion for Education", description: "Free Plus Plan", provider: "Notion", category: "💻 Tech & Software", discount: "100% Free",
      icon: "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png", officialUrl: "https://www.notion.so/product/notion-for-education",
      instructions: ["Sign up with your .edu / .ac.in email", "Go to Settings & Members > Upgrade", "Select 'Get Free Education Plan'"],
      color: "#6366F1", source: "manual", sourceId: "7", deduplicationKey: "manual::notion_notionforeducation"
    },
    {
      title: "Autodesk Education", description: "AutoCAD & Maya Free", provider: "Autodesk", category: "💻 Tech & Software", discount: "100% Free",
      icon: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Autodesk_Logo_%282021%29.svg", officialUrl: "https://www.autodesk.com/education/edu-software/overview",
      instructions: ["Go to autodesk.com/education", "Create account & verify eligibility", "Get 1-year free access to all products"],
      color: "#6366F1", source: "manual", sourceId: "8", deduplicationKey: "manual::autodesk_autodeskeducation"
    },
    // Travel & Hardware
    {
      title: "Indigo Student Concession", description: "6% Off + 10KG Extra Baggage", provider: "Indigo", category: "✈️ Travel & Hardware", discount: "6% Off",
      icon: "https://upload.wikimedia.org/wikipedia/commons/6/69/IndiGo_Airlines_logo.svg", officialUrl: "https://www.goindigo.in/student-discount.html",
      instructions: ["Book ticket on goindigo.in", "Select 'Student Fare'", "Carry valid college ID at airport"],
      color: "#14B8A6", source: "manual", sourceId: "9", deduplicationKey: "manual::indigo_indigostudentconcession"
    },
    {
      title: "Samsung Student Advantage", description: "Up to 10% Off", provider: "Samsung", category: "✈️ Travel & Hardware", discount: "Up to 10% Off",
      icon: "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg", officialUrl: "https://www.samsung.com/in/multistore/studentadvantage/",
      instructions: ["Register on Samsung Student Store", "Use institutional email ID", "Get exclusive access to discounts"],
      color: "#14B8A6", source: "manual", sourceId: "10", deduplicationKey: "manual::samsung_samsungstudentadvantage"
    },
    {
      title: "UPSRTC Student Bus Pass", description: "50% fare concession", provider: "UPSRTC", category: "✈️ Travel & Hardware", discount: "50% Off",
      icon: "https://paytm-travel-mum-akamai.paytm.com/Bus/operatorlogo/upsrtc.png", officialUrl: "https://upsrtc.up.gov.in/",
      instructions: ["Visit nearest UPSRTC depot", "Carry college ID + 2 passport photos", "Fill Form ST-1 at depot", "Pay ₹50 application fee", "Collect pass within 3 working days"],
      color: "#14B8A6", source: "manual", sourceId: "11", deduplicationKey: "manual::upsrtc_upsrtcstudentbuspass"
    },
    {
      title: "Indian Railways Student Concession", description: "25–50% on train tickets", provider: "Indian Railways", category: "✈️ Travel & Hardware", discount: "25-50% Off",
      icon: "https://upload.wikimedia.org/wikipedia/hi/7/7b/Indian_Railways_logo.png", officialUrl: "https://indianrailways.gov.in/",
      instructions: ["Collect certificate from college admin", "Get it signed by Principal", "Present at railway booking counter", "Applicable for home town journey"],
      color: "#14B8A6", source: "manual", sourceId: "12", deduplicationKey: "manual::indianrailways_indianrailwaysstudentconcession"
    }
  ];
  
  await Perk.insertMany(initialPerks);
  console.log('Seeded perks successfully in flat schema!');
  process.exit(0);
}
seed();
