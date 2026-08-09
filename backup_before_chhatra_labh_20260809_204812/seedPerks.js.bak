require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Perk = require('./models/Perk');

async function seed() {
  const mongoURI = process.env.MONGO_URI;
  if(!mongoURI) { console.log('No MONGO_URI'); return; }
  await mongoose.connect(mongoURI);
  
  await Perk.deleteMany({});
  
  const initialPerks = [
    {
      cat: "🎵 Entertainment & Lifestyle", color: "#1DB954", items: [
        { id: 1, name: "Spotify Student Premium", val: "₹99/month (vs ₹119)", icon: "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg", url: "https://www.spotify.com/in-en/student/", steps: ["Go to spotify.com/in/student", "Sign up or log in", "Verify via SheerID", "Get student discount instantly", "Renew every 12 months"] },
        { id: 2, name: "Amazon Prime Student Youth Offer", val: "₹749/year (vs ₹1499)", icon: "https://www.tuttotech.net/wp-content/uploads/2020/10/amazon-prime-student.jpg", url: "https://www.amazon.in/amazonprime", steps: ["Visit amazon.in/prime/student", "Sign in with Amazon account", "Verify student status", "Pay ₹1499 upfront & get ₹750 cashback", "Includes Prime Video + fast delivery"] },
        { id: 3, name: "Apple Music Student", val: "₹59/month + Free Apple TV+", icon: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg", url: "https://www.apple.com/in/apple-music/", steps: ["Open Apple Music App", "Select 'Student' subscription", "Verify enrollment via UNiDAYS", "Enjoy Music + Free Apple TV+"] },
        { id: 4, name: "YouTube Premium Student", val: "₹79/month", icon: "https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg", url: "https://www.youtube.com/premium/student", steps: ["Visit youtube.com/premium/student", "Verify using SheerID", "Enjoy ad-free YouTube & YT Music"] }
      ]
    },
    {
      cat: "💻 Tech & Software", color: "#6366F1", items: [
        { id: 5, name: "GitHub Student Developer Pack", val: "$200k+ tools FREE", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg", url: "https://education.github.com/pack", steps: ["Go to education.github.com/pack", "Sign in with GitHub account", "Verify with college email", "Submit and wait 24–48 hrs", "Access 100+ developer tools"] },
        { id: 6, name: "JetBrains All Products Pack", val: "All IDEs Free", icon: "https://resources.jetbrains.com/storage/products/company/brand/logos/jb_beam.svg", url: "https://www.jetbrains.com/community/education/#students", steps: ["Visit jetbrains.com/student", "Apply with .edu email", "Download JetBrains Toolbox", "Activate via student license", "Renew annually"] },
        { id: 7, name: "Notion for Education", val: "Free Plus Plan", icon: "https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png", url: "https://www.notion.so/product/notion-for-education", steps: ["Sign up with your .edu / .ac.in email", "Go to Settings & Members > Upgrade", "Select 'Get Free Education Plan'"] },
        { id: 8, name: "Autodesk Education", val: "AutoCAD & Maya Free", icon: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Autodesk_Logo_%282021%29.svg", url: "https://www.autodesk.com/education/edu-software/overview", steps: ["Go to autodesk.com/education", "Create account & verify eligibility", "Get 1-year free access to all products"] }
      ]
    },
    {
      cat: "✈️ Travel & Hardware", color: "#14B8A6", items: [
        { id: 9, name: "Indigo Student Concession", val: "6% Off + 10KG Extra Baggage", icon: "https://upload.wikimedia.org/wikipedia/commons/6/69/IndiGo_Airlines_logo.svg", url: "https://www.goindigo.in/student-discount.html", steps: ["Book ticket on goindigo.in", "Select 'Student Fare'", "Carry valid college ID at airport"] },
        { id: 10, name: "Samsung Student Advantage", val: "Up to 10% Off", icon: "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg", url: "https://www.samsung.com/in/multistore/studentadvantage/", steps: ["Register on Samsung Student Store", "Use institutional email ID", "Get exclusive access to discounts"] },
        { id: 11, name: "UPSRTC Student Bus Pass", val: "50% fare concession", icon: "https://paytm-travel-mum-akamai.paytm.com/Bus/operatorlogo/upsrtc.png", url: "https://upsrtc.up.gov.in/", steps: ["Visit nearest UPSRTC depot", "Carry college ID + 2 passport photos", "Fill Form ST-1 at depot", "Pay ₹50 application fee", "Collect pass within 3 working days"] },
        { id: 12, name: "Indian Railways Student Concession", val: "25–50% on train tickets", icon: "https://upload.wikimedia.org/wikipedia/hi/7/7b/Indian_Railways_logo.png", url: "https://indianrailways.gov.in/", steps: ["Collect certificate from college admin", "Get it signed by Principal", "Present at railway booking counter", "Applicable for home town journey"] }
      ]
    }
  ];
  
  await Perk.insertMany(initialPerks);
  console.log('Seeded perks successfully with URLs!');
  process.exit(0);
}
seed();
