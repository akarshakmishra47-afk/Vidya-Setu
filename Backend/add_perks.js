const fs = require('fs');
const path = require('path');

const newPerks = [
  // Travel & Transport
  { title: "Air India Student", description: "Student fares / extra baggage", provider: "Air India", category: "✈️ Travel & Hardware", discount: "Special Fares", officialUrl: "https://www.airindia.com/", instructions: ["Visit Air India website", "Book under student concession", "Provide valid student ID"] },
  { title: "FlixBus Student", description: "Student discounts on selected routes", provider: "FlixBus", category: "✈️ Travel & Hardware", discount: "Discounted Routes", officialUrl: "https://www.flixbus.in/", instructions: ["Check Student beans or UNiDAYS for FlixBus discount", "Apply code at checkout"] },
  { title: "Emirates Student", description: "Student fares / additional baggage on eligible bookings", provider: "Emirates", category: "✈️ Travel & Hardware", discount: "Up to 10% Off", officialUrl: "https://www.emirates.com/in/english/special-offers/student-special-fares/", instructions: ["Use code STUDENT when booking", "Verify student status"] },
  { title: "Qatar Airways Student Club", description: "Special student fares & baggage", provider: "Qatar Airways", category: "✈️ Travel & Hardware", discount: "Student Club Fares", officialUrl: "https://www.qatarairways.com/en-in/student-club.html", instructions: ["Join Student Club", "Book flights for discounts and extra baggage"] },
  { title: "KAYAK Student", description: "Student travel deals", provider: "KAYAK", category: "✈️ Travel & Hardware", discount: "Varies", officialUrl: "https://www.myunidays.com/IN/en-IN", instructions: ["Check UNiDAYS for KAYAK offers"] },

  // Tech, Software & AI
  { title: "Microsoft 365 Education", description: "Free with eligible institution", provider: "Microsoft", category: "💻 Tech & Software", discount: "100% Free", officialUrl: "https://www.microsoft.com/en-us/education/products/office", instructions: ["Sign up with your school email address"] },
  { title: "Adobe Creative Cloud Student", description: "Student pricing", provider: "Adobe", category: "💻 Tech & Software", discount: "Over 60% Off", officialUrl: "https://www.adobe.com/in/creativecloud/buy/students.html", instructions: ["Visit the student page and verify with a .edu email"] },
  { title: "Canva Education", description: "Free / education access", provider: "Canva", category: "💻 Tech & Software", discount: "100% Free", officialUrl: "https://www.canva.com/education/", instructions: ["Verify as a student or teacher using your institutional email"] },
  { title: "Figma Education", description: "Free education plan", provider: "Figma", category: "💻 Tech & Software", discount: "100% Free", officialUrl: "https://www.figma.com/education/", instructions: ["Apply for Figma education status"] },
  { title: "Cursor Student", description: "Student/education offers", provider: "Cursor", category: "💻 Tech & Software", discount: "Varies", officialUrl: "https://www.cursor.com/", instructions: ["Sign up with GitHub Student Developer Pack or .edu email"] },
  { title: "Perplexity Student", description: "Student offer", provider: "Perplexity", category: "💻 Tech & Software", discount: "Varies", officialUrl: "https://www.perplexity.ai/", instructions: ["Sign up and check for student deals"] },
  { title: "Google Gemini Student", description: "Student offers when available", provider: "Google", category: "💻 Tech & Software", discount: "Varies", officialUrl: "https://gemini.google/", instructions: ["Check Google workspace for education or promotions"] },
  { title: "AWS Educate", description: "Student/cloud credits through eligible programs", provider: "AWS", category: "💻 Tech & Software", discount: "Free Credits", officialUrl: "https://aws.amazon.com/education/", instructions: ["Join AWS Educate for training and credits"] },
  { title: "DigitalOcean Student", description: "Student credits", provider: "DigitalOcean", category: "💻 Tech & Software", discount: "$200 Credits", officialUrl: "https://www.digitalocean.com/", instructions: ["Available through the GitHub Student Developer Pack"] },
  { title: "Microsoft Azure for Students", description: "Student credits", provider: "Microsoft Azure", category: "💻 Tech & Software", discount: "$100 Credits", officialUrl: "https://azure.microsoft.com/en-us/free/students/", instructions: ["Sign up with school email to get $100 in Azure credits"] },

  // Electronics & Hardware
  { title: "Apple Education Store", description: "Education pricing", provider: "Apple", category: "📱 Electronics & Hardware", discount: "Education Pricing", officialUrl: "https://www.apple.com/in-edu/store", instructions: ["Verify with UNiDAYS to shop the education store"] },
  { title: "Lenovo Student", description: "Student discount", provider: "Lenovo", category: "📱 Electronics & Hardware", discount: "Varies", officialUrl: "https://www.lenovo.com/in/en/student/", instructions: ["Verify student status on Lenovo store"] },
  { title: "Dell Student", description: "Student savings", provider: "Dell", category: "📱 Electronics & Hardware", discount: "Varies", officialUrl: "https://www.dell.com/en-in/lp/student-purchase-program", instructions: ["Register for the student purchase program"] },
  { title: "HP Student Store", description: "Student pricing", provider: "HP", category: "📱 Electronics & Hardware", discount: "Varies", officialUrl: "https://www.hp.com/in-en/shop/education-store", instructions: ["Sign up to the HP Education Store with college ID"] },
  { title: "ASUS Student", description: "Student offers", provider: "ASUS", category: "📱 Electronics & Hardware", discount: "Varies", officialUrl: "https://www.asus.com/in/", instructions: ["Check the ASUS education store for offers"] },
  { title: "Acer Student", description: "Student discounts", provider: "Acer", category: "📱 Electronics & Hardware", discount: "Varies", officialUrl: "https://www.acer.com/in-en", instructions: ["Register on Acer India with student ID"] },
  { title: "OnePlus Student", description: "Student offers", provider: "OnePlus", category: "📱 Electronics & Hardware", discount: "Varies", officialUrl: "https://www.oneplus.in/", instructions: ["Verify your student status on the OnePlus education portal"] },
  { title: "OPPO Student", description: "Student offers", provider: "OPPO", category: "📱 Electronics & Hardware", discount: "Varies", officialUrl: "https://www.oppo.com/in/", instructions: ["Check OPPO student discounts section"] },
  { title: "Razer Student", description: "Student discounts", provider: "Razer", category: "📱 Electronics & Hardware", discount: "Up to 15% Off", officialUrl: "https://www.razer.com/", instructions: ["Use UNiDAYS for Razer store discounts"] },

  // Entertainment & Streaming
  { title: "Apple TV+ Student", description: "Included with eligible Apple Music Student", provider: "Apple", category: "🎵 Entertainment & Lifestyle", discount: "Free with Music", officialUrl: "https://tv.apple.com/in/", instructions: ["Subscribe to Apple Music Student plan"] },
  { title: "Tidal Student", description: "Student pricing", provider: "Tidal", category: "🎵 Entertainment & Lifestyle", discount: "50% Off", officialUrl: "https://tidal.com/", instructions: ["Verify student status through SheerID"] },
  { title: "Chess.com Student", description: "Student discount", provider: "Chess.com", category: "🎵 Entertainment & Lifestyle", discount: "Varies", officialUrl: "https://www.chess.com/", instructions: ["Check student pricing on Chess.com"] },

  // Fashion & Sneakers
  { title: "H&M Student", description: "10% Student Discount", provider: "H&M", category: "👕 Fashion & Sneakers", discount: "10% Off", officialUrl: "https://www2.hm.com/en_in/index.html", instructions: ["Verify through UNiDAYS for 10% off"] },
  { title: "AJIO Student", description: "Student offer", provider: "AJIO", category: "👕 Fashion & Sneakers", discount: "Varies", officialUrl: "https://www.ajio.com/", instructions: ["Look out for student-specific coupons"] },
  { title: "Myntra Student", description: "Student offers", provider: "Myntra", category: "👕 Fashion & Sneakers", discount: "Varies", officialUrl: "https://www.myntra.com/", instructions: ["Check Myntra's youth / student offers"] },
  { title: "PUMA Student", description: "Student discount", provider: "PUMA", category: "👕 Fashion & Sneakers", discount: "Varies", officialUrl: "https://in.puma.com/", instructions: ["Verify student status on PUMA"] },
  { title: "Adidas Student", description: "Student discount", provider: "Adidas", category: "👕 Fashion & Sneakers", discount: "Varies", officialUrl: "https://www.adidas.co.in/", instructions: ["Verify student status via UNiDAYS"] },
  { title: "Nike Student", description: "Student discount", provider: "Nike", category: "👕 Fashion & Sneakers", discount: "Varies", officialUrl: "https://www.nike.com/in/", instructions: ["Verify student status via UNiDAYS"] },
  { title: "Crocs Student", description: "Student discount", provider: "Crocs", category: "👕 Fashion & Sneakers", discount: "Varies", officialUrl: "https://www.crocs.in/", instructions: ["Check student beans or UNiDAYS for Crocs"] },
  { title: "Converse Student", description: "Student offers", provider: "Converse", category: "👕 Fashion & Sneakers", discount: "Varies", officialUrl: "https://www.converse.in/", instructions: ["Check for student offers on the site"] },
  { title: "Levi's Student", description: "Student offer", provider: "Levi's", category: "👕 Fashion & Sneakers", discount: "Varies", officialUrl: "https://levi.in/", instructions: ["Verify through UNiDAYS or Student Beans"] },
  { title: "ASOS Student", description: "Student discount", provider: "ASOS", category: "👕 Fashion & Sneakers", discount: "10% Off", officialUrl: "https://www.asos.com/", instructions: ["Verify via UNiDAYS for 10% off till you graduate"] },

  // Food & Delivery
  { title: "Swiggy Student", description: "Student-exclusive offers", provider: "Swiggy", category: "🍔 Food & Delivery", discount: "Varies", officialUrl: "https://www.swiggy.com/", instructions: ["Check Swiggy app for campus offers"] },
  { title: "Zomato Student", description: "Student/promotional offers", provider: "Zomato", category: "🍔 Food & Delivery", discount: "Varies", officialUrl: "https://www.zomato.com/", instructions: ["Check Zomato app for university specific promos"] },
  { title: "Starbucks Student", description: "Student offers", provider: "Starbucks", category: "🍔 Food & Delivery", discount: "Varies", officialUrl: "https://www.starbucks.in/", instructions: ["Check UNiDAYS for Starbucks offers"] },
  { title: "Domino's Student", description: "Student/promotional deals", provider: "Domino's", category: "🍔 Food & Delivery", discount: "Varies", officialUrl: "https://www.dominos.co.in/", instructions: ["Look for Everyday Value Offers or student discounts"] },
  { title: "Pizza Hut Student", description: "Student/promotional deals", provider: "Pizza Hut", category: "🍔 Food & Delivery", discount: "Varies", officialUrl: "https://www.pizzahut.co.in/", instructions: ["Check for college offers on the app"] },
  { title: "McDonald's Student", description: "Student/local offers", provider: "McDonald's", category: "🍔 Food & Delivery", discount: "Varies", officialUrl: "https://mcdonaldsindia.com/", instructions: ["Check McDonald's app for current deals"] },
  { title: "Subway Student", description: "Student/local offers", provider: "Subway", category: "🍔 Food & Delivery", discount: "Varies", officialUrl: "https://www.subway.com/en-IN", instructions: ["Check local store for student ID concessions"] },

  // Education & Learning
  { title: "Coursera Student", description: "Student/education offers", provider: "Coursera", category: "📚 Education & Learning", discount: "Free Course Access", officialUrl: "https://www.coursera.org/", instructions: ["Join Coursera for Campus with student email"] },
  { title: "Udemy Student", description: "Student discounts/promotions", provider: "Udemy", category: "📚 Education & Learning", discount: "Varies", officialUrl: "https://www.udemy.com/", instructions: ["Check for new student promotional prices"] },
  { title: "Skillshare Student", description: "Student offers", provider: "Skillshare", category: "📚 Education & Learning", discount: "Varies", officialUrl: "https://www.skillshare.com/", instructions: ["Verify student status for premium access offers"] },
  { title: "DataCamp Student", description: "Student pricing", provider: "DataCamp", category: "📚 Education & Learning", discount: "Student Pricing", officialUrl: "https://www.datacamp.com/", instructions: ["Available free via GitHub Student Developer Pack"] },
  { title: "Quizlet Student", description: "Student pricing", provider: "Quizlet", category: "📚 Education & Learning", discount: "Varies", officialUrl: "https://quizlet.com/", instructions: ["Check for student plan prices"] },
  { title: "Wolfram Alpha Student", description: "Student pricing", provider: "Wolfram Alpha", category: "📚 Education & Learning", discount: "Special Rate", officialUrl: "https://www.wolframalpha.com/", instructions: ["Sign up with a student email for Pro discount"] },
  { title: "MATLAB Student", description: "Student license", provider: "MathWorks", category: "📚 Education & Learning", discount: "Student License Rate", officialUrl: "https://www.mathworks.com/academia/students.html", instructions: ["Purchase student suite"] },
  { title: "Overleaf Student", description: "Student/education access", provider: "Overleaf", category: "📚 Education & Learning", discount: "Varies", officialUrl: "https://www.overleaf.com/", instructions: ["Check if your university provides premium Overleaf access"] },
  { title: "Rosetta Stone Student", description: "Student discount", provider: "Rosetta Stone", category: "📚 Education & Learning", discount: "Varies", officialUrl: "https://www.rosettastone.com/", instructions: ["Check student discount programs"] },

  // Fitness & Wellness
  { title: "Cult.fit Student", description: "Student/partner offers", provider: "Cult.fit", category: "🏋️ Fitness & Wellness", discount: "Varies", officialUrl: "https://www.cult.fit/", instructions: ["Check for campus special memberships"] },
  { title: "Strava Student", description: "Student pricing", provider: "Strava", category: "🏋️ Fitness & Wellness", discount: "50% Off", officialUrl: "https://www.strava.com/", instructions: ["Verify student status on Strava"] },
  { title: "Nike Training Club", description: "Free", provider: "Nike", category: "🏋️ Fitness & Wellness", discount: "100% Free", officialUrl: "https://www.nike.com/ntc-app", instructions: ["Download the app and sign in"] },
  { title: "Adidas Training", description: "Free", provider: "Adidas", category: "🏋️ Fitness & Wellness", discount: "100% Free", officialUrl: "https://www.adidas.com/", instructions: ["Download the app"] },
  { title: "Headspace Student", description: "Student pricing", provider: "Headspace", category: "🏋️ Fitness & Wellness", discount: "85% Off", officialUrl: "https://www.headspace.com/", instructions: ["Verify with SheerID for student plan"] },
  { title: "Calm Student", description: "Student offers", provider: "Calm", category: "🏋️ Fitness & Wellness", discount: "Varies", officialUrl: "https://www.calm.com/", instructions: ["Check for student plan options"] },

  // Beauty & Personal Care
  { title: "MAC Cosmetics Student", description: "Up to 15% Off", provider: "MAC Cosmetics", category: "🧴 Beauty & Personal Care", discount: "Up to 15% Off", officialUrl: "https://www.maccosmetics.in/", instructions: ["Verify student status on UNiDAYS"] },
  { title: "Nykaa Student", description: "Student/promotional offers", provider: "Nykaa", category: "🧴 Beauty & Personal Care", discount: "Varies", officialUrl: "https://www.nykaa.com/", instructions: ["Check UNiDAYS or app offers"] },
  { title: "Sephora India Student", description: "Student/promotional offers", provider: "Sephora India", category: "🧴 Beauty & Personal Care", discount: "Varies", officialUrl: "https://sephora.in/", instructions: ["Check UNiDAYS or store offers"] },
  { title: "iHerb Student", description: "Student offers", provider: "iHerb", category: "🧴 Beauty & Personal Care", discount: "Varies", officialUrl: "https://www.iherb.com/", instructions: ["Check for student promotional codes"] },
  { title: "Apollo Pharmacy Student", description: "Student/member offers", provider: "Apollo Pharmacy", category: "🧴 Beauty & Personal Care", discount: "Varies", officialUrl: "https://www.apollopharmacy.in/", instructions: ["Ask for member/student offers at store"] }
];

