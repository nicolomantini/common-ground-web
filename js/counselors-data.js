// Counselor directory data.
// Edit this array to add, remove, or update counselors — the page rebuilds itself from it.
//
// Optional `photo` field: set it to a path like "images/maya-ortiz.jpg" to show a real
// photo. Leave it out (or set to null) to show a generic placeholder avatar instead.
//
// `location` is a plain "City, ST" string shown on the card and searchable in the search box.
// `languages` powers both the language filter dropdown and each counselor's language tag —
// add a new language to any counselor's array and it automatically appears as a filter option.
// `website` (optional) is a full URL shown as a link in the expanded card. Leave it out
// (or set to null) to hide the link.
const COUNSELORS = [
  {
    id: "ortiz-maya",
    website: "https://mayaortizcounseling.example.com",
    name: "Maya Ortiz",
    photo: null, // e.g. "images/maya-ortiz.jpg"
    credentials: "LMFT",
    pronouns: "she/her",
    location: "Austin, TX",
    specialties: ["Anxiety", "Relationships"],
    approach: ["CBT", "Emotionally Focused"],
    formats: ["Video", "In-person"],
    languages: ["English", "Spanish"],
    sessionLength: "50 min",
    priceRange: "$$",
    availability: "Accepting new clients",
    seed: 1,
    bio: "Maya works with people who feel like their anxious thoughts are running the show. She's direct, warm, and big on practical tools you can use between sessions — not just talk.",
    focus: "Helps clients build a calmer relationship with worry, and works with couples navigating conflict or disconnection."
  },
  {
    id: "fisher-dwayne",
    website: "https://dwaynefishertherapy.example.com",
    name: "Dwayne Fisher",
    credentials: "LCSW",
    photo: "images/nico.jpg"
    pronouns: "he/him",
    location: "Colorado Springs, CO",
    specialties: ["Trauma", "Veterans"],
    approach: ["EMDR", "Somatic"],
    formats: ["Video", "Phone"],
    languages: ["English"],
    sessionLength: "50 min",
    priceRange: "$$",
    availability: "1 opening this month",
    seed: 2,
    bio: "Dwayne is a former Army medic who now specializes in trauma recovery, with a particular focus on veterans and first responders. Sessions are steady, unhurried, and grounded in the body as much as the mind.",
    focus: "Works with PTSD, combat trauma, and the friction of returning to civilian life."
  },
  {
    id: "nair-priya",
    website: "https://priyanairphd.example.com",
    name: "Priya Nair",
    credentials: "PhD, Psychologist",
    pronouns: "she/her",
    location: "San Francisco, CA",
    specialties: ["Couples", "Family"],
    approach: ["Gottman Method", "Systemic"],
    formats: ["Video", "In-person"],
    languages: ["English", "Hindi"],
    sessionLength: "60 min",
    priceRange: "$$$",
    availability: "Accepting new clients",
    seed: 3,
    bio: "Priya has spent fifteen years helping couples and families untangle the same argument they keep having. She's known for asking the question nobody else in the room wants to ask.",
    focus: "Especially experienced with intercultural couples and multigenerational family friction."
  },
  {
    id: "okafor-sam",
    website: "https://samokaforcounseling.example.com",
    name: "Sam Okafor",
    credentials: "LPC",
    pronouns: "they/them",
    location: "Chicago, IL",
    specialties: ["Teens", "ADHD"],
    approach: ["CBT", "Strengths-based"],
    formats: ["Video"],
    languages: ["English"],
    sessionLength: "45 min",
    priceRange: "$",
    availability: "Accepting new clients",
    seed: 4,
    bio: "Sam works mostly with teenagers and young adults, and it shows — sessions feel more like a real conversation than a lecture. A lot of clients come in for ADHD and stay because they finally feel understood.",
    focus: "Comfortable working with school stress, executive function, and the general chaos of being a teenager right now."
  },
  {
    id: "voss-elena",
    website: "https://elenavosstherapy.example.com",
    name: "Elena Voss",
    credentials: "LCSW",
    pronouns: "she/her",
    location: "Portland, OR",
    specialties: ["Grief", "Life transitions"],
    approach: ["Narrative", "Person-centered"],
    formats: ["In-person"],
    languages: ["English", "German"],
    sessionLength: "50 min",
    priceRange: "$$",
    availability: "Waitlist",
    seed: 5,
    bio: "Elena's practice is built around the idea that grief doesn't move in a straight line, and that's fine. She sits with hard things well and rarely rushes toward silver linings.",
    focus: "Supports loss of a loved one, divorce, retirement, and other big life turns."
  },
  {
    id: "blake-jordan",
    website: "https://jordanblaketherapy.example.com",
    name: "Jordan Blake",
    credentials: "LMHC",
    pronouns: "they/them",
    location: "Seattle, WA",
    specialties: ["LGBTQ+ affirming", "Identity"],
    approach: ["Person-centered", "ACT"],
    formats: ["Video"],
    languages: ["English"],
    sessionLength: "50 min",
    priceRange: "$$",
    availability: "Accepting new clients",
    seed: 6,
    bio: "Jordan built their practice around one idea: you shouldn't have to explain the basics before you get to the actual work. Sessions are casual, sharp, and unmistakably affirming.",
    focus: "Works with identity, coming out at any age, and the anxiety that can come with either."
  },
  {
    id: "rivera-tomas",
    website: "https://tomasriveracounseling.example.com",
    name: "Tomás Rivera",
    credentials: "LPC",
    pronouns: "he/him",
    location: "Phoenix, AZ",
    specialties: ["Addiction recovery", "Men's issues"],
    approach: ["Motivational Interviewing", "CBT"],
    formats: ["Video", "Phone"],
    languages: ["English", "Spanish"],
    sessionLength: "50 min",
    priceRange: "$$",
    availability: "1 opening this month",
    seed: 7,
    bio: "Tomás is in long-term recovery himself, and it shapes how he shows up: no lectures, no shame, a lot of straight talk. Many clients find him easier to open up to than they expected.",
    focus: "Works with substance use recovery and the men who've been told their whole life not to talk about any of this."
  },
  {
    id: "chen-naomi",
    website: "https://naomichenpsyd.example.com",
    name: "Naomi Chen",
    credentials: "PsyD",
    pronouns: "she/her",
    location: "New York, NY",
    specialties: ["Career stress", "Burnout"],
    approach: ["CBT", "Acceptance-based"],
    formats: ["Video"],
    languages: ["English", "Mandarin"],
    sessionLength: "50 min",
    priceRange: "$$$",
    availability: "Accepting new clients",
    seed: 8,
    bio: "Naomi works mostly with high-achievers who are quietly running on empty — the ones who look fine on paper. She's a former management consultant, so the 'just relax' advice doesn't come up much.",
    focus: "Focuses on burnout, perfectionism, and career-stage transitions."
  }
];
