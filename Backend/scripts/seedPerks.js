require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const Perk = require('../models/Perk');

async function seed() {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) { console.log('No MONGO_URI'); return; }
  await mongoose.connect(mongoURI);
  
  await Perk.deleteMany({});
  
  const initialPerks = [
    // Entertainment & Lifestyle
    {
      title: "Spotify Student Premium", description: "₹99/month (vs ₹119)", provider: "Spotify", category: "🎵 Entertainment & Lifestyle", discount: "₹20/month",
      icon: "./assets/logos/spotify.svg", officialUrl: "https://www.spotify.com/in-en/student/",
      instructions: ["Go to spotify.com/in/student", "Sign up or log in", "Verify via SheerID", "Get student discount instantly", "Renew every 12 months"],
      color: "#1DB954", source: "manual", sourceId: "1", deduplicationKey: "spotify"
    },
    {
      title: "Amazon Prime Student Youth Offer", description: "₹749/year (vs ₹1499)", provider: "Amazon", category: "🎵 Entertainment & Lifestyle", discount: "50% Off",
      icon: "./assets/logos/amazon.ico", officialUrl: "https://www.amazon.in/amazonprime",
      instructions: ["Visit amazon.in/prime/student", "Sign in with Amazon account", "Verify student status", "Pay ₹1499 upfront & get ₹750 cashback", "Includes Prime Video + fast delivery"],
      color: "#1DB954", source: "manual", sourceId: "2", deduplicationKey: "amazon"
    },
    {
      title: "Apple Music Student", description: "₹59/month + Free Apple TV+", provider: "Apple", category: "🎵 Entertainment & Lifestyle", discount: "Special Rate",
      icon: "./assets/logos/apple.svg", officialUrl: "https://www.apple.com/in/apple-music/",
      instructions: ["Open Apple Music App", "Select 'Student' subscription", "Verify enrollment via UNiDAYS", "Enjoy Music + Free Apple TV+"],
      color: "#1DB954", source: "manual", sourceId: "3", deduplicationKey: "apple"
    },
    {
      title: "YouTube Premium Student", description: "₹79/month", provider: "YouTube", category: "🎵 Entertainment & Lifestyle", discount: "Special Rate",
      icon: "./assets/logos/youtube.svg", officialUrl: "https://www.youtube.com/premium/student",
      instructions: ["Visit youtube.com/premium/student", "Verify using SheerID", "Enjoy ad-free YouTube & YT Music"],
      color: "#1DB954", source: "manual", sourceId: "4", deduplicationKey: "youtube"
    },
    // Tech & Software
    {
      title: "GitHub Student Developer Pack", description: "$200k+ tools FREE", provider: "GitHub", category: "💻 Tech & Software", discount: "100% Free",
      icon: "./assets/logos/github.svg", officialUrl: "https://education.github.com/pack",
      instructions: ["Go to education.github.com/pack", "Sign in with GitHub account", "Verify with college email", "Submit and wait 24–48 hrs", "Access 100+ developer tools"],
      color: "#6366F1", source: "manual", sourceId: "5", deduplicationKey: "github"
    },
    {
      title: "JetBrains All Products Pack", description: "All IDEs Free", provider: "JetBrains", category: "💻 Tech & Software", discount: "100% Free",
      icon: "./assets/logos/jetbrains.svg", officialUrl: "https://www.jetbrains.com/community/education/#students",
      instructions: ["Visit jetbrains.com/student", "Apply with .edu email", "Download JetBrains Toolbox", "Activate via student license", "Renew annually"],
      color: "#6366F1", source: "manual", sourceId: "6", deduplicationKey: "jetbrains"
    },
    {
      title: "Notion for Education", description: "Free Plus Plan", provider: "Notion", category: "💻 Tech & Software", discount: "100% Free",
      icon: "./assets/logos/notion.svg", officialUrl: "https://www.notion.so/product/notion-for-education",
      instructions: ["Sign up with your .edu / .ac.in email", "Go to Settings & Members > Upgrade", "Select 'Get Free Education Plan'"],
      color: "#6366F1", source: "manual", sourceId: "7", deduplicationKey: "notion"
    },
    {
      title: "Autodesk Education", description: "AutoCAD & Maya Free", provider: "Autodesk", category: "💻 Tech & Software", discount: "100% Free",
      icon: "./assets/logos/autodesk.svg", officialUrl: "https://www.autodesk.com/education/edu-software/overview",
      instructions: ["Go to autodesk.com/education", "Create account & verify eligibility", "Get 1-year free access to all products"],
      color: "#6366F1", source: "manual", sourceId: "8", deduplicationKey: "autodesk"
    },
    {
      title: "Grammarly Premium Student Discount", description: "Discount on Grammarly Premium", provider: "Grammarly", category: "💻 Tech & Software", discount: "Special Rate",
      icon: "./assets/logos/grammarly.svg", officialUrl: "https://www.grammarly.com/edu",
      instructions: ["Visit grammarly.com/edu or your university portal", "Sign up using your institutional email", "Verify your student status", "Access Grammarly Premium at a discounted rate"],
      color: "#6366F1", source: "manual", sourceId: "13", deduplicationKey: "grammarly"
    },
    {
      title: "Evernote Personal for Students", description: "50% off a full year of Evernote Personal", provider: "Evernote", category: "💻 Tech & Software", discount: "50% Off",
      icon: "./assets/logos/evernote.svg", officialUrl: "https://evernote.com/students",
      instructions: ["Go to evernote.com/students", "Create an account or log in", "Verify your UNiDAYS student status", "Enjoy 50% off for a full year"],
      color: "#6366F1", source: "manual", sourceId: "14", deduplicationKey: "evernote"
    },
    // Travel & Hardware
    {
      title: "Indigo Student Concession", description: "6% Off + 10KG Extra Baggage", provider: "Indigo", category: "✈️ Travel & Hardware", discount: "6% Off",
      icon: "./assets/logos/indigo.svg", officialUrl: "https://www.goindigo.in/student-discount.html",
      instructions: ["Book ticket on goindigo.in", "Select 'Student Fare'", "Carry valid college ID at airport"],
      color: "#14B8A6", source: "manual", sourceId: "9", deduplicationKey: "indigo"
    },
    {
      title: "Samsung Student Advantage", description: "Up to 10% Off", provider: "Samsung", category: "✈️ Travel & Hardware", discount: "Up to 10% Off",
      icon: "./assets/logos/samsung.svg", officialUrl: "https://www.samsung.com/in/multistore/studentadvantage/",
      instructions: ["Register on Samsung Student Store", "Use institutional email ID", "Get exclusive access to discounts"],
      color: "#14B8A6", source: "manual", sourceId: "10", deduplicationKey: "samsung"
    },
    {
      title: "UPSRTC Student Bus Pass", description: "50% fare concession", provider: "UPSRTC", category: "✈️ Travel & Hardware", discount: "50% Off",
      icon: "./assets/logos/upsrtc.png", officialUrl: "https://upsrtc.up.gov.in/",
      instructions: ["Visit nearest UPSRTC depot", "Carry college ID + 2 passport photos", "Fill Form ST-1 at depot", "Pay ₹50 application fee", "Collect pass within 3 working days"],
      color: "#14B8A6", source: "manual", sourceId: "11", deduplicationKey: "upsrtc"
    },
    {
      title: "Indian Railways Student Concession", description: "25–50% on train tickets", provider: "Indian Railways", category: "✈️ Travel & Hardware", discount: "25-50% Off",
      icon: "./assets/logos/irctc.svg", officialUrl: "https://indianrailways.gov.in/",
      instructions: ["Collect certificate from college admin", "Get it signed by Principal", "Present at railway booking counter", "Applicable for home town journey"],
      color: "#14B8A6", source: "manual", sourceId: "12", deduplicationKey: "indianrailways"
    }
  ,
    {
      title: "Air India Student", description: "Student fares / extra baggage", provider: "Air India", category: "✈️ Travel & Hardware", discount: "Special Fares",
      icon: "./assets/logos/air-india.ico", officialUrl: "https://www.airindia.com/",
      instructions: ["Visit Air India website","Book under student concession","Provide valid student ID"],
      color: "#14B8A6", source: "manual", sourceId: "15", deduplicationKey: "airindia"
    },
    {
      title: "FlixBus Student", description: "Student discounts on selected routes", provider: "FlixBus", category: "✈️ Travel & Hardware", discount: "Discounted Routes",
      icon: "./assets/logos/flixbus.png", officialUrl: "https://www.flixbus.in/",
      instructions: ["Check Student beans or UNiDAYS for FlixBus discount","Apply code at checkout"],
      color: "#14B8A6", source: "manual", sourceId: "16", deduplicationKey: "flixbus"
    },
    {
      title: "Emirates Student", description: "Student fares / additional baggage on eligible bookings", provider: "Emirates", category: "✈️ Travel & Hardware", discount: "Up to 10% Off",
      icon: "./assets/logos/emirates.svg", officialUrl: "https://www.emirates.com/in/english/special-offers/student-special-fares/",
      instructions: ["Use code STUDENT when booking","Verify student status"],
      color: "#14B8A6", source: "manual", sourceId: "17", deduplicationKey: "emirates"
    },
    {
      title: "Qatar Airways Student Club", description: "Special student fares & baggage", provider: "Qatar Airways", category: "✈️ Travel & Hardware", discount: "Student Club Fares",
      icon: "./assets/logos/qatar-airways.svg", officialUrl: "https://www.qatarairways.com/en-in/student-club.html",
      instructions: ["Join Student Club","Book flights for discounts and extra baggage"],
      color: "#14B8A6", source: "manual", sourceId: "18", deduplicationKey: "qatarairways"
    },
    {
      title: "KAYAK Student", description: "Student travel deals", provider: "KAYAK", category: "✈️ Travel & Hardware", discount: "Varies",
      icon: "./assets/logos/kayak.png", officialUrl: "https://www.myunidays.com/IN/en-IN",
      instructions: ["Check UNiDAYS for KAYAK offers"],
      color: "#14B8A6", source: "manual", sourceId: "19", deduplicationKey: "kayak"
    },
    {
      title: "Microsoft 365 Education", description: "Free with eligible institution", provider: "Microsoft", category: "💻 Tech & Software", discount: "100% Free",
      icon: "./assets/logos/microsoft.ico", officialUrl: "https://www.microsoft.com/en-us/education/products/office",
      instructions: ["Sign up with your school email address"],
      color: "#14B8A6", source: "manual", sourceId: "20", deduplicationKey: "microsoft"
    },
    {
      title: "Adobe Creative Cloud Student", description: "Student pricing", provider: "Adobe", category: "💻 Tech & Software", discount: "Over 60% Off",
      icon: "./assets/logos/adobe.svg", officialUrl: "https://www.adobe.com/in/creativecloud/buy/students.html",
      instructions: ["Visit the student page and verify with a .edu email"],
      color: "#14B8A6", source: "manual", sourceId: "21", deduplicationKey: "adobe"
    },
    {
      title: "Canva Education", description: "Free / education access", provider: "Canva", category: "💻 Tech & Software", discount: "100% Free",
      icon: "./assets/logos/canva.svg", officialUrl: "https://www.canva.com/education/",
      instructions: ["Verify as a student or teacher using your institutional email"],
      color: "#14B8A6", source: "manual", sourceId: "22", deduplicationKey: "canva"
    },
    {
      title: "Figma Education", description: "Free education plan", provider: "Figma", category: "💻 Tech & Software", discount: "100% Free",
      icon: "./assets/logos/figma.svg", officialUrl: "https://www.figma.com/education/",
      instructions: ["Apply for Figma education status"],
      color: "#14B8A6", source: "manual", sourceId: "23", deduplicationKey: "figma"
    },
    {
      title: "Cursor Student", description: "Student/education offers", provider: "Cursor", category: "💻 Tech & Software", discount: "Varies",
      icon: "./assets/logos/cursor.png", officialUrl: "https://www.cursor.com/",
      instructions: ["Sign up with GitHub Student Developer Pack or .edu email"],
      color: "#14B8A6", source: "manual", sourceId: "24", deduplicationKey: "cursor"
    },
    {
      title: "Perplexity Student", description: "Student offer", provider: "Perplexity", category: "💻 Tech & Software", discount: "Varies",
      icon: "./assets/logos/perplexity.ico", officialUrl: "https://www.perplexity.ai/",
      instructions: ["Sign up and check for student deals"],
      color: "#14B8A6", source: "manual", sourceId: "25", deduplicationKey: "perplexity"
    },
    {
      title: "Google Gemini Student", description: "Student offers when available", provider: "Google", category: "💻 Tech & Software", discount: "Varies",
      icon: "./assets/logos/gemini.svg", officialUrl: "https://gemini.google/",
      instructions: ["Check Google workspace for education or promotions"],
      color: "#14B8A6", source: "manual", sourceId: "26", deduplicationKey: "google"
    },
    {
      title: "AWS Educate", description: "Student/cloud credits through eligible programs", provider: "AWS", category: "💻 Tech & Software", discount: "Free Credits",
      icon: "./assets/logos/aws.png", officialUrl: "https://aws.amazon.com/education/",
      instructions: ["Join AWS Educate for training and credits"],
      color: "#14B8A6", source: "manual", sourceId: "27", deduplicationKey: "aws"
    },
    {
      title: "DigitalOcean Student", description: "Student credits", provider: "DigitalOcean", category: "💻 Tech & Software", discount: "$200 Credits",
      icon: "./assets/logos/digitalocean.svg", officialUrl: "https://www.digitalocean.com/",
      instructions: ["Available through the GitHub Student Developer Pack"],
      color: "#14B8A6", source: "manual", sourceId: "28", deduplicationKey: "digitalocean"
    },
    {
      title: "Microsoft Azure for Students", description: "Student credits", provider: "Microsoft Azure", category: "💻 Tech & Software", discount: "$100 Credits",
      icon: "./assets/logos/azure.ico", officialUrl: "https://azure.microsoft.com/en-us/free/students/",
      instructions: ["Sign up with school email to get $100 in Azure credits"],
      color: "#14B8A6", source: "manual", sourceId: "29", deduplicationKey: "microsoftazure"
    },
    {
      title: "Lenovo Student", description: "Student discount", provider: "Lenovo", category: "📱 Electronics & Hardware", discount: "Varies",
      icon: "./assets/logos/lenovo.svg", officialUrl: "https://www.lenovo.com/in/en/student/",
      instructions: ["Verify student status on Lenovo store"],
      color: "#14B8A6", source: "manual", sourceId: "30", deduplicationKey: "lenovo"
    },
    {
      title: "Dell Student", description: "Student savings", provider: "Dell", category: "📱 Electronics & Hardware", discount: "Varies",
      icon: "./assets/logos/dell.svg", officialUrl: "https://www.dell.com/en-in/lp/student-purchase-program",
      instructions: ["Register for the student purchase program"],
      color: "#14B8A6", source: "manual", sourceId: "31", deduplicationKey: "dell"
    },
    {
      title: "HP Student Store", description: "Student pricing", provider: "HP", category: "📱 Electronics & Hardware", discount: "Varies",
      icon: "./assets/logos/hp.svg", officialUrl: "https://www.hp.com/in-en/shop/education-store",
      instructions: ["Sign up to the HP Education Store with college ID"],
      color: "#14B8A6", source: "manual", sourceId: "32", deduplicationKey: "hp"
    },
    {
      title: "ASUS Student", description: "Student offers", provider: "ASUS", category: "📱 Electronics & Hardware", discount: "Varies",
      icon: "./assets/logos/asus.svg", officialUrl: "https://www.asus.com/in/",
      instructions: ["Check the ASUS education store for offers"],
      color: "#14B8A6", source: "manual", sourceId: "33", deduplicationKey: "asus"
    },
    {
      title: "Acer Student", description: "Student discounts", provider: "Acer", category: "📱 Electronics & Hardware", discount: "Varies",
      icon: "./assets/logos/acer.svg", officialUrl: "https://www.acer.com/in-en",
      instructions: ["Register on Acer India with student ID"],
      color: "#14B8A6", source: "manual", sourceId: "34", deduplicationKey: "acer"
    },
    {
      title: "OnePlus Student", description: "Student offers", provider: "OnePlus", category: "📱 Electronics & Hardware", discount: "Varies",
      icon: "./assets/logos/oneplus.svg", officialUrl: "https://www.oneplus.in/",
      instructions: ["Verify your student status on the OnePlus education portal"],
      color: "#14B8A6", source: "manual", sourceId: "35", deduplicationKey: "oneplus"
    },
    {
      title: "OPPO Student", description: "Student offers", provider: "OPPO", category: "📱 Electronics & Hardware", discount: "Varies",
      icon: "./assets/logos/oppo.svg", officialUrl: "https://www.oppo.com/in/",
      instructions: ["Check OPPO student discounts section"],
      color: "#14B8A6", source: "manual", sourceId: "36", deduplicationKey: "oppo"
    },
    {
      title: "Razer Student", description: "Student discounts", provider: "Razer", category: "📱 Electronics & Hardware", discount: "Up to 15% Off",
      icon: "./assets/logos/razer.svg", officialUrl: "https://www.razer.com/",
      instructions: ["Use UNiDAYS for Razer store discounts"],
      color: "#14B8A6", source: "manual", sourceId: "37", deduplicationKey: "razer"
    },
    {
      title: "Tidal Student", description: "Student pricing", provider: "Tidal", category: "🎵 Entertainment & Lifestyle", discount: "50% Off",
      icon: "./assets/logos/tidal.svg", officialUrl: "https://tidal.com/",
      instructions: ["Verify student status through SheerID"],
      color: "#14B8A6", source: "manual", sourceId: "38", deduplicationKey: "tidal"
    },
    {
      title: "Chess.com Student", description: "Student discount", provider: "Chess.com", category: "🎵 Entertainment & Lifestyle", discount: "Varies",
      icon: "./assets/logos/chess.svg", officialUrl: "https://www.chess.com/",
      instructions: ["Check student pricing on Chess.com"],
      color: "#14B8A6", source: "manual", sourceId: "39", deduplicationKey: "chesscom"
    },
    {
      title: "H&M Student", description: "10% Student Discount", provider: "H&M", category: "👕 Fashion & Sneakers", discount: "10% Off",
      icon: "./assets/logos/hm.ico", officialUrl: "https://www2.hm.com/en_in/index.html",
      instructions: ["Verify through UNiDAYS for 10% off"],
      color: "#14B8A6", source: "manual", sourceId: "40", deduplicationKey: "hm"
    },
    {
      title: "AJIO Student", description: "Student offer", provider: "AJIO", category: "👕 Fashion & Sneakers", discount: "Varies",
      icon: "./assets/logos/ajio.png", officialUrl: "https://www.ajio.com/",
      instructions: ["Look out for student-specific coupons"],
      color: "#14B8A6", source: "manual", sourceId: "41", deduplicationKey: "ajio"
    },
    {
      title: "Myntra Student", description: "Student offers", provider: "Myntra", category: "👕 Fashion & Sneakers", discount: "Varies",
      icon: "./assets/logos/myntra.png", officialUrl: "https://www.myntra.com/",
      instructions: ["Check Myntra's youth / student offers"],
      color: "#14B8A6", source: "manual", sourceId: "42", deduplicationKey: "myntra"
    },
    {
      title: "PUMA Student", description: "Student discount", provider: "PUMA", category: "👕 Fashion & Sneakers", discount: "Varies",
      icon: "./assets/logos/puma.svg", officialUrl: "https://in.puma.com/",
      instructions: ["Verify student status on PUMA"],
      color: "#14B8A6", source: "manual", sourceId: "43", deduplicationKey: "puma"
    },
    {
      title: "Adidas Student", description: "Student discount", provider: "Adidas", category: "👕 Fashion & Sneakers", discount: "Varies",
      icon: "./assets/logos/adidas.svg", officialUrl: "https://www.adidas.co.in/",
      instructions: ["Verify student status via UNiDAYS"],
      color: "#14B8A6", source: "manual", sourceId: "44", deduplicationKey: "adidas"
    },
    {
      title: "Nike Student", description: "Student discount", provider: "Nike", category: "👕 Fashion & Sneakers", discount: "Varies",
      icon: "./assets/logos/nike.svg", officialUrl: "https://www.nike.com/in/",
      instructions: ["Verify student status via UNiDAYS"],
      color: "#14B8A6", source: "manual", sourceId: "45", deduplicationKey: "nike"
    },
    {
      title: "Crocs Student", description: "Student discount", provider: "Crocs", category: "👕 Fashion & Sneakers", discount: "Varies",
      icon: "./assets/logos/crocs.png", officialUrl: "https://www.crocs.in/",
      instructions: ["Check student beans or UNiDAYS for Crocs"],
      color: "#14B8A6", source: "manual", sourceId: "46", deduplicationKey: "crocs"
    },
    {
      title: "Converse Student", description: "Student offers", provider: "Converse", category: "👕 Fashion & Sneakers", discount: "Varies",
      icon: "./assets/logos/converse.svg", officialUrl: "https://www.converse.in/",
      instructions: ["Check for student offers on the site"],
      color: "#14B8A6", source: "manual", sourceId: "47", deduplicationKey: "converse"
    },
    {
      title: "Levi's Student", description: "Student offer", provider: "Levi's", category: "👕 Fashion & Sneakers", discount: "Varies",
      icon: "./assets/logos/levis.png", officialUrl: "https://levi.in/",
      instructions: ["Verify through UNiDAYS or Student Beans"],
      color: "#14B8A6", source: "manual", sourceId: "48", deduplicationKey: "levis"
    },
    {
      title: "ASOS Student", description: "Student discount", provider: "ASOS", category: "👕 Fashion & Sneakers", discount: "10% Off",
      icon: "./assets/logos/asos.png", officialUrl: "https://www.asos.com/",
      instructions: ["Verify via UNiDAYS for 10% off till you graduate"],
      color: "#14B8A6", source: "manual", sourceId: "49", deduplicationKey: "asos"
    },
    {
      title: "Swiggy Student", description: "Student-exclusive offers", provider: "Swiggy", category: "🍔 Food & Delivery", discount: "Varies",
      icon: "./assets/logos/swiggy.svg", officialUrl: "https://www.swiggy.com/",
      instructions: ["Check Swiggy app for campus offers"],
      color: "#14B8A6", source: "manual", sourceId: "50", deduplicationKey: "swiggy"
    },
    {
      title: "Zomato Student", description: "Student/promotional offers", provider: "Zomato", category: "🍔 Food & Delivery", discount: "Varies",
      icon: "./assets/logos/zomato.svg", officialUrl: "https://www.zomato.com/",
      instructions: ["Check Zomato app for university specific promos"],
      color: "#14B8A6", source: "manual", sourceId: "51", deduplicationKey: "zomato"
    },
    {
      title: "Starbucks Student", description: "Student offers", provider: "Starbucks", category: "🍔 Food & Delivery", discount: "Varies",
      icon: "./assets/logos/starbucks.svg", officialUrl: "https://www.starbucks.in/",
      instructions: ["Check UNiDAYS for Starbucks offers"],
      color: "#14B8A6", source: "manual", sourceId: "52", deduplicationKey: "starbucks"
    },
    {
      title: "Domino's Student", description: "Student/promotional deals", provider: "Domino's", category: "🍔 Food & Delivery", discount: "Varies",
      icon: "./assets/logos/dominos.png", officialUrl: "https://www.dominos.co.in/",
      instructions: ["Look for Everyday Value Offers or student discounts"],
      color: "#14B8A6", source: "manual", sourceId: "53", deduplicationKey: "dominos"
    },
    {
      title: "Pizza Hut Student", description: "Student/promotional deals", provider: "Pizza Hut", category: "🍔 Food & Delivery", discount: "Varies",
      icon: "./assets/logos/pizza-hut.png", officialUrl: "https://www.pizzahut.co.in/",
      instructions: ["Check for college offers on the app"],
      color: "#14B8A6", source: "manual", sourceId: "54", deduplicationKey: "pizzahut"
    },
    {
      title: "McDonald's Student", description: "Student/local offers", provider: "McDonald's", category: "🍔 Food & Delivery", discount: "Varies",
      icon: "./assets/logos/mcdonalds.svg", officialUrl: "https://mcdonaldsindia.com/",
      instructions: ["Check McDonald's app for current deals"],
      color: "#14B8A6", source: "manual", sourceId: "55", deduplicationKey: "mcdonalds"
    },
    {
      title: "Subway Student", description: "Student/local offers", provider: "Subway", category: "🍔 Food & Delivery", discount: "Varies",
      icon: "./assets/logos/subway.ico", officialUrl: "https://www.subway.com/en-IN",
      instructions: ["Check local store for student ID concessions"],
      color: "#14B8A6", source: "manual", sourceId: "56", deduplicationKey: "subway"
    },
    {
      title: "Coursera Student", description: "Student/education offers", provider: "Coursera", category: "📚 Education & Learning", discount: "Free Course Access",
      icon: "./assets/logos/coursera.svg", officialUrl: "https://www.coursera.org/",
      instructions: ["Join Coursera for Campus with student email"],
      color: "#14B8A6", source: "manual", sourceId: "57", deduplicationKey: "coursera"
    },
    {
      title: "Udemy Student", description: "Student discounts/promotions", provider: "Udemy", category: "📚 Education & Learning", discount: "Varies",
      icon: "./assets/logos/udemy.svg", officialUrl: "https://www.udemy.com/",
      instructions: ["Check for new student promotional prices"],
      color: "#14B8A6", source: "manual", sourceId: "58", deduplicationKey: "udemy"
    },
    {
      title: "Skillshare Student", description: "Student offers", provider: "Skillshare", category: "📚 Education & Learning", discount: "Varies",
      icon: "./assets/logos/skillshare.svg", officialUrl: "https://www.skillshare.com/",
      instructions: ["Verify student status for premium access offers"],
      color: "#14B8A6", source: "manual", sourceId: "59", deduplicationKey: "skillshare"
    },
    {
      title: "DataCamp Student", description: "Student pricing", provider: "DataCamp", category: "📚 Education & Learning", discount: "Student Pricing",
      icon: "./assets/logos/datacamp.svg", officialUrl: "https://www.datacamp.com/",
      instructions: ["Available free via GitHub Student Developer Pack"],
      color: "#14B8A6", source: "manual", sourceId: "60", deduplicationKey: "datacamp"
    },
    {
      title: "Quizlet Student", description: "Student pricing", provider: "Quizlet", category: "📚 Education & Learning", discount: "Varies",
      icon: "./assets/logos/quizlet.svg", officialUrl: "https://quizlet.com/",
      instructions: ["Check for student plan prices"],
      color: "#14B8A6", source: "manual", sourceId: "61", deduplicationKey: "quizlet"
    },
    {
      title: "Wolfram Alpha Student", description: "Student pricing", provider: "Wolfram Alpha", category: "📚 Education & Learning", discount: "Special Rate",
      icon: "./assets/logos/wolfram.svg", officialUrl: "https://www.wolframalpha.com/",
      instructions: ["Sign up with a student email for Pro discount"],
      color: "#14B8A6", source: "manual", sourceId: "62", deduplicationKey: "wolframalpha"
    },
    {
      title: "MATLAB Student", description: "Student license", provider: "MathWorks", category: "📚 Education & Learning", discount: "Student License Rate",
      icon: "./assets/logos/matlab.png", officialUrl: "https://www.mathworks.com/academia/students.html",
      instructions: ["Purchase student suite"],
      color: "#14B8A6", source: "manual", sourceId: "63", deduplicationKey: "mathworks"
    },
    {
      title: "Overleaf Student", description: "Student/education access", provider: "Overleaf", category: "📚 Education & Learning", discount: "Varies",
      icon: "./assets/logos/overleaf.svg", officialUrl: "https://www.overleaf.com/",
      instructions: ["Check if your university provides premium Overleaf access"],
      color: "#14B8A6", source: "manual", sourceId: "64", deduplicationKey: "overleaf"
    },
    {
      title: "Rosetta Stone Student", description: "Student discount", provider: "Rosetta Stone", category: "📚 Education & Learning", discount: "Varies",
      icon: "./assets/logos/rosetta-stone.png", officialUrl: "https://www.rosettastone.com/",
      instructions: ["Check student discount programs"],
      color: "#14B8A6", source: "manual", sourceId: "65", deduplicationKey: "rosettastone"
    },
    {
      title: "Cult.fit Student", description: "Student/partner offers", provider: "Cult.fit", category: "🏋️ Fitness & Wellness", discount: "Varies",
      icon: "./assets/logos/cultfit.png", officialUrl: "https://www.cult.fit/",
      instructions: ["Check for campus special memberships"],
      color: "#14B8A6", source: "manual", sourceId: "66", deduplicationKey: "cultfit"
    },
    {
      title: "Strava Student", description: "Student pricing", provider: "Strava", category: "🏋️ Fitness & Wellness", discount: "50% Off",
      icon: "./assets/logos/strava.svg", officialUrl: "https://www.strava.com/",
      instructions: ["Verify student status on Strava"],
      color: "#14B8A6", source: "manual", sourceId: "67", deduplicationKey: "strava"
    },
    {
      title: "Nike Training Club", description: "Free", provider: "Nike Training", category: "🏋️ Fitness & Wellness", discount: "100% Free",
      icon: "./assets/logos/nike.svg", officialUrl: "https://www.nike.com/ntc-app",
      instructions: ["Download the app and sign in"],
      color: "#14B8A6", source: "manual", sourceId: "68", deduplicationKey: "niketraining"
    },
    {
      title: "Adidas Training", description: "Free", provider: "Adidas Training", category: "🏋️ Fitness & Wellness", discount: "100% Free",
      icon: "./assets/logos/adidas.svg", officialUrl: "https://www.adidas.com/",
      instructions: ["Download the app"],
      color: "#14B8A6", source: "manual", sourceId: "69", deduplicationKey: "adidastraining"
    },
    {
      title: "Headspace Student", description: "Student pricing", provider: "Headspace", category: "🏋️ Fitness & Wellness", discount: "85% Off",
      icon: "./assets/logos/headspace.svg", officialUrl: "https://www.headspace.com/",
      instructions: ["Verify with SheerID for student plan"],
      color: "#14B8A6", source: "manual", sourceId: "70", deduplicationKey: "headspace"
    },
    {
      title: "Calm Student", description: "Student offers", provider: "Calm", category: "🏋️ Fitness & Wellness", discount: "Varies",
      icon: "./assets/logos/calm.png", officialUrl: "https://www.calm.com/",
      instructions: ["Check for student plan options"],
      color: "#14B8A6", source: "manual", sourceId: "71", deduplicationKey: "calm"
    },
    {
      title: "MAC Cosmetics Student", description: "Up to 15% Off", provider: "MAC Cosmetics", category: "🧴 Beauty & Personal Care", discount: "Up to 15% Off",
      icon: "./assets/logos/mac.png", officialUrl: "https://www.maccosmetics.in/",
      instructions: ["Verify student status on UNiDAYS"],
      color: "#14B8A6", source: "manual", sourceId: "72", deduplicationKey: "maccosmetics"
    },
    {
      title: "Nykaa Student", description: "Student/promotional offers", provider: "Nykaa", category: "🧴 Beauty & Personal Care", discount: "Varies",
      icon: "./assets/logos/nykaa.png", officialUrl: "https://www.nykaa.com/",
      instructions: ["Check UNiDAYS or app offers"],
      color: "#14B8A6", source: "manual", sourceId: "73", deduplicationKey: "nykaa"
    },
    {
      title: "Sephora India Student", description: "Student/promotional offers", provider: "Sephora India", category: "🧴 Beauty & Personal Care", discount: "Varies",
      icon: "./assets/logos/sephora.png", officialUrl: "https://sephora.in/",
      instructions: ["Check UNiDAYS or store offers"],
      color: "#14B8A6", source: "manual", sourceId: "74", deduplicationKey: "sephoraindia"
    },
    {
      title: "iHerb Student", description: "Student offers", provider: "iHerb", category: "🧴 Beauty & Personal Care", discount: "Varies",
      icon: "./assets/logos/iherb.png", officialUrl: "https://www.iherb.com/",
      instructions: ["Check for student promotional codes"],
      color: "#14B8A6", source: "manual", sourceId: "75", deduplicationKey: "iherb"
    },
    {
      title: "Apollo Pharmacy Student", description: "Student/member offers", provider: "Apollo Pharmacy", category: "🧴 Beauty & Personal Care", discount: "Varies",
      icon: "./assets/logos/apollo-pharmacy.png", officialUrl: "https://www.apollopharmacy.in/",
      instructions: ["Ask for member/student offers at store"],
      color: "#14B8A6", source: "manual", sourceId: "76", deduplicationKey: "apollopharmacy"
    }
  ];
  
  await Perk.insertMany(initialPerks);
  console.log('Seeded perks successfully in flat schema!');
  process.exit(0);
}
seed();