const seedFile = path.join(__dirname, 'seedPerks.js');
let code = fs.readFileSync(seedFile, 'utf8');

// We will append to the initialPerks array just before `];`
const closingBracketIndex = code.lastIndexOf('];');
if (closingBracketIndex === -1) {
    console.error("Could not find end of initialPerks array");
    process.exit(1);
}

// Generate the string to insert
let insertString = "";
// Get current titles to avoid duplicates (case insensitive)
const currentTitles = [...code.matchAll(/title:\s*"([^"]+)"/g)].map(m => m[1].toLowerCase());

let nextId = 15; // Started with 14 previously

for (const perk of newPerks) {
    // Basic deduplication
    if (currentTitles.some(t => t.includes(perk.provider.toLowerCase()))) {
        console.log(`Skipping ${perk.title}, provider ${perk.provider} might already exist.`);
        continue;
    }
    
    // Convert to js object string
    insertString += `,\n    {\n`;
    insertString += `      title: "${perk.title}", description: "${perk.description}", provider: "${perk.provider}", category: "${perk.category}", discount: "${perk.discount}",\n`;
    // Fallback icons
    let icon = "https://cdn-icons-png.flaticon.com/512/882/882730.png";
    if(perk.category.includes("Electronics")) icon = "https://cdn-icons-png.flaticon.com/512/3655/3655554.png";
    if(perk.category.includes("Fashion")) icon = "https://cdn-icons-png.flaticon.com/512/3159/3159613.png";
    if(perk.category.includes("Food")) icon = "https://cdn-icons-png.flaticon.com/512/706/706195.png";
    if(perk.category.includes("Education")) icon = "https://cdn-icons-png.flaticon.com/512/3413/3413535.png";
    if(perk.category.includes("Fitness")) icon = "https://cdn-icons-png.flaticon.com/512/2964/2964514.png";
    if(perk.category.includes("Beauty")) icon = "https://cdn-icons-png.flaticon.com/512/1940/1940964.png";
    if(perk.category.includes("Tech")) icon = "https://cdn-icons-png.flaticon.com/512/1005/1005141.png";
    if(perk.category.includes("Travel")) icon = "https://cdn-icons-png.flaticon.com/512/3125/3125713.png";
    
    insertString += `      icon: "${icon}", officialUrl: "${perk.officialUrl}",\n`;
    insertString += `      instructions: ${JSON.stringify(perk.instructions)},\n`;
    insertString += `      color: "#14B8A6", source: "manual", sourceId: "${nextId}", deduplicationKey: "manual::${perk.provider.toLowerCase().replace(/[^a-z0-9]/g, '')}_${perk.title.toLowerCase().replace(/[^a-z0-9]/g, '')}"\n`;
    insertString += `    }`;
    nextId++;
}

const newCode = code.slice(0, closingBracketIndex) + insertString + "\n  " + code.slice(closingBracketIndex);

fs.writeFileSync(seedFile, newCode);
console.log("Successfully appended new perks to seedPerks.js");

