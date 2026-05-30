/**
 * ItsPosting — Industry Knowledge Base
 * backend/data/industryKnowledge.js
 *
 * This file is the brain behind every AI-generated post.
 * It gets injected into the Claude system prompt for every generation call.
 * The richer this data, the better and more specific every post becomes.
 *
 * Structure per industry:
 * - customerPainPoints: Real problems homeowners face (15+)
 * - seasonalContent: Month-by-month urgency, tips, and promotion angles
 * - contentThemes: Types of posts that work for this industry
 * - trustSignals: Credibility phrases that build confidence
 * - localKeywords: Location-aware phrases for local SEO
 * - hookFormulas: 10 proven opening lines to stop the scroll
 * - ctaVariations: 8 CTAs ranging from soft to hard
 */

const industryKnowledge = {

  // ============================================================
  // PLUMBING
  // ============================================================
  plumbing: {

    customerPainPoints: [
      // Emergency — immediate panic
      'Woke up at 2am to water pouring through the kitchen ceiling',
      'Pipe burst inside the wall — water spreading across the basement floor',
      'Sewer backing up into the bathtub — cannot use any water in the house',
      'Toilet overflowed and flooded the bathroom — soaked through the subfloor',
      'Sump pump failed during a storm — basement has 4 inches of water',
      // Financial fear
      'Water bill tripled with no explanation — something is leaking somewhere',
      'Dripping faucet ignored for a year — now terrified of the cumulative cost',
      'Running toilet wasting hundreds of gallons — water company flagged the account',
      // Chronic frustration
      'Every drain in the house runs slow — shower pools around the feet',
      'Hot water only lasts 5 minutes — family of 4 fighting over showers every morning',
      'Low water pressure throughout the house — barely enough to rinse dishes',
      'Water heater making loud popping and rumbling sounds every morning',
      'Sewage smell from the drains — comes and goes for months',
      'Brown or rust-colored water when the tap is first turned on',
      // Knowledge gap and fear
      'Toilet keeps backing up no matter how much we plunge it',
      'Water stain spreading on the ceiling — no idea which pipe is leaking above',
      'Old galvanized pipes throughout — no idea if water is safe to drink',
      'Garbage disposal stopped working — humming sound but nothing moves',
      'Hearing water running inside the wall when nothing is turned on',
      // Seasonal
      'Pipes freeze every winter — terrified one will burst this year',
      'Hose bib leaking after the winter thaw',
      'Irrigation system not turning on after winter shutdown',
      // Trust and quality
      'Previous plumber fixed the leak but it came back 3 months later',
      'Got three quotes and all wildly different — no idea who to trust',
    ],

    tradeTerminology: [
      'hydro-jetting', 'rooter service', 'slab leak', 'repiping', 'water hammer',
      'PEX tubing', 'copper sweating', 'backflow preventer', 'PRV (pressure reducing valve)',
      'tankless water heater', 'expansion tank', 'wax ring', 'p-trap', 'main line cleanout',
      'frost-free hose bib', 'sump pit', 'flapper valve', 'fill valve', 'thermal expansion',
      'hard water scale buildup', 'galvanized corrosion', 'push-fit fittings',
      'pressure test', 'rough-in plumbing', 'drain slope', 'venting stack',
    ],

    contentAngles: [
      {
        angle: 'flushable_wipes_myth',
        hook: 'We pulled this out of a main line last week. The bag said "flushable."',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Challenges a belief most homeowners hold — creates immediate sharing and comments',
      },
      {
        angle: 'water_bill_detective',
        hook: 'Your water bill jumped $80 this month. Here are the 4 most likely culprits — and how to find them tonight.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Financial pain is relatable and urgent — homeowners immediately wonder if this applies to them',
      },
      {
        angle: 'emergency_prevention',
        hook: 'Every [city] homeowner needs to know exactly where this is BEFORE 2am tonight.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Creates urgency without being salesy — genuinely useful safety information',
      },
      {
        angle: 'tankless_debate',
        hook: 'Is a tankless water heater actually worth it? Here is the honest answer after installing hundreds of both.',
        type: 'faq',
        engagementLevel: 'high',
        why: 'Hot topic homeowners research constantly — positions as trusted expert',
      },
      {
        angle: 'water_heater_age',
        hook: 'How old is your water heater? Type the number in the comments. Here is what your answer means.',
        type: 'engagement',
        engagementLevel: 'very_high',
        why: 'Direct engagement prompt — easy to answer, creates conversations, generates leads',
      },
      {
        angle: 'slab_leak_warning',
        hook: 'Hearing water running when nothing is turned on? Stop what you are doing and read this.',
        type: 'seasonal_warning',
        engagementLevel: 'high',
        why: 'Creates fear of a very expensive problem — high-stakes content that gets saved and shared',
      },
      {
        angle: 'job_reveal',
        hook: 'What we found behind this wall in [city] yesterday. The homeowner had no idea.',
        type: 'before_after',
        engagementLevel: 'very_high',
        why: 'Real job reveals are the most authentic content — curiosity-driven, builds credibility',
      },
      {
        angle: 'diy_warning',
        hook: 'We were called in to fix this after a homeowner tried YouTube. Here is what happened.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Not anti-DIY shaming — genuinely shows consequences and builds professional value',
      },
      {
        angle: 'water_quality',
        hook: 'Hard water is silently destroying 4 things in your home right now — and most homeowners have no idea.',
        type: 'educational',
        engagementLevel: 'medium_high',
        why: 'Invisible problem that homeowners do not think about — eye-opening and shareable',
      },
      {
        angle: 'team_story',
        hook: 'Called at 6am on a Sunday. Family of 5. No water. Here is how the morning went.',
        type: 'team_spotlight',
        engagementLevel: 'high',
        why: 'Human story — shows the service-first culture and builds emotional connection',
      },
    ],

    faqPairs: [
      { q: 'How long does a water heater last?', a: 'Traditional tank: 8-12 years. Tankless: 20+ years with proper maintenance. If yours is over 10 years old and showing signs of trouble — repair bills are money better spent on a replacement.' },
      { q: 'Can I flush "flushable" wipes?', a: 'No. Every plumber will tell you the same thing — they do not break down in pipes the way toilet paper does. We pull them out of main lines every single week. Bin, not toilet.' },
      { q: 'Why does my water pressure suddenly drop?', a: 'Four common causes: failing PRV (pressure reducing valve), partially closed shutoff valve, corroded galvanized pipes restricting flow, or a hidden leak stealing pressure. Most are a simple fix.' },
      { q: 'When should I repair vs. replace my water heater?', a: 'Under 7 years old and one failed part — repair. Over 10 years, multiple repairs, or rust in the water — replace. Continuing to repair an old heater is throwing money at a problem you will face anyway.' },
      { q: 'What causes that banging sound in my pipes?', a: 'Water hammer — the pressure shock when water flow is suddenly stopped. It stresses pipe joints over time. A water hammer arrestor costs about $30 and installs in minutes. Worth doing before it causes a leak.' },
      { q: 'Why does my drain smell like sewage?', a: 'Three causes: dry p-trap (pour a cup of water in drains you rarely use), cracked vent stack (needs a plumber), or main line partial blockage holding gas. The last one is the only one that is urgent.' },
      { q: 'Is it worth getting a tankless water heater?', a: 'If your household uses over 40 gallons of hot water daily, yes — you will recoup the cost in energy savings within 5-6 years and never run out of hot water again. Smaller households: the math is tighter.' },
      { q: 'My water bill doubled. What should I check first?', a: 'In order: (1) Lift the toilet tank lid — listen for running. (2) Check the water meter, wait 2 hours without using water, check again. If it moved, you have a leak. (3) Call us — we find hidden leaks in 30 minutes.' },
    ],

    seasonalContent: {
      1: {
        urgencyTopic: 'Burst pipe season — temperatures below 20°F crack pipes in walls, attics, and crawlspaces',
        tipTopic: 'The 3-step frozen pipe protocol — what to do in the first 10 minutes before the plumber arrives',
        promotionAngle: 'Free pipe vulnerability assessment with any January service call',
        emotionalContext: 'Homeowners are scared — one burst pipe can cause $15,000+ in water damage. They want to feel protected, not sold to.',
        postIdea: 'Share a real burst pipe job from this week: the 2am call, the water damage found, the fix, and what the homeowner could have done to prevent it',
        engagementHook: 'Ask: "Does every adult in your house know where the main water shutoff is?" — always generates comments and saves',
      },
      2: {
        urgencyTopic: 'Late winter pipe failures — freeze damage from January shows up as leaks in February when pipes thaw',
        tipTopic: 'How to spot freeze damage before it becomes a flood — 5 warning signs after a cold snap',
        promotionAngle: 'Winter plumbing safety inspection — catch January damage before the spring thaw makes it worse',
        emotionalContext: 'The fear shifts from "preventing" to "did something already break?" — inspection-driven content works well',
        postIdea: 'Post about the hidden damage found during a post-freeze inspection — cracks in pipe insulation, stress fractures that have not fully burst yet',
        engagementHook: 'Ask: "Had any burst pipes this winter?" — creates community discussion and organic referrals',
      },
      3: {
        urgencyTopic: 'Spring thaw inspection — pipes that survived winter may have micro-cracks that show up as leaks in March',
        tipTopic: 'How to test your sump pump before April rains arrive — the 5-minute bucket test',
        promotionAngle: 'Spring plumbing inspection package — check everything before the ground thaws and rains start',
        emotionalContext: 'Relief after winter, but smart homeowners know spring is when winter damage reveals itself',
        postIdea: 'Show a sump pump that was not tested and failed during the first spring storm — dramatic basement flooding story',
        engagementHook: 'Ask: "Have you tested your sump pump yet this spring?" — creates urgency and drives service bookings',
      },
      4: {
        urgencyTopic: 'Sump pump season peak — April is the highest-risk month for basement flooding',
        tipTopic: 'How to test your sump pump in 5 minutes — before the storm that actually needs it',
        promotionAngle: 'Sump pump tune-up and battery backup installation special — April only',
        emotionalContext: 'Spring rain anxiety — homeowners with basements are watching the forecast nervously',
        postIdea: 'Post about installing a battery backup sump pump — the customer who had one and kept a dry basement when power went out during a storm vs. neighbors who flooded',
        engagementHook: 'Ask: "Does your sump pump have a battery backup?" — most do not, drives immediate action',
      },
      5: {
        urgencyTopic: 'Outdoor plumbing startup — irrigation systems, hose bibs, and outdoor faucets awakening after winter',
        tipTopic: 'How to properly open your outdoor water lines after winter without cracking fittings',
        promotionAngle: 'Outdoor plumbing startup package — irrigation startup, hose bib inspection, and leak check',
        emotionalContext: 'Excitement about outdoor season — homeowners want to use their yard, garden, and outdoor features',
        postIdea: 'Show a frost-free hose bib that failed because it was improperly installed — water leaked into the wall for months before being discovered',
        engagementHook: 'Ask: "What is the first outdoor plumbing thing you turn on every spring?" — seasonal conversation starter',
      },
      6: {
        urgencyTopic: 'Water heater performance check — summer demand spikes from increased showering and dishwashing',
        tipTopic: 'Signs your water heater is about to fail — and why summer is the worst time to find out',
        promotionAngle: 'Water heater flush and inspection special — extend its life and improve efficiency',
        emotionalContext: 'Vacation planning — a failed water heater with guests coming ruins summers',
        postIdea: 'Post about the water heater that failed the week before a family had 10 guests for a holiday — the emergency replacement and why annual flushes matter',
        engagementHook: 'Ask: "When did you last have your water heater flushed?" — most homeowners have never done it',
      },
      7: {
        urgencyTopic: 'Hidden leak detection — summer water bills reveal slow leaks that have been running all season',
        tipTopic: 'How to check for hidden leaks using just your water meter — a 2-hour test anyone can do',
        promotionAngle: 'Summer leak detection special — we find leaks before they become water damage',
        emotionalContext: 'Shock at high water bills — summer usage is high but a $400 bill triggers action',
        postIdea: 'Share a hidden irrigation leak story — running underground for 3 months, $600 in wasted water, and why the homeowner had no idea',
        engagementHook: 'Ask: "Has your water bill been higher than usual this summer?" — directly identifies prospects',
      },
      8: {
        urgencyTopic: 'Back-to-school plumbing prep — increased household demand returning after summer',
        tipTopic: 'Why September is a great time to flush your water heater and check your whole-home pressure',
        promotionAngle: 'Fall plumbing readiness inspection — before the busy season',
        emotionalContext: 'Back-to-routine mindset — families are in "get things done" mode before fall',
        postIdea: 'Post an educational piece on home water pressure — what normal is (40-80 PSI), what too high does to pipes, and how a PRV prevents it',
        engagementHook: 'Ask: "Do you know your home water pressure?" — almost no one does, drives curiosity',
      },
      9: {
        urgencyTopic: 'Outdoor plumbing winterization begins — outdoor faucets and irrigation lines must be drained before first freeze',
        tipTopic: 'How to properly winterize your outdoor faucets — the right way vs. the way that causes spring leaks',
        promotionAngle: 'Early winterization special — book before the October rush',
        emotionalContext: 'The first cold nights trigger action — homeowners remember last year and do not want a repeat',
        postIdea: 'Post about the homeowner who thought they winterized their irrigation but left one zone active — $3,000 in yard and valve repairs',
        engagementHook: 'Ask: "Do you winterize your own outdoor plumbing or hire someone?" — identifies DIY vs. service market',
      },
      10: {
        urgencyTopic: 'Pre-freeze deadline — October is the last safe month for outdoor plumbing winterization in most climates',
        tipTopic: 'The 5-step outdoor plumbing winterization checklist — do this before the first hard freeze',
        promotionAngle: 'October winterization special — protect your pipes before it is too late this year',
        emotionalContext: 'Deadline urgency — first freeze could be any night, creating genuine time pressure',
        postIdea: 'Create a winterization checklist post — irrigation blowout, hose bib insulation, pool plumbing, outdoor shower. Make it saveable.',
        engagementHook: 'Ask: "Has anyone had pipes freeze before they were winterized?" — drives urgent action from comments',
      },
      11: {
        urgencyTopic: 'Holiday guest plumbing prep — water heater capacity, toilet reliability, and extra shower demand',
        tipTopic: 'How to flush your water heater before Thanksgiving to ensure peak performance for guests',
        promotionAngle: 'Pre-holiday plumbing prep package — water heater flush, toilet tune-up, and main valve check',
        emotionalContext: 'No one wants a plumbing failure with a house full of family — high motivation to be proactive',
        postIdea: 'Post about a Thanksgiving toilet failure (the classic clogged toilet with 12 guests story) — how it could have been prevented and the 30-min fix',
        engagementHook: 'Ask: "Have you ever had a plumbing disaster during a holiday with guests?" — always gets embarrassing and funny stories',
      },
      12: {
        urgencyTopic: 'Holiday emergency plumbing — burst pipes and no-hot-water calls peak during Christmas and New Year',
        tipTopic: 'What to do if a pipe bursts over the holidays — the 4-step damage-control protocol before we arrive',
        promotionAngle: '24/7 holiday emergency plumbing — we never close, no holiday surcharge',
        emotionalContext: 'Fear of holiday disruption — families rely on plumbing most when hosting; a failure is catastrophic',
        postIdea: 'Share the story of a holiday emergency call — the chaos, the fix, the grateful family — show that you are there when others are not',
        engagementHook: 'Remind followers: "Save our number before you need it" — simple but drives profile saves',
      },
    },

    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],

    trustSignals: [
      'State-licensed master plumber — license number available on request',
      'Fully insured — $1M liability, workers comp on every tech',
      'Background-checked technicians — we are in your home, that matters',
      'Upfront flat-rate pricing — you see the price before we touch anything',
      'Same-day emergency service — not "as soon as possible," same day',
      'No overtime charges — our emergency rate is our regular rate',
      'Family-owned and operated since [year] — [city] is our community too',
      'Over [X] five-star Google reviews from [city] homeowners',
      'We guarantee our work in writing — return visit free if it comes back',
      '24/7 emergency line — a real plumber answers, not an answering service',
      'Clean-up included — we leave your home the way we found it',
      'Free estimates on all non-emergency work — no trip charge to quote',
    ],

    localKeywords: [
      '[city] plumber',
      '[city] plumbing company',
      'emergency plumber [city]',
      'plumber near me [city]',
      '[city] water heater repair',
      'drain cleaning [city]',
      'sump pump repair [city]',
      'pipe repair [city]',
      '[city] leak detection',
      'toilet repair [city]',
      'serving [neighborhood] and [city] homeowners',
    ],

    hookFormulas: [
      // Shocking stat
      'A running toilet wastes up to 200 gallons of water per day. That is $70/month you are flushing away. 🚽',
      // Myth-bust
      'Those "flushable" wipes are not flushable. We pull them out of main lines every single week. Here is what they do to your pipes.',
      // Financial fear
      'If your water bill jumped this month, there is a 60% chance you have a hidden leak — and it is getting worse every day.',
      // Urgency + location
      'With temperatures dropping below 20°F in [city] tonight, your pipes are at risk. Here is what to do right now.',
      // Job story
      'Called at 2am. Burst pipe. Water spreading across the basement floor. Here is how the next 3 hours went.',
      // Challenge a belief
      'Most homeowners do not realize a water heater over 10 years old is not a "repair or replace" question anymore — it is just replace.',
      // Local social proof
      'We just helped a [city] homeowner avoid $18,000 in water damage. Here is the one thing they did right.',
      // Engagement question
      'Quick question for [city] homeowners: does every adult in your house know where the main water shutoff is?',
      // Curiosity gap
      'What we found inside this wall yesterday. The homeowner had no idea this was happening for 3 years.',
      // Pro tip (authority)
      'Pro tip from [X] years under sinks and inside walls: this one $12 part prevents the most common water heater failure.',
      // Seasonal urgency
      'October reminder: if you have not winterized your outdoor faucets yet — tonight might be the last safe night.',
      // Fear of delay
      'The dripping faucet you have been ignoring? Here is the math on what 3 months of ignoring it actually costs.',
      // Before/after tease
      'Before and after from this morning in [city] — 40-year-old galvanized pipes removed, full repipe complete. 🔧',
      // Educational hook
      'Your water pressure should be between 40-80 PSI. Higher than that, and it is silently destroying your pipes and appliances every day.',
      // Team/human story
      'Sunday 6am. Family of 5. No water. Sewer line collapsed. Here is what the day looked like for our crew.',
    ],

    ctaVariations: [
      'Save this post — you will want it the next time something goes wrong 🔖',
      'Tag a homeowner who needs to see this',
      'Comment with your plumbing question — we personally answer every one',
      'Drop a 🚰 if you have dealt with this exact problem',
      'Call [phone] — free estimate, upfront pricing, same day',
      'Book online — link in bio — we confirm within the hour',
      'DM us a description of your problem and we will tell you exactly what it is and what it costs',
      'Call [phone] now — same-day appointments available in [city]',
      'Save our number before you need it at 2am',
      'Comment "LEAK" and we will DM you our free hidden-leak detection guide',
    ],

    imageVisuals: {
      keyElements: [
        'copper and blue PEX pipes side-by-side showing trade materials',
        'pipe wrench gripping a fitting — hands visible, not posed',
        'soldering torch with visible blue flame on copper joint',
        'under-sink cabinet open with plumber working — headlamp on, tools laid out',
        'water heater with pipe connections, relief valve, and drain hose',
        'p-trap and drain assembly under bathroom sink',
        'main water shutoff valve — isolation valve with handle',
        'sump pump sitting in concrete pit with float visible',
        'before/after pipe comparison — corroded galvanized vs. bright copper or PEX',
        'hydro-jet hose going into a cleanout — high-pressure drain cleaning in action',
      ],
      authenticScenes: [
        'plumber crouching under kitchen sink — headlamp on, wrenches out, focused expression',
        'wall opened to reveal pipe repair in progress — drywall cut back, plumber mid-installation',
        'water heater installation: technician connecting gas line and water lines, strapping in progress',
        'before/after split: flooded basement floor vs. dry basement after sump pump install',
        'ceiling drywall cut back showing the leak source found — before repair',
        'mainline hydro-jet cleaning — technician feeding hose into cleanout at foundation',
        'close-up of hands sweating a copper joint — torch and solder, journeyman-level craftsmanship',
        'new PEX repipe inside open walls before drywall — clean organized runs',
      ],
      avoidCliches: [
        'cartoon plumber with oversized wrench and overalls',
        'generic stock faucet on pure white background',
        'clipart toolbox or isolated tool illustrations',
        'overly clean staged bathroom with absolutely no work in progress',
        'person in suit pointing at pipes (business stock photo style)',
        'water droplet or dripping faucet abstract graphic',
      ],
      colorPalette: 'copper metallic warm tones, bright blue PEX tubing, white porcelain, chrome fittings, concrete gray, rust-orange corroded pipe for before shots',
      composition: 'close-up of skilled hands at work (authenticity and craftsmanship), over-the-shoulder POV of plumber mid-task, dramatic before/after split from identical camera position and distance',
      moodAndLighting: 'honest job-site lighting — not glamorous. Headlamp, utility light, or natural light from an open cabinet. Real tools, real materials, real technician. Not a studio shoot.',
      seasonalVisuals: {
        winter: 'frost-coated exterior hose bib, burst pipe aftermath — ice formation and water staining on concrete basement wall, pipe insulation foam being applied to vulnerable runs',
        spring: 'sump pump in active pit with water level visible, outdoor faucet being opened and tested after winter, wet crawlspace showing why spring inspection matters',
        summer: 'water heater with garden hose draining during flush, outdoor irrigation head being tested, meter reading in progress for leak detection',
        fall: 'foam insulation sleeve being wrapped around exterior pipe, hose bib shutoff under sink, winterization materials laid out: pipe wrap, shutoff tool, inspection checklist',
      },
    },
  },

  // ============================================================
  // HVAC
  // ============================================================
  hvac: {

    customerPainPoints: [
      // Emergency — immediate panic
      'AC stopped working at 10pm on the hottest day of July — house at 89 degrees with kids inside',
      'Furnace went out overnight — woke up to 58 degrees inside and pipes at risk',
      'Carbon monoxide detector going off near the furnace — evacuated the family',
      'AC running non-stop for 6 hours and house is still 82 degrees',
      'Heat pump blowing cold air in heat mode — no idea why',
      // Financial fear
      'Electric bill $400 this month — AC running but never reaching temperature',
      'System is 14 years old — scared to run it another summer without a breakdown',
      'Three repair calls in two years — spending more on repairs than a new system costs',
      // Chronic frustration
      'Bedroom always 5 degrees warmer than the rest of the house no matter what',
      'Humidity in the house is unbearable even when the AC is running',
      'Strange burning smell from vents when heat first kicks on every fall',
      'AC unit making loud banging or grinding sounds but still running',
      'Ice forming on the outdoor unit in summer — AC running but not cooling',
      'Thermostat set to 72 but house never gets below 76 on hot days',
      // Knowledge gap
      'Never had system serviced — not sure if it is safe or efficient',
      'R-22 refrigerant system and was told it is being phased out — panicking',
      'Ductwork in the attic leaking — paying to cool the attic not the house',
      'Air quality terrible — allergies worse since moving in despite new filters',
      // Trust
      'HVAC company quoted $8,000 for a new system — second quote was $4,500 — no idea who to trust',
      'Technician said the system needs refrigerant every year — that seems wrong',
    ],

    tradeTerminology: [
      'SEER rating', 'AFUE efficiency', 'R-410A refrigerant', 'R-32', 'tonnage', 'BTU',
      'heat pump', 'mini-split', 'ductless system', 'air handler', 'evaporator coil',
      'condenser coil', 'compressor', 'TXV valve', 'static pressure', 'MERV rating',
      'zoning system', 'two-stage compressor', 'variable speed blower', 'ECM motor',
      'emergency heat', 'aux heat strips', 'defrost cycle', 'refrigerant charge',
      'superheat and subcooling', 'airflow CFM', 'duct leakage', 'Manual J load calc',
    ],

    contentAngles: [
      {
        angle: 'dirty_filter_reveal',
        hook: 'We pulled this filter out of a [city] home last week. The homeowner changes it "every few months." This is what 4 months looks like.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Visual before/after is instant and relatable — every homeowner has guilt about their filter',
      },
      {
        angle: 'energy_bill_detective',
        hook: 'Your AC is running constantly but the house will not cool below 78. Here are the 4 most likely reasons — and what each one costs to fix.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Financial pain point — diagnoses a problem they are actively experiencing',
      },
      {
        angle: 'seer_savings_calculator',
        hook: 'Your 10-year-old AC is probably a 10 SEER system. A new 18 SEER unit cuts your cooling bill nearly in half. Here is the math.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Concrete financial ROI — makes the upgrade decision obvious',
      },
      {
        angle: 'heat_pump_debate',
        hook: 'Heat pump vs gas furnace for [city]? Here is the honest answer from a tech who installs both — and what we would put in our own home.',
        type: 'faq',
        engagementLevel: 'very_high',
        why: 'Hot debate homeowners research obsessively — positions as trusted neutral expert',
      },
      {
        angle: 'r22_phase_out',
        hook: 'If your AC system is over 10 years old, it probably uses R-22 refrigerant. Here is what that means for your wallet this summer.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Urgency for a large segment — R-22 is expensive and drives system replacements',
      },
      {
        angle: 'ac_not_cooling_diagnosis',
        hook: 'AC running but house not cooling? Stop calling it "broken." Here is what is actually happening and which one requires a technician.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Active problem — homeowner is frustrated right now and searching for answers',
      },
      {
        angle: 'carbon_monoxide_safety',
        hook: 'This is what a cracked heat exchanger looks like. And why it is the most dangerous thing we find in home HVAC inspections.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Safety fear — gets shared by parents especially',
      },
      {
        angle: 'thermostat_setting_tip',
        hook: 'The one thermostat setting that adds years to your AC and cuts your bill — most homeowners have no idea it exists.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Easy win — simple tip they can implement immediately, high save rate',
      },
      {
        angle: 'system_age_check',
        hook: 'How old is your HVAC system? Drop the year in the comments. Here is what each age range means for your risk this summer.',
        type: 'engagement',
        engagementLevel: 'very_high',
        why: 'Direct engagement — easy to answer, generates leads from older systems',
      },
      {
        angle: 'duct_leakage_reveal',
        hook: 'Up to 30% of the air you pay to cool leaks into your attic before reaching your rooms. Here is the test that reveals it.',
        type: 'educational',
        engagementLevel: 'medium_high',
        why: 'Hidden problem homeowners never consider — eye-opening and shareable',
      },
    ],

    faqPairs: [
      { q: 'How often should I change my AC filter?', a: 'Every 1-3 months depending on filter type, pets, and dust levels. The honest answer: more often than you think. A clogged filter is the #1 cause of reduced efficiency and system failures — and the easiest $15 fix you can do yourself.' },
      { q: 'When should I repair vs. replace my HVAC system?', a: 'The rule we use: if the repair cost is more than 50% of replacement cost, and the system is over 10 years old — replace. You are throwing money at a problem that gets worse every year. New systems are 40-60% more efficient than 12-year-old units.' },
      { q: 'What SEER rating should I buy?', a: 'At minimum a 16 SEER in most climates. 18+ SEER if you run your AC 5+ months a year. The payback on a higher SEER unit is usually 3-5 years in energy savings — and it qualifies for federal tax credits right now.' },
      { q: 'Why is my AC running but not cooling?', a: 'Four common causes: (1) dirty or frozen evaporator coil, (2) low refrigerant charge from a leak, (3) failing compressor, (4) ductwork leaking conditioned air into unconditioned spaces. We can diagnose in 30 minutes — two of these are simple fixes, two mean bigger conversations.' },
      { q: 'Should I get a heat pump or a gas furnace?', a: 'In mild climates (rarely below 25°F): heat pump wins on efficiency and operating cost. In cold climates with deep winter freezes: dual-fuel heat pump (heat pump + gas backup) is the best of both. Pure gas furnace still makes sense if gas is cheap in your area. We install all three — we will tell you honestly which fits your situation.' },
      { q: 'Why does my house have hot and cold spots?', a: 'Most often: ductwork issues (wrong sizing, leaks, or bad design), failing blower motor, or a system that is too large for the house. Oversized systems short-cycle and never run long enough to dehumidify. We can do a full airflow assessment and tell you exactly what is causing it.' },
      { q: 'Is it normal for my AC to need refrigerant every year?', a: 'No. Refrigerant does not get "used up." If you need a top-off every year, you have a leak. Adding refrigerant to a leaking system is a band-aid that costs money every summer. We find and fix the leak — one repair that lasts years instead of annual service calls.' },
      { q: 'What is emergency heat on my thermostat?', a: 'On a heat pump, emergency heat bypasses the heat pump and runs only the electric backup heat strips. It is much more expensive to run — typically 3x the operating cost. Use it only when the heat pump itself is broken, not as a comfort setting. If you find yourself switching to it regularly, call us.' },
    ],

    seasonalContent: {
      1: {
        urgencyTopic: 'Furnace failure peak — January is the highest-demand month for emergency heating calls',
        tipTopic: 'How to troubleshoot your furnace before the tech arrives — 5 things to check that fix 30% of no-heat calls',
        promotionAngle: 'Priority emergency heating service — we get there same day because we know January waits cost families their comfort and pipes',
        emotionalContext: 'Fear and discomfort — families are cold, pipes are at risk, and they feel helpless. They want someone who will actually show up same day.',
        postIdea: 'Share a real January no-heat emergency story: the late-night call, what you found (cracked heat exchanger, failed ignitor, locked compressor), the fix, and why regular fall tune-ups prevent most of these',
        engagementHook: 'Ask: "Has your furnace ever failed in winter? What happened?" — generates strong engagement and positions you as the emergency expert',
      },
      2: {
        urgencyTopic: 'Mid-winter system health check — dirty filters and neglected maintenance causing high bills and system stress',
        tipTopic: 'The mid-winter HVAC check that takes 10 minutes and could prevent a March breakdown',
        promotionAngle: 'February filter replacement and system check special — service now while we have availability',
        emotionalContext: 'Bill shock and fatigue — homeowners are tired of high energy bills and starting to wonder if something is wrong',
        postIdea: 'Show a before/after of a dirty filter that was installed "3 months ago" — the visual contrast drives immediate action and shares',
        engagementHook: 'Ask: "When did you last change your HVAC filter?" then reveal the dirty filter you pulled from a job this week — always generates responses',
      },
      3: {
        urgencyTopic: 'Pre-season AC startup check — service your AC now before 2-week wait times start in May',
        tipTopic: 'Spring AC startup checklist — what to check before you flip it on for the first time',
        promotionAngle: 'March AC tune-up special — our slowest month, so we have availability and better pricing',
        emotionalContext: 'Relief after winter — homeowners are optimistic, maintenance-minded, and motivated to "get things sorted out"',
        postIdea: 'Show the difference between an AC that was serviced last fall vs one that was not — coil condition, refrigerant charge, capacitor health — visual side-by-side',
        engagementHook: 'Ask: "Have you had your AC serviced this year?" with a poll — always high engagement in spring',
      },
      4: {
        urgencyTopic: 'AC tune-up prime season — service in April means guaranteed cool home in May before the heat hits',
        tipTopic: 'The one AC maintenance task that extends its life by 5+ years — most homeowners skip it',
        promotionAngle: 'April AC tune-up special — last chance for availability before summer rush fills our schedule',
        emotionalContext: 'Anticipation and mild urgency — homeowners feel motivated but not panicked. Perfect window for educational content that drives action.',
        postIdea: 'Post about a capacitor failure (the most common summer AC failure) — what it looks like, what it sounds like before it dies, and the $150 replacement vs $8,000 new system',
        engagementHook: 'Ask: "Is your AC ready for summer? Have you had it serviced in the last 12 months?" — generates appointments',
      },
      5: {
        urgencyTopic: 'Last chance for pre-summer AC service — schedules fill by Memorial Day',
        tipTopic: 'Five signs your AC will fail this summer if not serviced in May',
        promotionAngle: 'Pre-summer AC inspection — book before the rush and guarantee your comfort all season',
        emotionalContext: 'Growing urgency — first hot days hit and homeowners who ignored spring reminders feel the pressure now',
        postIdea: 'Show a condenser coil before cleaning (clogged with cottonwood, grass, etc.) vs after — the before is always shocking and relatable',
        engagementHook: 'Ask: "What is your AC horror story?" — always gets engagement and demonstrates that regular maintenance prevents disasters',
      },
      6: {
        urgencyTopic: 'Peak summer demand — AC failures happening daily, emergency calls at maximum',
        tipTopic: 'How to keep your home cool without overworking your AC during a heat wave',
        promotionAngle: 'Summer comfort guarantee — service within 24 hours for existing maintenance customers, 48 hours for new calls',
        emotionalContext: 'Heat wave panic — every degree over 80 inside makes homeowners more desperate and willing to spend. Real emergency season.',
        postIdea: 'Share a summer emergency call story — what you found (frozen coil, failed compressor, refrigerant leak), how you solved it, and what the homeowner paid to not have done maintenance',
        engagementHook: 'Ask: "What is your house temperature right now? Did your AC keep up with the heat today?" — highly active in summer heat',
      },
      7: {
        urgencyTopic: 'Mid-summer performance check — systems running 24/7 showing stress, efficiency dropping',
        tipTopic: 'Why your AC runs all day but never cools below 78 — and which causes are a $200 fix vs a $4,000 fix',
        promotionAngle: 'Summer efficiency audit — find out why your bill is high and your house is warm',
        emotionalContext: 'Frustration peak — homeowners have been fighting hot houses and high bills for weeks. They want diagnosis and answers.',
        postIdea: 'Post the SEER comparison — show actual energy cost per month for a 10 SEER vs 18 SEER system running in July heat. The financial difference is compelling.',
        engagementHook: 'Ask: "What is your electricity bill this month? We will tell you if that is normal for your system size" — generates leads with intent',
      },
      8: {
        urgencyTopic: 'End-of-summer HVAC prep — service now while schedule is open before fall rush',
        tipTopic: 'The late-summer HVAC maintenance checklist — set up both systems for the fall/winter season',
        promotionAngle: 'August dual-season tune-up — service AC post-summer AND furnace pre-fall in one visit',
        emotionalContext: 'Exhaustion from summer plus practical motivation — back-to-school energy drives home maintenance decisions',
        postIdea: 'Show what happens when an evaporator coil runs a full summer with poor maintenance — the buildup, the reduced airflow, the efficiency loss. Educational and visual.',
        engagementHook: 'Ask: "Are you ready to schedule your fall furnace tune-up?" — early scheduling content always converts in August',
      },
      9: {
        urgencyTopic: 'Fall furnace startup — service now before the first cold snap forces emergency calls',
        tipTopic: 'How to test your furnace before you actually need it — the 5-minute fall startup check',
        promotionAngle: 'Fall furnace tune-up special — be ready for winter, priced better than emergency calls',
        emotionalContext: 'Relief after summer but growing awareness of winter coming. Proactive homeowners take action now.',
        postIdea: 'Post about a furnace that was not serviced over summer and failed on the first cold day — what was found, what was missed, why a fall check would have caught it',
        engagementHook: 'Ask: "Has your furnace been serviced this year?" — high conversion in September when people are in planning mode',
      },
      10: {
        urgencyTopic: 'Heating season deadline — furnace inspection essential before temperatures drop to emergency levels',
        tipTopic: 'The fall HVAC checklist every homeowner needs before November',
        promotionAngle: 'October furnace inspection special — last availability before heating season demand spikes',
        emotionalContext: 'Real deadline — first frost is visible in the forecast and homeowners feel the deadline urgency',
        postIdea: 'Show a carbon monoxide safety check — the cracked heat exchanger you found during a fall inspection, why it matters, and what the homeowner avoided by booking in October vs January',
        engagementHook: 'Ask: "Is your furnace ready for winter? Did you know most furnace failures happen on the first really cold day?" — always drives fall bookings',
      },
      11: {
        urgencyTopic: 'Pre-holiday comfort guarantee — heating reliability with a house full of guests',
        tipTopic: 'Carbon monoxide safety: why fall is the most important time for a combustion safety check',
        promotionAngle: 'Pre-holiday HVAC check — guarantee your home is comfortable and safe for guests',
        emotionalContext: 'Hosting anxiety — no one wants their heat to fail with family visiting. Carbon monoxide fear is real and legitimate.',
        postIdea: 'Post about a CO detector that saved a family — what the technician found on a pre-holiday furnace check, the cracked heat exchanger, and why this story gets shared every year',
        engagementHook: 'Ask: "When did you last test your carbon monoxide detectors?" — safety content always gets shares',
      },
      12: {
        urgencyTopic: '24/7 holiday emergency heating — when furnaces fail on Christmas Eve',
        tipTopic: 'What to do when heat goes out on Christmas — the homeowner protocol before calling a tech',
        promotionAngle: '24/7 holiday emergency service — same rate, no holiday surcharge, we actually answer',
        emotionalContext: 'Holiday peak — failure during the holidays is a crisis. Families stranded in cold homes. Highest emotional impact of any service call.',
        postIdea: 'Share a December holiday emergency call story — the Christmas Eve no-heat call, the family, the fix, and the gratitude. This type of story gets incredible engagement and referrals.',
        engagementHook: 'Post: "Save our number. We answer on Christmas." — simple, gets saved, drives calls',
      },
    },

    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],

    trustSignals: [
      'NATE-certified HVAC technicians — the industry gold standard',
      'Licensed, bonded, and insured — $1M liability',
      'All major brands serviced: Carrier, Trane, Lennox, Goodman, Bryant, Rheem',
      'Manufacturer warranty honored on all new equipment installs',
      '100% satisfaction guarantee — we make it right',
      'Flat-rate pricing — you know the cost before we start',
      'Energy Star certified installations — qualify for federal tax credits',
      'Serving [city] homeowners since [year]',
      'Over [X] five-star Google reviews in [city]',
      'Financing available — $0 down on new system installs',
      'Same-day service for most repairs — no "2-week wait list" excuses',
    ],

    localKeywords: [
      '[city] HVAC company',
      'AC repair [city]',
      'furnace repair [city]',
      'heating and cooling [city]',
      '[city] air conditioning service',
      'HVAC contractor near me [city]',
      '[city] heat pump installation',
      'emergency HVAC [city]',
      'AC installation [city]',
      '[city] furnace replacement',
    ],

    hookFormulas: [
      // Shocking visual
      'This is what a "recently changed" air filter looks like after 4 months. If yours looks like this — your AC is working 40% harder than it should. 🔧',
      // Financial fear
      'A 10-year-old AC system running today costs you nearly twice what a new 18 SEER system would. Here is the math that makes the decision obvious.',
      // Urgency + location
      'With [city] temperatures hitting the 90s this week, here are the 4 signs your AC is about to fail — and what to do before it does.',
      // Job story
      'Christmas Eve. Family of 6. Furnace stopped working at 11pm. Here is how the night went and what we found.',
      // Challenge a belief
      'Your AC does not need refrigerant added every year. If your tech says it does — you have a leak, not a top-off situation. Here is the difference.',
      // Local social proof
      'We just cut a [city] homeowner is energy bill by $180/month by replacing their 12-year-old 10 SEER with a new 18 SEER heat pump.',
      // System age engagement
      'How old is your HVAC system? Drop the year it was installed in the comments. Here is what each age means for your risk this season.',
      // Carbon monoxide safety
      'We found this cracked heat exchanger during a routine fall tune-up in [city]. The family had no idea. Here is what it looks like.',
      // Duct efficiency
      'Up to 30% of the air you pay to cool leaks into your attic before reaching your rooms. Here is the 5-minute test to find out if yours does.',
      // Pro tip authority
      'The thermostat setting that most [city] homeowners have wrong — and changing it saves hundreds without spending a dollar.',
      // Seasonal warning
      'Fall reminder: the #1 cause of January furnace failures is something that a $50 tune-up in October would have caught.',
      // Myth bust
      'The bigger the AC, the cooler the house. Wrong. An oversized system short-cycles, leaves your home humid, and dies twice as fast.',
      // Before/after tease
      'What we found when we opened this condenser unit after a [city] summer. The homeowner said it was "fine." 🌡️',
      // Emergency relatability
      'Called at 9pm in a heat wave. AC out. Kids and elderly parent inside. Here is what the next 2 hours looked like.',
      // Simple save-worthy tip
      'One thing to do before calling a tech when your AC stops cooling — this fixes 30% of all no-cool calls for free.',
    ],

    ctaVariations: [
      'Save this — you will want it the day your AC stops cooling 🔖',
      'Tag a homeowner whose house is always too hot or too cold',
      'Comment with your system brand and age — we will tell you what to expect',
      'Drop a ❄️ if your house stays comfortable all summer',
      'Call [phone] for a free system evaluation — upfront pricing, no surprises',
      'Book your tune-up online before we fill up — link in bio',
      'DM us your energy bill and system age — we will tell you if a new system makes financial sense',
      'Call [phone] — same-day appointments available in [city]',
      'Save our number before you need us at 2am in January',
      'Comment "COOL" and we will send you our free AC maintenance guide',
    ],

    imageVisuals: {
      keyElements: [
        'outdoor condenser unit with technician working on it — refrigerant lines visible',
        'manifold gauge set showing system pressure readings — blue and red gauges',
        'dirty vs. clean air filter side by side — the before is always shocking',
        'furnace burner assembly with flame — ignitor and heat exchanger visible',
        'ductwork being sealed with mastic in attic — before/after of leaking duct',
        'digital thermostat display showing set point and actual temperature',
        'evaporator coil covered in ice — visible sign of a refrigerant or airflow problem',
        'new system installation — air handler and condenser, refrigerant lines being connected',
        'cracked heat exchanger — the most important safety find in HVAC inspection',
        'ECM blower motor and control board — the technology homeowners pay for',
      ],
      authenticScenes: [
        'technician kneeling at outdoor condenser unit, manifold gauges attached to service valves, working in natural daylight',
        'dirty filter vs clean filter held side by side — same hand, same lighting, same frame for comparison',
        'new HVAC system installation — air handler mounted, refrigerant lines brazed, thermostat wired, before startup test',
        'attic ductwork inspection with tech using flashlight — showing duct leakage or disconnected boot',
        'furnace inspection: heat exchanger inspection mirror, combustion analysis meter, CO detector near flue',
      ],
      avoidCliches: [
        'cartoon snowflake and sun face icons',
        'generic house illustration with temperature arrows pointing at it',
        'stock photo of person in sweater adjusting a clean white thermostat',
        'clipart AC unit on white background',
        'corporate HVAC branding with model standing next to equipment in studio',
      ],
      colorPalette: 'silver and gray metal condensers, blue refrigerant gauge faces, orange furnace flame, white filter media, copper refrigerant tubing, yellow and black caution on equipment labels',
      composition: 'technician actively working (not posing), gauges in frame showing real readings, before/after filter comparison from same angle and distance, cracked component close-up macro shot',
      moodAndLighting: 'honest field conditions — outdoor natural light on condenser work, attic or utility room artificial light for indoor work. Real job site feel, not studio-lit product photography.',
      seasonalVisuals: {
        winter: 'furnace interior with burner flames visible, technician checking heat exchanger, frost on outdoor heat pump unit in defrost mode',
        spring: 'outdoor condenser being cleaned with garden hose, tech attaching gauges for startup check, coils before/after cleaning',
        summer: 'technician working at outdoor unit in full summer sun, heat haze visible, thermostat inside showing temperature vs set point gap',
        fall: 'furnace ignitor and burner inspection, dirty evaporator coil before fall cleaning, tech with CO analyzer near flue pipe',
      },
    },
  },

  // ============================================================
  // ROOFING
  // ============================================================
  roofing: {

    customerPainPoints: [
      // Emergency — active damage
      'Roof leaking through the ceiling right now during a storm — water spreading across the floor',
      'Woke up to a water stain on the bedroom ceiling after last night is rain',
      'Shingles blown into the yard after high winds — no idea how bad the damage is',
      'Insurance adjuster is coming next week and I have no idea what to expect or what I am owed',
      'Emergency tarp on the roof from last week is leaking now',
      // Financial fear
      'Roof is 22 years old — terrified every storm will be the one that causes major damage',
      'Claim was denied — insurance company says damage is from age not storm',
      'Got three quotes ranging from $9,000 to $19,000 — no idea which is legitimate',
      // Chronic neglect
      'Granules filling the gutters every time it rains — been going on for a year',
      'Dark streaks running down the roof — neighbors say it is algae but not sure what to do',
      'Flashing around the chimney is rusted and visibly pulling away',
      'Fascia boards rotting at the corners — gutter overflowing in the same spot',
      // Hidden damage
      'Attic feels like a sauna in summer — insulation soaked at one corner',
      'Skylight leaking around the seal — water stain spreading on the drywall',
      'Squirrels got into the attic — found a gap where shingles are missing at the roof edge',
      // Trust issues
      'A company knocked on the door after the storm offering a free inspection — felt like a scam',
      'Roof was replaced 8 years ago by a contractor who has since disappeared — warranty is worthless',
      'Previous owner is roof was "recently replaced" but we found rot under the new shingles',
    ],

    tradeTerminology: [
      'asphalt shingles', 'architectural shingles', 'three-tab shingles', 'metal roofing',
      'TPO membrane', 'modified bitumen', 'ice and water shield', 'synthetic underlayment',
      'drip edge', 'ridge cap', 'hip and ridge', 'flashing', 'step flashing', 'valley flashing',
      'decking', 'OSB sheathing', 'roof deck', 'fascia', 'soffit', 'ridge vent', 'soffit vent',
      'nail pattern', 'starter course', 'algae-resistant shingles', 'Class 4 impact resistant',
      'wind rating', 'manufacturer warranty', 'workmanship warranty', 'storm chaser',
      'insurance supplement', 'actual cash value vs replacement cost', 'depreciation',
    ],

    contentAngles: [
      {
        angle: 'storm_chaser_warning',
        hook: 'A truck just knocked on your door after the storm offering a free inspection. Here is what to ask before you let anyone on your roof.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Protects homeowners from fraud — gets shared widely, positions local company as the trustworthy alternative',
      },
      {
        angle: 'insurance_claim_guide',
        hook: 'Your insurance company does not want you to know this before the adjuster arrives. Here is what we tell every client.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Massive financial stakes — homeowners feel uninformed and share this widely',
      },
      {
        angle: 'granule_loss_reveal',
        hook: 'Look in your gutters after the next rain. If you see this — your roof has less than 3 years of life left.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Simple actionable test anyone can do — visual result drives urgency and shares',
      },
      {
        angle: 'drone_reveal',
        hook: 'What our drone found on this [city] home. The homeowner had no idea it looked like this.',
        type: 'before_after',
        engagementLevel: 'very_high',
        why: 'Drone footage creates dramatic perspective homeowners never see — highest virality content in roofing',
      },
      {
        angle: 'roof_age_calculator',
        hook: 'How old is your roof? Drop the year it was installed in the comments. Here is what each age range means for your risk this storm season.',
        type: 'engagement',
        engagementLevel: 'very_high',
        why: 'Easy to answer, high lead intent from older roofs, drives conversation',
      },
      {
        angle: 'algae_streaks_explain',
        hook: 'Those dark streaks on your roof are not dirt. Here is what they actually are and whether you need to worry.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Very visible issue — homeowners notice it but do not know what it means',
      },
      {
        angle: 'shingle_lifespan_truth',
        hook: '"Architectural shingles last 30 years." The actual lifespan in most climates is 15-20. Here is the honest answer.',
        type: 'faq',
        engagementLevel: 'high',
        why: 'Challenges a common belief — drives engagement from homeowners trying to delay replacement',
      },
      {
        angle: 'zero_out_of_pocket',
        hook: 'This [city] family got a complete new roof for zero out of pocket. Here is exactly how the insurance process worked.',
        type: 'customer_story',
        engagementLevel: 'very_high',
        why: 'Financial outcome everyone wants — drives immediate calls from storm-affected homeowners',
      },
      {
        angle: 'flat_roof_warning',
        hook: 'Flat roofs need more attention than pitched roofs — and most homeowners do not find out until the ceiling is stained.',
        type: 'educational',
        engagementLevel: 'medium_high',
        why: 'Niche but highly engaged audience — flat roof owners are often anxious about this',
      },
      {
        angle: 'ventilation_education',
        hook: 'Your attic should be the same temperature as outside. If it feels like a sauna in summer — your roof is failing for a reason you cannot see from the outside.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Invisible problem homeowners do not connect to roofing — educational and shareable',
      },
    ],

    faqPairs: [
      { q: 'How long should my roof last?', a: 'Three-tab asphalt: 15-20 years. Architectural/dimensional shingles: 20-30 years (but 18-22 is realistic in harsh climates). Metal roofing: 40-70 years. Warranties say 30 years but that is material warranty — workmanship and real-world performance is different. Age is only one factor; installation quality and ventilation matter more.' },
      { q: 'Will my insurance cover roof replacement?', a: 'It depends on your policy and the cause. Storm damage (hail, wind) is typically covered under replacement cost policies. Normal wear and age is not. The #1 mistake: filing before getting an independent contractor assessment. We inspect first, document properly, then you decide whether to file. Improper claims can increase your rates.' },
      { q: 'What are the dark streaks on my roof?', a: 'Gloeocapsa magma — a type of algae that feeds on the limestone filler in asphalt shingles. It does not immediately damage your roof but it accelerates granule loss. Algae-resistant shingles with copper granules prevent it. Soft washing removes it without pressure damage. Do not power wash a shingle roof.' },
      { q: 'Should I repair or replace my roof?', a: 'If the damage is isolated to one area and the rest of the roof has life left — repair. If the roof is over 15 years old and the damage covers more than 30% of the surface — replacement makes more financial sense. Repairs on old roofs often cost 40-60% of replacement anyway, and you are still left with an aging roof.' },
      { q: 'What is the best time of year to replace a roof?', a: 'Spring and fall are ideal — mild temperatures allow shingles to seal properly. Summer works but heat can make shingles brittle during installation. Winter is possible in milder climates. In cold climates, do not wait until November — contractors are booked and cold weather affects adhesive bonding. Book fall installs by September.' },
      { q: 'What is a storm chaser and should I use one?', a: 'Storm chasers are out-of-town contractors who follow severe weather events and go door to door. Some are legitimate but many overcharge, use inferior materials, or disappear after taking a deposit. Warning signs: pressure to sign immediately, no local office or address, asking you to sign over your insurance rights. Always use a local licensed contractor with verifiable references.' },
      { q: 'How do I know if I have hail damage?', a: 'From the ground: random dark impact marks on shingles, dents in metal flashing, gutters, or AC fins. On the roof: circular impact marks with exposed asphalt mat, granule loss in a random pattern (not just in valleys). Age-related granule loss is directional and gradual. Hail damage is random and concentrated. We provide free hail inspections — get an independent opinion before calling your insurance.' },
      { q: 'Do I really need ice and water shield?', a: 'In any climate that sees ice or temperatures below freezing — yes, absolutely. Ice and water shield is a self-adhering waterproof membrane that seals around nails and protects against ice dam infiltration. Some contractors skip it to lower bids. It is the most important material under your shingles in cold climates. Ask every contractor if it is included.' },
    ],

    seasonalContent: {
      1: {
        urgencyTopic: 'Ice dam season peak — ice backing up under shingles and forcing water into walls and ceilings',
        tipTopic: 'How ice dams form, why they are not just a roof problem, and the only permanent fix',
        promotionAngle: 'Emergency ice dam removal and temporary tarping — same-day response in [city]',
        emotionalContext: 'Active damage happening right now — homeowners watching ceiling stains grow with every freeze/thaw cycle. Anxiety and helplessness.',
        postIdea: 'Show a real ice dam job: the 6-inch ice build-up at the eave, the water stain inside, the removal process, and what was happening underneath. Educational and dramatic.',
        engagementHook: 'Ask: "Has anyone dealt with ice dams this winter? Share where in [city] — we are seeing them everywhere this week"',
      },
      2: {
        urgencyTopic: 'Post-storm damage documentation — February storms leaving damage that homeowners are just now discovering',
        tipTopic: 'How to properly document roof damage before your insurance adjuster arrives — photos, videos, and what to say',
        promotionAngle: 'Free storm damage assessment and insurance claim assistance — we document everything',
        emotionalContext: 'Insurance anxiety — homeowners know they have damage but do not know if they will be covered or how the process works',
        postIdea: 'Walk through a real insurance claim from start to finish — inspection photos, the adjuster visit, the supplement process, and the final outcome for the homeowner',
        engagementHook: 'Ask: "Has anyone successfully filed a roof claim after this winter is storms? What was your experience?" — drives conversation and positions you as the expert guide',
      },
      3: {
        urgencyTopic: 'Spring inspection season — winter damage revealing itself as temperatures rise and rains return',
        tipTopic: 'The 10-point spring roof inspection checklist any homeowner can do from the ground',
        promotionAngle: 'Free spring roof inspection — catch winter damage before the rainy season makes it worse',
        emotionalContext: 'Relief after winter but new anxiety about what the winter left behind. Motivated homeowners in planning mode.',
        postIdea: 'Show the drone inspection of a roof that "looked fine from the street" but had three areas of wind damage, loose flashing, and compromised ridge cap — invisible until aerial view',
        engagementHook: 'Ask: "Did your roof survive the winter? When did you last have it inspected?" — spring inspection season driver',
      },
      4: {
        urgencyTopic: 'Pre-storm season reinforcement — fix winter damage before spring storms hit',
        tipTopic: 'How to spot the 5 signs of a failing roof before it leaks this spring',
        promotionAngle: 'April roofing special — repair and reinforce before storm season, book before the schedule fills',
        emotionalContext: 'Growing urgency — storm season approaching and homeowners with known roof issues feel the deadline',
        postIdea: 'Show the "granules in the gutter test" — scoop some granules out of a client is gutter, explain what it means, show the comparison between a healthy roof and one near end of life',
        engagementHook: 'Ask: "Look in your gutters right now — are there granules in there? Drop a comment and we will tell you what it means for your roof"',
      },
      5: {
        urgencyTopic: 'Schedule fills in May — book June-July installations now or wait until fall',
        tipTopic: 'Why May and June are the optimal installation months and how to get on the schedule',
        promotionAngle: 'Book May for summer completion — limited spots available, lock in pre-summer pricing',
        emotionalContext: 'FOMO on schedule availability — homeowners who waited all winter feel the urgency when summer is approaching',
        postIdea: 'Time-lapse or day-by-day photo series of a full roof replacement — from old damaged shingles to brand new install in one day. The scale and speed impresses homeowners.',
        engagementHook: 'Ask: "How long does a full roof replacement actually take? Drop your guess below" — then reveal: most complete in one day',
      },
      6: {
        urgencyTopic: 'Peak installation season — schedule packed, but we deliver fast quality work',
        tipTopic: 'What to expect during your roof replacement — hour by hour, from arrival to cleanup',
        promotionAngle: 'Summer installation special — financing available, same-week starts for urgent repairs',
        emotionalContext: 'Excitement for homeowners who are finally getting it done, combined with logistics anxiety about the process',
        postIdea: 'Post the "day of installation" content — crew arriving at dawn, tear-off, new decking, ice and water shield, underlayment, shingles, ridge cap, cleanup, final drone reveal. Gets incredible engagement.',
        engagementHook: 'Ask: "What worried you most before your roof was replaced?" — community building and objection handling',
      },
      7: {
        urgencyTopic: 'Storm season emergency repairs — hail and high winds creating urgent jobs across [city]',
        tipTopic: 'What to do in the first hour after storm damage to your roof — before you call anyone',
        promotionAngle: 'Storm damage response — we inspect within 24 hours, tarp same day if needed',
        emotionalContext: 'Post-storm panic — homeowners do not know if they are damaged, how bad it is, or what to do first. They trust the first reliable voice they find.',
        postIdea: 'Show a hail damage inspection — the coin-sized impact marks, the exposed asphalt, the dented ridge cap, the gutters, the AC unit. Walk through exactly what qualifies as insurance-grade damage.',
        engagementHook: 'Ask: "Did the storm hit your neighborhood? Drop your street or area — we are tracking where damage is concentrated"',
      },
      8: {
        urgencyTopic: 'Pre-fall roof check — service now before the fall rush makes scheduling impossible',
        tipTopic: 'End-of-summer roof inspection: 6 things to check before fall rains arrive',
        promotionAngle: 'August roof check special — last open appointments before fall season fills our schedule',
        emotionalContext: 'Back-to-routine energy — homeowners in get-things-done mode before school starts',
        postIdea: 'Show a ventilation inspection in an attic that was not ventilated properly — the premature shingle aging, the high attic temperature, the moisture buildup. Connects visible exterior aging to an invisible cause.',
        engagementHook: 'Ask: "Has your attic been inspected in the last 5 years? Most homeowners never check — here is what we find"',
      },
      9: {
        urgencyTopic: 'Fall installation prime season — ideal temperatures for proper shingle sealing',
        tipTopic: 'Why fall is actually better than summer for roof replacement — the temperature science',
        promotionAngle: 'Fall roofing special — ideal weather, great pricing, fast scheduling before winter',
        emotionalContext: 'Decision-making season — homeowners who survived another summer without replacing are now motivated to do it before winter',
        postIdea: 'Show side-by-side: a roof replaced in the ideal fall temperature range vs one installed on a hot July day — the shingle seal lines and tab bond quality are visibly different',
        engagementHook: 'Ask: "Thinking about replacing your roof this fall? What is holding you back?" — surfaces objections and starts conversations',
      },
      10: {
        urgencyTopic: 'October deadline — last realistic month for full roof replacement before winter in most climates',
        tipTopic: 'How to winterize your roof in October — the checklist that extends roof life through winter',
        promotionAngle: 'October last-chance installation special — complete before the freeze',
        emotionalContext: 'Real deadline urgency — first frost is coming and homeowners know it. October is the last window for major work.',
        postIdea: 'Show a full gutters-and-fascia job from October — rotted fascia from years of gutter overflow, new fascia, new gutters, sealed system ready for winter. Satisfying and educational.',
        engagementHook: 'Ask: "Are your gutters ready for winter? Last chance to clear and inspect before leaves make it impossible to see damage"',
      },
      11: {
        urgencyTopic: 'Emergency repairs before winter — known damage that will compound under snow load',
        tipTopic: 'How to prevent ice dams this year — the ventilation and insulation combination that actually works',
        promotionAngle: 'Pre-winter emergency inspection — identify and fix vulnerable spots before snow hits',
        emotionalContext: 'Last-chance anxiety — homeowners with known issues feeling the pressure of incoming winter',
        postIdea: 'Show a roof with compromised ridge cap and damaged soffit vents going into winter — explain what happens when moisture gets trapped with no ventilation and freezes. Creates real urgency.',
        engagementHook: 'Ask: "Does your roof have any known issues going into this winter? Drop a description — we will tell you how worried to be"',
      },
      12: {
        urgencyTopic: 'Holiday emergency roofing — storm damage does not pause for Christmas',
        tipTopic: 'What to do if your roof starts leaking over the holidays — the 4-step protocol while you wait for us',
        promotionAngle: '24/7 holiday emergency response — same-day tarping when you need it most',
        emotionalContext: 'Holiday stakes — a leaking roof during a family gathering is a crisis. They need someone reliable who actually answers.',
        postIdea: 'Share a real December emergency call story — the Christmas Eve leak, the emergency tarp, the family is relief. This story gets shared more than any other content type in December.',
        engagementHook: 'Post your emergency number with: "Save this. We answer on Christmas." — gets saved and shared before every major storm',
      },
    },

    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],

    trustSignals: [
      'Licensed, bonded, and insured — [state] contractor license #[number]',
      'Manufacturer-certified installer — GAF Master Elite / CertainTeed SELECT ShingleMaster',
      'Lifetime workmanship warranty — not just the materials, our labor too',
      'We work directly with your insurance company — no out-of-pocket surprises',
      'Local company — we are here after the job, not storm chasers who disappear',
      'A+ BBB rating — verifiable, not self-reported',
      'Over [X] roofs installed in [city] — aerial photos of every job',
      'Free storm damage inspections — no pressure, honest assessment',
      'Financing available — approved in minutes, $0 down on qualifying jobs',
      'Serving [city] families for [X] years — your neighbors trust us',
      'Never ask you to sign over your insurance rights',
    ],

    localKeywords: [
      '[city] roofing company',
      'roof repair [city]',
      'roof replacement [city]',
      'storm damage roofing [city]',
      'local roofer [city]',
      'hail damage roof [city]',
      'emergency roofer [city]',
      '[city] roofing contractor',
      'insurance roof claim [city]',
      'shingle replacement [city]',
    ],

    hookFormulas: [
      // Visual reveal
      'What our drone found on this [city] home. The homeowner thought it looked fine from the driveway. 🏠',
      // Insurance education
      'Your insurance company does not want you to know this before the adjuster arrives. Here is what a [city] roofer tells every client.',
      // Granule loss test
      'Look in your gutters after the next rain. If you see this — your roof has 2-3 years left. Here is what you are looking at.',
      // Storm chaser warning
      'If someone knocks on your door after a storm offering a free inspection — here is what to ask before you let anyone on your roof.',
      // Age urgency
      'If your roof was installed before 2008, read this before your next storm season. Age is not the only issue.',
      // Insurance success story
      'We just helped a [city] family get a complete roof replacement for $0 out of pocket. Here is exactly how the insurance process worked.',
      // Dark streaks
      'Those dark streaks running down your roof are not dirt. Here is what they actually are and whether you need to worry.',
      // Engagement question
      'How old is your roof? Drop the year in the comments — we will tell you what to expect this storm season.',
      // Process reveal
      'What actually happens on a full roof replacement day — from 6am crew arrival to 5pm final drone photo.',
      // Ventilation education
      'Your attic should feel like outside temperature. If it feels like a sauna — your roof is aging twice as fast. Here is why.',
      // Ice dam education
      'Ice dams are not a roofing problem — they are a ventilation and insulation problem. Here is the distinction that saves you money.',
      // Warranty truth
      '30-year shingles do not last 30 years in most climates. Here is the honest lifespan by shingle type and region.',
      // Local trust
      'We are [city] locals. We drove past your house before you were a customer. We will be here after the job is done.',
      // Comparison
      'We inspected three houses on the same street after last weekend is storm. Here is what we found — and why two claims got approved and one did not.',
      // Satisfying before/after
      'Before: green algae, missing shingles, soft decking. After: one day, one crew, completely new. [city] home transformation. 🔨',
    ],

    ctaVariations: [
      'Save this — you will want it before the next storm 🔖',
      'Tag a neighbor whose roof looks like it needs attention',
      'Comment: how old is your roof? We will tell you what to expect',
      'Drop a 🏠 if you have been putting off your roof inspection',
      'Call [phone] for a free storm damage inspection — zero pressure, honest assessment',
      'Get your free estimate — drone inspection included, link in bio',
      'DM us your address and we will tell you when the last major storm hit your area and what to look for',
      'Call [phone] — free inspections this week, open slots available in [city]',
      'Save our number. We answer on Christmas and after every storm.',
      'Comment "INSPECT" and we will DM you our 10-point roof inspection checklist',
    ],

    imageVisuals: {
      keyElements: [
        'aerial drone view of full roof — old weathered shingles from above showing scale and damage',
        'hail impact marks on asphalt shingles — circular bruises with exposed black mat, granule displacement',
        'granules in gutter — handful of gray granules against white gutter interior',
        'new architectural shingle installation — crisp color, nail line, fresh drip edge',
        'ridge cap installation — hands nailing ridge cap in place, blue sky behind',
        'ice dam formation at eave — heavy ice buildup with icicles, water staining wall below',
        'damaged flashing at chimney — rust, separation, caulk failure close-up',
        'safety harness attached to peak — orange harness strap against gray shingles, crew working below',
        'before/after same roof from drone — weathered green algae covered vs new charcoal shingles',
        'insurance hail damage documentation photo — tape measure showing dent size, numbered markers',
      ],
      authenticScenes: [
        'aerial drone view from 50 feet — crew installing new shingles in uniform rows, blue sky, suburban neighborhood visible below',
        'close-up macro of hail impact on shingle — the damaged mat visible, granule displacement around circular impact',
        'crew member in safety harness nailing ridge cap — clouds and sky behind, real job site scale visible',
        'inspector on roof with clipboard and camera — genuinely examining shingle field, not posing',
        'before/after aerial: same camera position, same altitude — algae-stained 20-year-old shingles vs new Timberline HDZ charcoal',
        'gutter granule evidence — hand scooping granules from gutter to show homeowner the wear stage',
      ],
      avoidCliches: [
        'cartoon house outline with triangle roof and sun',
        'stock photo of smiling roofer with no actual work visible',
        'blueprint or floor plan illustration',
        'generic ladder-against-house stock photo from 1990s',
        'low-angle ground shot with no roof context — just sky and gutter',
      ],
      colorPalette: 'new charcoal and weathered wood-tone architectural shingles, weathered gray-green of old algae-covered roof, bright orange safety vests against blue sky, copper and galvanized flashing silver',
      composition: 'aerial drone perspective is the single most engaging shot type in roofing — always the hero image. Before/after from identical drone position is the most viral content. Tight hail damage macro for insurance content.',
      moodAndLighting: 'natural outdoor light only — bright sunny day shows new shingles best, overcast light best for damage documentation. No flash, no studio. The scale of the job is the drama — let the drone do the work.',
      seasonalVisuals: {
        winter: 'heavy ice dam at eave edge with icicles cascading down, snow-loaded roof with depressions showing rafter locations, emergency blue tarp staked down after wind damage',
        spring: 'inspector on roof examining shingles after winter, granule loss in valley from snowmelt, hail impact marks fresh from spring storm',
        summer: 'crew in orange safety vests installing shingles under clear blue sky, completed new roof gleaming in summer sun from drone altitude',
        fall: 'leaves covering old roof showing age spots and algae, gutter packed with leaves and granules, last crew of fall season working against golden light',
      },
    },
  },

  // ============================================================
  // CONCRETE
  // ============================================================
  concrete: {
    customerPainPoints: [
      'Driveway cracked and sinking after years of freeze-thaw cycles',
      'Patio surface spalling and flaking — looks terrible',
      'Concrete steps crumbling and becoming a safety hazard',
      'Garage floor stained, pitted, and impossible to clean',
      'Sidewalk heaved by tree roots creating a trip hazard',
      'Pool deck cracked and rough on bare feet',
      'Driveway stained from oil and rust with no way to clean it',
      'Old concrete looking dated — neighbors all have stamped patios',
      'Basement floor cracking and settling',
      'Concrete retaining wall cracking and leaning',
      'New home with builder-grade concrete that is already failing',
      'Decorative overlay peeling off after just a few years',
      'Sealer worn off and concrete absorbing water like a sponge',
      'City-issued violation for cracked public sidewalk in front of home',
      'Concrete too slippery when wet — liability concern',
    ],
    seasonalContent: {
      1: { urgencyTopic: 'Assess freeze-thaw damage from winter', tipTopic: 'How freeze-thaw cycles destroy concrete and what to do', promotionAngle: 'Winter damage assessment — free quote for spring repairs' },
      2: { urgencyTopic: 'Plan spring concrete projects while schedule is open', tipTopic: 'Why planning your concrete project in winter saves money', promotionAngle: 'Book now for spring installation — lock in winter pricing' },
      3: { urgencyTopic: 'Spring concrete repair season begins — book early', tipTopic: 'The best temperature range for pouring concrete', promotionAngle: 'Spring concrete special — early booking discount' },
      4: { urgencyTopic: 'Driveway and patio installation prime season', tipTopic: 'What to expect during a concrete driveway replacement', promotionAngle: 'April concrete special — ideal weather for installation' },
      5: { urgencyTopic: 'Peak season underway — limited slots remaining', tipTopic: 'How to choose between stamped, broom-finish, and exposed aggregate', promotionAngle: 'Spring booking special — schedule before summer rush' },
      6: { urgencyTopic: 'Summer installations in full swing — book immediately', tipTopic: 'How concrete is cured in hot weather — what we do differently', promotionAngle: 'Summer concrete special — fastest turnaround of the year' },
      7: { urgencyTopic: 'Pool deck and patio upgrades for the rest of summer', tipTopic: 'Non-slip concrete finishes for pools and wet areas', promotionAngle: 'Pool deck special — enjoy it before summer ends' },
      8: { urgencyTopic: 'Pre-fall installation — last chance before cooler temps', tipTopic: 'Why late summer is perfect for concrete sealing', promotionAngle: 'August concrete and sealing special' },
      9: { urgencyTopic: 'Fall is ideal for concrete — book before freeze', tipTopic: 'Why fall concrete installations cure better than summer', promotionAngle: 'Fall concrete special — excellent curing conditions' },
      10: { urgencyTopic: 'Last chance before winter — get your project done now', tipTopic: 'Sealing your concrete before winter extends its life by years', promotionAngle: 'October sealing special — protect before the freeze' },
      11: { urgencyTopic: 'Emergency repairs before freeze makes damage permanent', tipTopic: 'How to fill concrete cracks before winter to prevent more damage', promotionAngle: 'Pre-winter crack repair — prevent costly spring damage' },
      12: { urgencyTopic: 'Plan next year projects — early booking discounts available', tipTopic: 'How to protect your concrete through winter', promotionAngle: 'Book 2026 projects now — lock in current pricing' },
    },
    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],
    trustSignals: [
      'Licensed and insured concrete contractor',
      'Over [X] driveways and patios installed in [city]',
      'Locally owned and operated',
      'All work warrantied',
      'Free estimates — no pressure',
      'We pull all required permits',
      'Serving [city] homeowners since [year]',
      'Before and after photos on every project',
      'Clean jobsite guaranteed',
      'Financing available on larger projects',
    ],
    localKeywords: [
      '[city] concrete contractor',
      'concrete driveway [city]',
      'stamped concrete [city]',
      'concrete patio [city]',
      'concrete repair [city]',
      'driveway replacement [city]',
      'local concrete company [city]',
      'decorative concrete [city]',
    ],
    hookFormulas: [
      'Did you know sealing your concrete every 2-3 years can double its lifespan? 🏠',
      'Most homeowners do not realize their cracked driveway is a liability — not just an eyesore.',
      'With winter approaching, now is the time to seal those cracks before freeze-thaw makes them worse.',
      'Just finished this stunning stamped concrete patio in [city] — the transformation is unreal. 🔨',
      'If your driveway looks like ours before — here is what we can do.',
      'Stop living with a cracked, stained driveway. Here is what a replacement actually costs.',
      'We transformed this [city] home is curb appeal with a brand new decorative driveway.',
      'Quick question: how old is your driveway? Here is what age tells you.',
      'See those cracks spreading across your concrete? Here is what they are trying to tell you.',
      'Pro tip: this is the one thing you should do to your concrete every single fall.',
    ],
    ctaVariations: [
      'Save this for your home improvement planning 🔖',
      'Tag someone who needs a driveway upgrade',
      'Comment below with your concrete question — we answer everything',
      'Drop a 🏡 if your driveway needs some love',
      'Call us for a free estimate: [phone]',
      'Get your free quote online — link in bio',
      'DM us a photo of your concrete — we will tell you exactly what it needs',
      'Call [phone] — free estimates this week, no obligation',
    ],
    imageVisuals: {
      keyElements: ['fresh concrete pour being screeded by crew', 'float trowel creating smooth surface', 'rebar grid before pour', 'stamping mat pressed into wet concrete', 'broom finish texture close-up', 'decorative stain color on concrete', 'cracked old driveway vs. new smooth driveway'],
      authenticScenes: ['crew screeding a large wet concrete pour — action shot', 'stamping pattern being pressed into still-wet concrete', 'top-down view of new driveway from above', 'close-up macro shot of stamped texture and color', 'exact before/after from identical position — cracked vs. new'],
      avoidCliches: ['plain gray slab on white background', 'generic foundation illustration', 'blueprint overlay on concrete', 'stock photo of empty parking lot'],
      colorPalette: 'wet gray concrete during pour, warm earth tones of stamped patterns, vibrant acid stain reds and browns, orange safety cones, rebar rust-orange',
      composition: 'overhead top-down shot of large pour in progress is most engaging, close-up texture macro (tactile feel), dramatic driveway before/after from same angle and distance',
      seasonalVisuals: {
        winter: 'freeze-damaged cracked driveway with frost in cracks, spring repair planning reference',
        spring: 'first pour of the season, ideal temperature conditions, fresh concrete crew mobilizing',
        summer: 'full crew on large driveway pour in sunshine, pool deck or patio installation',
        fall: 'sealing application with roller, pre-winter crack filling, ideal cure-condition weather',
      },
    },
  },

  // ============================================================
  // LANDSCAPING
  // ============================================================
  landscaping: {
    customerPainPoints: [
      'Lawn full of brown patches and bare spots despite watering',
      'Weeds taking over and spreading to flower beds',
      'Irrigation system not working properly — dry zones everywhere',
      'Tree branches dangerously close to the house after a storm',
      'Backyard looks like a jungle — completely overgrown',
      'Curb appeal destroying property value compared to neighbors',
      'Mulch beds full of weeds within weeks of being laid',
      'Lawn full of grubs killing the grass from underground',
      'Drainage problem — yard floods every time it rains',
      'New sod dying despite best watering efforts',
      'Invasive plants taking over the entire garden',
      'Outdoor space useless — needs a complete design overhaul',
      'Fall leaves overwhelming — cannot keep up with cleanup',
      'Snow removal destroying the lawn edges every winter',
      'HOA warning about lawn and landscape appearance',
    ],
    seasonalContent: {
      1: { urgencyTopic: 'Winter landscape protection and planning for spring', tipTopic: 'How to protect your plants and trees through winter', promotionAngle: 'Book spring landscaping now — locked-in pricing' },
      2: { urgencyTopic: 'Spring planning and design consultations', tipTopic: 'How to design a low-maintenance yard that looks great year-round', promotionAngle: 'Free spring landscape design consultation' },
      3: { urgencyTopic: 'Spring cleanup and bed preparation', tipTopic: 'The spring lawn care checklist every homeowner needs', promotionAngle: 'Spring cleanup special — yards transformed in one day' },
      4: { urgencyTopic: 'Mulching, planting, and irrigation startup', tipTopic: 'Why mulching in spring is the single best thing for your beds', promotionAngle: 'April mulching and planting special' },
      5: { urgencyTopic: 'Full lawn care season underway — weekly service available', tipTopic: 'How to water your lawn correctly for deep root growth', promotionAngle: 'May lawn care package — set it and forget it' },
      6: { urgencyTopic: 'Summer heat management — lawn stress prevention', tipTopic: 'How to keep your lawn green through summer heat', promotionAngle: 'Summer lawn health package — keep it green' },
      7: { urgencyTopic: 'Drought stress management and irrigation efficiency', tipTopic: 'Signs your lawn is stressed by heat and how to help it', promotionAngle: 'July lawn rescue package for heat-stressed yards' },
      8: { urgencyTopic: 'Late summer lawn renovation prep', tipTopic: 'Why August is the best time to overseed and aerate', promotionAngle: 'August aeration and overseeding special' },
      9: { urgencyTopic: 'Fall aeration, seeding, and fertilization season', tipTopic: 'The fall lawn care routine that sets you up for a perfect spring', promotionAngle: 'Fall lawn renovation special — best results of the year' },
      10: { urgencyTopic: 'Leaf cleanup and fall bed preparation', tipTopic: 'Why removing leaves promptly protects your lawn through winter', promotionAngle: 'October leaf cleanup package — recurring or one-time' },
      11: { urgencyTopic: 'Final cleanup and winter protection plantings', tipTopic: 'How to put your garden to bed properly for winter', promotionAngle: 'Final fall cleanup special before ground freezes' },
      12: { urgencyTopic: 'Book spring services early — limited slots available', tipTopic: 'Holiday lighting and winter interest plantings', promotionAngle: 'Book 2026 lawn care now — early bird pricing' },
    },
    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],
    trustSignals: [
      'Licensed and insured landscape professionals',
      'Certified horticulturalists on staff',
      'Locally owned — not a franchise',
      'Serving [city] since [year]',
      'All work backed by satisfaction guarantee',
      'Eco-friendly products available',
      'Free landscape design consultations',
      'Over [X] [city] homes transformed',
      'Fully equipped for any size project',
      'Clean crews — always leave your property spotless',
    ],
    localKeywords: [
      '[city] landscaping company',
      'lawn care [city]',
      'landscape design [city]',
      'yard cleanup [city]',
      'lawn maintenance [city]',
      'local landscaper [city]',
      'mulching service [city]',
      'tree trimming [city]',
    ],
    hookFormulas: [
      'Did you know the right mulch depth can eliminate 90% of your weeding? 🌿',
      'Most homeowners do not realize overwatering kills more lawns than drought.',
      'With spring arriving, now is the time to get your yard on the schedule.',
      'Just transformed this [city] backyard — the before and after will make your jaw drop. 🌳',
      'If your lawn looks like this in the before photo — here is what is happening underground.',
      'Stop fighting weeds every weekend. Here is the system we use for our clients.',
      'We turned this neglected [city] property into the nicest yard on the street.',
      'Quick question for [city] homeowners: are you watering your lawn correctly?',
      'Those brown patches on your lawn? Here is the most common cause and the fix.',
      'Pro tip: do this one thing in fall and your lawn will be the envy of the neighborhood next spring.',
    ],
    ctaVariations: [
      'Save this lawn tip for the season 🔖',
      'Tag someone whose yard needs a transformation',
      'Comment your biggest lawn problem — we will give you free advice',
      'Drop a 🌱 if you are ready for a yard you are actually proud of',
      'Call us for a free estimate: [phone]',
      'Book your consultation online — link in bio',
      'DM us a photo of your yard — we will tell you exactly what it needs',
      'Call [phone] — spring slots are filling fast',
    ],
    imageVisuals: {
      keyElements: ['riding mower creating lawn stripe pattern', 'hedge trimmer shaping shrubs', 'fresh dark mulch in flower bed', 'sod being rolled out', 'irrigation head spraying arc', 'paver stone installation in progress', 'retaining wall with plantings', 'lawn edger creating clean border'],
      authenticScenes: ['aerial drone view of manicured lawn with stripe pattern', 'fresh mulch transforming an overgrown weedy bed', 'before/after of neglected yard vs. fully maintained yard', 'paver installation team laying stone', 'team aeration machine passes on fall lawn'],
      avoidCliches: ['generic stock photo spring flowers', 'cartoon lawnmower', 'green lawn illustration with house icon', 'stock photo of single flower on white background'],
      colorPalette: 'deep lush green grass, rich dark brown fresh mulch, gray stone pavers, bright seasonal flower colors, golden late-summer grass tones',
      composition: 'aerial drone overhead is the most compelling landscaping shot, before/after bed or yard transformation, team at work wide shot showing scale of project',
      seasonalVisuals: {
        winter: 'dormant yard in frost contrasted with planning materials, holiday lighting installation in progress',
        spring: 'fresh mulch beds just laid, new sod unrolling on prepared ground, first green lawn of season',
        summer: 'deep green manicured lawn with stripes, irrigation running in morning light, lush full beds',
        fall: 'leaf cleanup crew with blowers, aeration machine making passes, bed prep before winter',
      },
    },
  },

  // ============================================================
  // ELECTRICAL
  // ============================================================
  electrical: {

    customerPainPoints: [
      // Safety emergency — highest fear content
      'Burning smell from an outlet or panel — terrified of an electrical fire',
      'Sparks visible when plugging something in',
      'Breaker trips every time the microwave and coffee maker run at the same time',
      'Flickering lights throughout the house — started after a storm last month',
      'Switch plate or outlet is warm to the touch — should not be hot at all',
      // Old home anxiety
      'Home built in 1968 — original wiring and a 100-amp fuse box throughout',
      'Aluminum wiring throughout the house — inspector flagged it as a fire hazard',
      'No GFCI outlets in kitchen or bathroom — failing home inspection for sale',
      'Half the house is on one circuit — everything trips if the hairdryer runs',
      // Modern upgrade needs
      'Need an EV charger in the garage — no idea what is involved or how much',
      'Solar panels being installed next month — need a panel upgrade first',
      'Home office needs 4 more outlets and a dedicated circuit — keeps tripping',
      'Whole-house generator hookup after three power outages last winter',
      'Smart home devices installed but old wiring causing connectivity issues',
      // Financial fear
      'Electric bill jumped $120 this month with no new appliances — something is drawing power',
      'Electrician quoted $8,000 for a panel upgrade — need a second opinion',
      // Trust
      'Previous owner DIY-wired the garage addition — need it inspected before something happens',
    ],

    tradeTerminology: [
      'load center', 'main panel', 'sub-panel', 'tandem breaker', 'arc fault breaker (AFCI)',
      'ground fault breaker (GFCI)', 'whole-home surge protector', 'service entrance',
      'service upgrade', '100-amp to 200-amp upgrade', 'ampacity', 'wire gauge',
      'NEC code', 'romex', 'BX cable', 'knob and tube wiring', 'aluminum wiring',
      'bonding', 'grounding', 'neutral', 'hot leg', 'dedicated circuit', 'load calculation',
      'Level 2 EV charger', 'NEMA 14-50', 'conduit', 'junction box', 'service drop',
    ],

    contentAngles: [
      {
        angle: 'burning_smell_warning',
        hook: 'If you smell burning plastic near any outlet or switch plate in your home — stop using it and read this immediately.',
        type: 'safety_warning',
        engagementLevel: 'very_high',
        why: 'Life-safety fear — highest share rate of any electrical content, parents especially share this widely',
      },
      {
        angle: 'panel_age_reveal',
        hook: 'What year was your electrical panel installed? Here is what each decade of panel age means for your fire risk.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Personal and specific — easy to answer, generates high-intent leads from older homes',
      },
      {
        angle: 'ev_charger_education',
        hook: 'Thinking about an EV charger for your garage? Here is what it actually costs and what your panel needs before install.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'EV adoption is accelerating — huge audience actively researching this right now',
      },
      {
        angle: 'aluminum_wiring_truth',
        hook: 'Homes built between 1965-1973 often have aluminum wiring. Here is the honest risk level and what we actually recommend.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'High fear topic — homeowners with older homes share this widely and call for inspections',
      },
      {
        angle: 'panel_before_after',
        hook: 'Before: 1970s fuse box with double-tapped breakers and missing knockouts. After: new 200-amp panel, properly labeled, permitted and inspected. Same house.',
        type: 'before_after',
        engagementLevel: 'very_high',
        why: 'Visual transformation in an otherwise invisible system — very satisfying and shareable',
      },
      {
        angle: 'diy_electrical_warning',
        hook: 'This is what a DIY electrical panel looks like inside. The homeowner is selling the house next month and just asked us to "make it look right."',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Relatable fear — many homeowners have DIY work they are worried about, drives inspections',
      },
      {
        angle: 'gfci_education',
        hook: 'GFCI outlets have saved thousands of lives. Here is where every home is required to have them — and why yours might not.',
        type: 'educational',
        engagementLevel: 'medium_high',
        why: 'Simple safety topic with a clear actionable result — gets saves and shares',
      },
      {
        angle: 'surge_protection_value',
        hook: 'One power surge destroyed $4,200 in electronics in a [city] home last summer. Here is the $200 whole-home solution.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'Concrete financial outcome — everyone has electronics to protect, drives immediate action',
      },
      {
        angle: 'flickering_lights_diagnosis',
        hook: 'Flickering lights are not always a bulb problem. Here are the 4 causes — from free to call-immediately.',
        type: 'educational',
        engagementLevel: 'very_high',
        why: 'Active experience — many homeowners have this exact problem right now and are searching for answers',
      },
      {
        angle: 'knob_tube_reality',
        hook: 'Knob and tube wiring in a home you are buying or already own. Here is the honest truth about what it means.',
        type: 'educational',
        engagementLevel: 'high',
        why: 'High anxiety topic for homebuyers and sellers — generates shares and calls',
      },
    ],

    faqPairs: [
      { q: 'How do I know if my electrical panel needs to be replaced?', a: 'Age over 25-30 years, breakers that trip frequently, double-tapped breakers, a Zinsco or Federal Pacific panel (known fire hazards), rust inside the panel, or a 100-amp service on a home with AC and modern appliances. If you have any of these — get an inspection. The cost of a panel upgrade is far less than the cost of a house fire.' },
      { q: 'What does an EV charger installation actually involve?', a: 'Most EV charger installs are a Level 2 (240V) outlet — a NEMA 14-50 or hardwired unit. If your panel has capacity, it is a half-day job. If you need a panel upgrade first, add 1-2 days. Total cost ranges from $400-$1,200 for the electrical work depending on panel capacity and wire run length. We pull the permit — some jurisdictions require it for warranty and insurance purposes.' },
      { q: 'Is aluminum wiring dangerous?', a: 'Aluminum wiring from the 1960s-70s expands and contracts more than copper, which can loosen connections over time — a fire risk. It does not need to be fully replaced in most cases. The solution is CO/ALR-rated receptacles throughout and pigtailing with copper at connection points. Full rewire is also an option. We assess each home and give an honest recommendation — not the most expensive one.' },
      { q: 'Why does my breaker keep tripping?', a: 'Three causes: (1) overloaded circuit — too many appliances on the same circuit, (2) short circuit — a wire is touching something it should not, (3) faulty breaker — older breakers wear out. Overload is the most common and is often solved with a dedicated circuit. A breaker that trips every time the same appliance runs = dedicated circuit time. A breaker that trips randomly = call us.' },
      { q: 'Do I need a permit for electrical work?', a: 'Yes for most significant work — panel upgrades, new circuits, EV charger installs, service changes. No for simple fixture replacements or outlet swaps. A licensed electrician pulls permits as part of the job. Unpermitted electrical work can void your homeowner is insurance and fail a home inspection when you sell. Ask any electrician if they pull permits — if they say no, walk away.' },
      { q: 'What is a whole-home surge protector and do I need one?', a: 'It is a device installed at your main panel that absorbs voltage spikes before they reach your electronics. Costs $150-$300 installed. A single lightning-induced surge can destroy HVAC systems, appliances, and electronics simultaneously. If you have a smart home, an EV, or more than $2,000 in electronics — yes, you need one. Standard power strips protect nothing from a whole-home surge.' },
      { q: 'How much does a 200-amp panel upgrade cost?', a: 'In most areas, $1,800-$3,500 for the panel upgrade including parts, labor, and permit. If the utility needs to upgrade the service entrance (the line from the street), add $500-$1,500 coordinated with your utility. Quotes below $1,500 often mean unlicensed work, no permit, or cutting corners on materials. Get three licensed quotes, verify they include permits, and check reviews.' },
      { q: 'Is it safe to have GFCI outlets in the bathroom?', a: 'They are not just safe — they are required by code in every bathroom, kitchen, garage, outdoor outlet, and near any water source. GFCI protection detects ground faults and trips in milliseconds — faster than your heart can react. If your home was built before 1975, it likely does not have GFCI where required. A $15 outlet installed by an electrician in 20 minutes can save a life.' },
    ],

    seasonalContent: {
      1: {
        urgencyTopic: 'Space heater overload — January sees the highest residential electrical fire rate of the year',
        tipTopic: 'Why space heaters cause more house fires than any other appliance — and the right way to use them',
        promotionAngle: 'January electrical safety inspection — start the year with confidence your home is protected',
        emotionalContext: 'Safety fear at peak — families running space heaters everywhere, overloading circuits. Parents especially engage with fire safety content.',
        postIdea: 'Show a tripped breaker and the space heater that caused it — explain the circuit load math, what a dedicated circuit costs, and how to run a space heater safely',
        engagementHook: 'Ask: "How many space heaters are running in your house right now?" — always gets honest and concerning answers that drive inspection bookings',
      },
      2: {
        urgencyTopic: 'Electrical Fire Prevention Month — February is fire safety awareness, creating a natural opening for inspection content',
        tipTopic: 'The 7 warning signs of dangerous wiring every homeowner must know — and what to do if you see them',
        promotionAngle: 'February electrical safety check — protect your family before something goes wrong',
        emotionalContext: 'Safety awareness heightened — fire prevention month gives permission to share fear-based content without it feeling like scaremongering',
        postIdea: 'Walk through the 7 warning signs one by one — burning smell, warm outlet, flickering, tripping breakers, two-prong outlets, aluminum wiring, age. Make it saveable and shareable.',
        engagementHook: 'Ask: "How many of these warning signs does your home have? Count them up in the comments" — creates urgency from self-assessment',
      },
      3: {
        urgencyTopic: 'Spring outdoor electrical prep — GFCI outdoor outlets, landscape lighting, EV charger season beginning',
        tipTopic: 'Spring outdoor electrical checklist — what to inspect and test before outdoor season begins',
        promotionAngle: 'Spring outdoor electrical package — GFCI outlets, landscape lighting, outdoor panel inspection',
        emotionalContext: 'Planning mode — homeowners thinking about outdoor entertaining, landscaping, and EV ownership in spring',
        postIdea: 'Show a non-GFCI outdoor outlet that has been exposed to winter moisture — corroded contacts, potential shock hazard — and the 30-minute fix that brings it to code',
        engagementHook: 'Ask: "Are your outdoor outlets GFCI protected? Here is a 3-second test to find out" — drives engagement and inspections',
      },
      4: {
        urgencyTopic: 'EV charger installation season — spring EV buying season driving garage charger demand',
        tipTopic: 'Everything you need to know about Level 2 EV charger installation before you buy your next car',
        promotionAngle: 'EV charger installation package — full assessment, permit, install, and inspection in one day',
        emotionalContext: 'EV excitement mixed with anxiety about installation — new EV owners want to understand the process before committing',
        postIdea: 'Show a complete EV charger install from start to finish — panel assessment, breaker addition, wire run to garage, charger mount, permit sign-off. Make it look approachable.',
        engagementHook: 'Ask: "Are you planning to buy an EV this year? What is stopping you from getting the charger installed?" — captures EV intent leads',
      },
      5: {
        urgencyTopic: 'Pre-summer panel readiness — AC startup revealing panels that cannot handle summer electrical load',
        tipTopic: 'Is your electrical panel ready for summer AC demand? Here is the 5-minute self-assessment',
        promotionAngle: 'Pre-summer electrical inspection — catch panel issues before the AC season makes them emergencies',
        emotionalContext: 'First hot days creating AC anxiety — homeowners want to know their system can handle it',
        postIdea: 'Show a panel that failed its first AC-startup summer — double-tapped breakers, melted insulation, undersized service — and the 200-amp upgrade that fixed it',
        engagementHook: 'Ask: "Did your breaker trip when you turned on your AC this week? That is not normal — here is what it means"',
      },
      6: {
        urgencyTopic: 'Whole-home surge protection — summer lightning season beginning, surge events at annual peak',
        tipTopic: 'The $200 whole-home surge protector vs $4,000 in destroyed electronics after one summer storm',
        promotionAngle: 'Surge protection installation special — protect everything in your home for the cost of one appliance',
        emotionalContext: 'Storm anxiety + financial protection — summer storm season makes this immediately relevant and shareable',
        postIdea: 'Share the story of a home that lost HVAC, refrigerator, TV, and multiple smart devices in one storm surge — what whole-home protection would have cost vs what the damage cost',
        engagementHook: 'Ask: "Has a power surge ever destroyed electronics in your home? What was the damage?" — always gets engagement and drives surge protection sales',
      },
      7: {
        urgencyTopic: 'Peak demand month — panels running at max load, symptoms of undersized electrical service appearing',
        tipTopic: 'Signs your electrical panel is struggling with summer demand — and which symptoms require immediate action',
        promotionAngle: 'Panel upgrade special — summer demand revealing capacity issues we can fix before the next heat wave',
        emotionalContext: 'Frustration with tripping breakers and dimming lights in peak heat — homeowners experiencing the problem right now',
        postIdea: 'Show a thermal scan of a panel running at high load — the hot breakers visible in infrared — and explain what normal vs dangerous temperature looks like',
        engagementHook: 'Ask: "Is your power flickering or your breakers tripping this summer? Drop your panel age below"',
      },
      8: {
        urgencyTopic: 'Back-to-school home office electrical prep — dedicated circuits for home office setups',
        tipTopic: 'Why running a home office on a shared circuit is a fire risk — and the right way to add dedicated circuits',
        promotionAngle: 'Home office electrical package — dedicated circuits, additional outlets, surge protection for work-from-home season',
        emotionalContext: 'Back-to-school creates work-from-home focus — parents setting up home offices and needing reliable power',
        postIdea: 'Show a home office that was tripping breakers constantly — the shared circuit overload, the dedicated circuit install, the before/after stability. Highly relatable.',
        engagementHook: 'Ask: "Does your home office share a circuit with other appliances? Here is how to test it in 60 seconds"',
      },
      9: {
        urgencyTopic: 'Generator installation season — pre-storm install before fall and winter outage risk',
        tipTopic: 'Whole home generator vs portable generator — the honest comparison from a licensed electrician',
        promotionAngle: 'Fall generator installation special — be ready for winter outages, installed and permitted before the storms',
        emotionalContext: 'Proactive anxiety — homeowners who experienced outages last winter are motivated to prepare now',
        postIdea: 'Explain the whole-home generator installation process — transfer switch, gas hookup, panel integration, permit — demystify it so homeowners understand it is a one-day job',
        engagementHook: 'Ask: "How many power outages did you have last winter? How many hours were you without power?" — surfaces generators as the obvious next step',
      },
      10: {
        urgencyTopic: 'Heating season electrical prep — space heater season returning, panel readiness check before winter',
        tipTopic: 'How to safely add space heaters this winter without tripping breakers or starting fires',
        promotionAngle: 'Fall electrical inspection — identify panel and circuit issues before winter increases electrical demand',
        emotionalContext: 'Pre-winter planning mode — motivated homeowners want to avoid last winter is frustrations',
        postIdea: 'Show the load calculation for a typical winter night — TV, laptop, space heaters, lights, refrigerator — and demonstrate why 100-amp service struggles and 200-amp handles it easily',
        engagementHook: 'Ask: "Is your electrical panel ready for winter? Here is the one question that tells you if it is"',
      },
      11: {
        urgencyTopic: 'Holiday lighting overload — November decorating season creating circuit overloads and tripped breakers',
        tipTopic: 'Safe holiday lighting from a licensed electrician — how many lights per circuit and what to never do',
        promotionAngle: 'Pre-holiday electrical check — add dedicated circuits for holiday lighting, no more tripped breakers',
        emotionalContext: 'Holiday excitement mixed with frustration of tripping breakers — entertaining and relatable content season',
        postIdea: 'Show the holiday lighting load calculation — one Clark Griswold level of lights vs what a circuit actually handles — educational, funny, shareable',
        engagementHook: 'Ask: "Is anyone else is breaker tripping every time they plug in the Christmas lights?" — always gets hilarious engagement',
      },
      12: {
        urgencyTopic: 'Holiday electrical safety — overloaded circuits and extension cords causing house fires during peak decoration season',
        tipTopic: 'The holiday electrical safety list every family should read before decorating',
        promotionAngle: '24/7 holiday electrical service — dedicated circuit installs available before Christmas',
        emotionalContext: 'Holiday safety stakes are highest — children, guests, dry Christmas trees, overloaded circuits all converge. Content that protects families gets maximum engagement.',
        postIdea: 'Share the top 5 holiday electrical fire causes — old light sets, overloaded power strips, outdoor lights used indoors, extension cords under rugs, unattended decorations. Make it a shareable safety checklist.',
        engagementHook: 'Post: "Save this before you decorate." with the holiday electrical safety checklist — gets shared every year',
      },
    },

    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],

    trustSignals: [
      'Licensed Master Electrician — [state] license #[number]',
      'Fully insured — $2M liability, workers comp on every tech',
      'All work permitted and inspected — we never skip this step',
      'Up-front flat-rate pricing — you know the cost before we touch anything',
      'All work to current NEC code — not just code when the house was built',
      'Background-checked technicians — we are in your home',
      '100% satisfaction guaranteed — if it does not pass inspection, we make it right',
      'Emergency electrical service — we answer after hours because electrical problems do not wait',
      'Over [X] five-star reviews in [city]',
      'We pull permits — ask any contractor you compare us to if they do the same',
    ],

    localKeywords: [
      '[city] electrician',
      'licensed electrician [city]',
      'electrical panel upgrade [city]',
      'EV charger installation [city]',
      'emergency electrician [city]',
      'electrical contractor [city]',
      'home rewiring [city]',
      'electrical inspection [city]',
      '[city] master electrician',
      'generator installation [city]',
    ],

    hookFormulas: [
      // Safety fear
      'If you smell burning plastic near any outlet or switch plate in your home — stop using it. Here is what it means and what to do right now. ⚡',
      // Panel age
      'What year was your electrical panel installed? Drop it in the comments. Here is what each decade of panel age means for your fire risk.',
      // EV charger
      'Thinking about an EV? Here is what your garage electrical panel needs before the charger can go in — and what it actually costs in [city].',
      // Aluminum wiring
      'Homes built between 1965 and 1973 often have aluminum wiring. Here is the honest risk level — and it is not what most websites say.',
      // Before/after panel
      'Before: 1972 fuse box with double-tapped breakers. After: new 200-amp panel, labeled, permitted, inspected. Same [city] house. Same family. Much safer.',
      // Flickering lights
      'Flickering lights are not always a bulb problem. Here are the 4 causes — ranging from free to fix yourself to call us immediately.',
      // GFCI safety
      'GFCI outlets save lives. Here is exactly where your home is required to have them — and the 3-second test to know if yours are working.',
      // Surge protection value
      'One storm surge destroyed $4,200 in electronics in a [city] home last summer. The whole-home surge protector that would have prevented it cost $200.',
      // Holiday overload
      'The #1 cause of house fires in December — and it is not the candles. It is this. Read before you plug in the holiday lights.',
      // DIY warning
      'This is what a DIY electrical panel looks like when we open it. The homeowner did not know this was dangerous. Here is what to look for in your own panel.',
      // Breaker trips
      'Your breaker is not broken. It is doing its job. Here is what tripping breakers are actually telling you — and when to take it seriously.',
      // Knob and tube
      'Knob and tube wiring in a home you own or are about to buy. Here is what a master electrician actually recommends — not just the scary version.',
      // Generator prep
      'Three power outages last winter in [city]. Here is what whole-home generators actually cost installed — and why more homeowners get them every year.',
      // Warm outlets
      'Outlets and switch plates should never be warm to the touch. If yours are — here is what is happening behind the wall.',
      // Code compliance
      'Pro tip: if an electrician says they will skip the permit to save you money — they are saving themselves money, not you. Here is why permits protect homeowners.',
    ],

    ctaVariations: [
      'Save this electrical safety checklist 🔖',
      'Tag a homeowner who lives in a home built before 1980',
      'Comment your panel year and we will tell you what to watch for',
      'Drop a ⚡ if your breaker has tripped this month',
      'Call [phone] for a free safety evaluation — upfront pricing, no pressure',
      'Book your electrical inspection online — link in bio',
      'DM us your concern and we will tell you if it needs immediate attention',
      'Call [phone] — emergency same-day service available in [city]',
      'Save our number. Electrical problems do not wait for business hours.',
      'Comment "PANEL" and we will DM you our free electrical safety checklist',
    ],

    imageVisuals: {
      keyElements: [
        'electrical panel open — breakers labeled, organized wiring, before/after comparison',
        'GFCI outlet being installed — hands, screwdriver, old non-GFCI outlet next to new one',
        'EV charger mounted on garage wall — clean installation, Level 2 charger, cable hanging',
        'wire colors inside junction box — black hot, white neutral, green ground, neat connections',
        'thermal camera image of hot breaker — bright orange heat signature in panel',
        'before/after panel: chaotic old fuse box vs organized new 200-amp panel with labeled breakers',
        'burned outlet or melted wire — evidence of what happens when warnings are ignored',
        'recessed lighting installation — ceiling cut, housing in place, electrician wiring',
        'conduit run through garage — neat parallel runs, couplings, organized professional work',
        'whole-home surge protector installed at panel — device mounted, wired to main breaker',
      ],
      authenticScenes: [
        'electrician working inside open panel — hands visible routing wires, organized work in progress',
        'before/after panel comparison — same wall, same box opening, messy 1970s chaos vs clean labeled modern panel',
        'EV charger installation: wall mounted, wire run visible, permit posted on adjacent wall',
        'GFCI outlet installation close-up — old outlet removed, new GFCI in box, hands making connections',
        'thermal scan of electrical panel — professional tool showing heat distribution, one breaker glowing orange',
      ],
      avoidCliches: [
        'cartoon lightning bolt or electric plug illustration',
        'generic neon light sign with power symbol',
        'stock photo of electrician smiling with no actual work visible',
        'person in hard hat standing next to electrical equipment posing for camera',
        'generic wire colors on white background — isolated, no context',
      ],
      colorPalette: 'silver and gray panel boxes, black and red wire insulation, clean white junction boxes, orange thermal camera hot spots, garage floor gray with EV charger accent colors',
      composition: 'before/after panel transformation is the signature image — same angle, same box, dramatic difference. EV charger on clean garage wall is aspirational. Close-up of neat wire work shows craft.',
      moodAndLighting: 'utility space lighting — fluorescent garage, basement, or panel room lighting is authentic. For panel work, a headlamp or flashlight beam adds drama. EV charger shots should be brighter and aspirational.',
      seasonalVisuals: {
        winter: 'space heater plugged into extension cord with overloaded power strip — the fire risk made visual, holiday lights on multiple strips daisy-chained',
        spring: 'outdoor GFCI outlet installation, landscape lighting circuit, EV charger install in spring garage',
        summer: 'panel under high load in summer — thermal camera showing heat, generator hookup, surge protector install',
        fall: 'generator transfer switch installation, panel readiness check, holiday lighting circuit addition',
      },
    },
  },

  // ============================================================
  // PAINTING
  // ============================================================
  painting: {
    customerPainPoints: [
      'Interior paint peeling and bubbling throughout the house',
      'Exterior paint fading and chalking after just a few years',
      'Walls showing every scuff, mark, and handprint',
      'New color picked but terrified it will look wrong once on the walls',
      'Previous painter left a messy, streaky, unprofessional job',
      'Wood trim cracking and paint peeling on exterior',
      'Bathroom walls showing mold through the paint',
      'Moving in and cannot live with the previous owner is taste',
      'Rental property needs professional refresh between tenants',
      'Popcorn ceiling that needs to go',
      'Color inconsistency between rooms — does not flow',
      'Cabinet paint bubbling and peeling after amateur refinishing attempt',
      'House on the market — needs fresh paint to sell quickly',
      'Sun-damaged exterior looking old and faded',
      'Water stains on ceiling from old leak — repaired but still visible',
    ],
    seasonalContent: {
      1: { urgencyTopic: 'Interior painting peak season — ideal time with homes sealed up', tipTopic: 'How to choose the perfect paint finish for each room', promotionAngle: 'January interior painting special — winter rates' },
      2: { urgencyTopic: 'Pre-spring interior refresh before the weather opens up', tipTopic: 'The psychology of color — how paint color affects mood at home', promotionAngle: 'February interior refresh special' },
      3: { urgencyTopic: 'Spring exterior prep begins — power washing and priming', tipTopic: 'How to prep your exterior properly for a long-lasting paint job', promotionAngle: 'Spring exterior painting special — book early' },
      4: { urgencyTopic: 'Exterior painting season opens — prime weather approaching', tipTopic: 'What paint temperature requirements mean for your exterior project', promotionAngle: 'April exterior booking special' },
      5: { urgencyTopic: 'Prime exterior painting season — ideal temperatures', tipTopic: 'How to choose the right exterior paint for your climate', promotionAngle: 'May exterior special — best weather of the year' },
      6: { urgencyTopic: 'Full exterior season underway — book while slots are open', tipTopic: 'How many coats of exterior paint does your home actually need?', promotionAngle: 'Summer exterior special — multiple projects discounted' },
      7: { urgencyTopic: 'Deck and fence staining and painting peak season', tipTopic: 'Deck stain vs paint — which is right for your wood?', promotionAngle: 'July deck and fence painting special' },
      8: { urgencyTopic: 'Pre-back-to-school interior refresh', tipTopic: 'Kid-safe, washable paints for high-traffic family areas', promotionAngle: 'August interior refresh special before school year starts' },
      9: { urgencyTopic: 'Fall is second best season for exterior painting', tipTopic: 'Why fall is actually better than summer for exterior painting', promotionAngle: 'Fall exterior special — cooler temps, better results' },
      10: { urgencyTopic: 'Last chance for exterior before temperatures drop', tipTopic: 'The minimum temperature for exterior paint application', promotionAngle: 'October last-chance exterior special' },
      11: { urgencyTopic: 'Pre-holiday interior refresh for hosting season', tipTopic: 'Fast-drying paint options for minimal disruption during holidays', promotionAngle: 'Pre-holiday interior painting special' },
      12: { urgencyTopic: 'Gift of a beautifully painted home for the holidays', tipTopic: 'How to touch up walls quickly for holiday guests', promotionAngle: 'Holiday interior painting special — be ready for guests' },
    },
    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],
    trustSignals: [
      'Licensed and insured painting contractor',
      'Premium paints — Sherwin-Williams and Benjamin Moore',
      'Meticulous surface prep — paint lasts longer',
      'Clean crew — we protect your furniture and floors',
      'Color consultation included on every project',
      'Written warranty on all work',
      'Locally owned — [city] is our community too',
      'Over [X] homes painted in [city]',
      'Before and after photos on every project',
      'On-time, on-budget guarantee',
    ],
    localKeywords: [
      '[city] painting contractor',
      'house painters [city]',
      'interior painting [city]',
      'exterior painting [city]',
      'local painter [city]',
      'cabinet painting [city]',
      'commercial painting [city]',
      'residential painter [city]',
    ],
    hookFormulas: [
      'Did you know the right paint sheen can make a small room look twice as large? 🎨',
      'Most homeowners do not realize surface prep determines 80% of how long paint lasts.',
      'With the exterior painting season approaching, now is the time to book before we fill up.',
      'Just completed this full exterior transformation in [city] — the color change is incredible. 🏡',
      'If your paint is peeling in less than 5 years, here is why.',
      'Stop choosing paint colors by guessing. Here is how professional color consultants do it.',
      'We transformed this [city] home is curb appeal in just 3 days.',
      'Quick question: how old is your exterior paint? Here is what that means.',
      'That bubbling paint on your bathroom wall? Here is what is causing it.',
      'Pro tip from a professional painter: always do this before opening a single can of paint.',
    ],
    ctaVariations: [
      'Save this painting tip for your next project 🔖',
      'Tag someone whose home needs a fresh coat',
      'Comment your painting question — our color experts respond',
      'Drop a 🎨 if you have been putting off your painting project',
      'Call us for a free color consultation and estimate: [phone]',
      'Get your free quote — link in bio',
      'DM us a photo of your space — we will suggest the perfect color palette for free',
      'Call [phone] — spring slots are going fast',
    ],
  },

  // ============================================================
  // PEST CONTROL
  // ============================================================
  pest_control: {
    customerPainPoints: [
      'Mice droppings found in the kitchen cabinets',
      'Termites discovered in the wood trim — complete panic',
      'Ant invasion every spring no matter what we do',
      'Bed bugs from a hotel stay spreading through the house',
      'Wasp nest built in the eaves — family cannot use the backyard',
      'Cockroaches appearing in the kitchen despite keeping it clean',
      'Spider infestation in the basement and garage',
      'Squirrels getting into the attic and chewing wires',
      'Mosquitoes making the backyard unusable all summer',
      'Raccoons tipping over trash cans every night',
      'Tick problem in the yard — worried about Lyme disease',
      'Flea infestation after adopting a pet',
      'Carpenter ants destroying the deck',
      'Fruit fly explosion in the kitchen despite no visible source',
      'Stink bugs getting into the house by the dozens in fall',
    ],
    seasonalContent: {
      1: { urgencyTopic: 'Rodents seeking warmth inside during winter cold', tipTopic: 'How to seal your home against winter rodent entry', promotionAngle: 'Winter rodent exclusion special — keep them out for good' },
      2: { urgencyTopic: 'Late winter rodent activity peak — they are breeding', tipTopic: 'Signs you have a mouse problem before it becomes an infestation', promotionAngle: 'February rodent control special' },
      3: { urgencyTopic: 'Spring pest emergence — ant and termite swarm season begins', tipTopic: 'Spring pest prevention checklist every homeowner needs', promotionAngle: 'Spring pest prevention package — stop them before they start' },
      4: { urgencyTopic: 'Termite swarm season — the most important inspection of the year', tipTopic: 'How to tell the difference between termites and flying ants', promotionAngle: 'Free termite inspection — April is peak swarm month' },
      5: { urgencyTopic: 'Mosquito season begins — yard treatment time', tipTopic: 'How mosquito yard treatments work and how long they last', promotionAngle: 'May mosquito season kickoff package' },
      6: { urgencyTopic: 'Peak mosquito and tick season — outdoor protection', tipTopic: 'Tick prevention for families with kids and pets', promotionAngle: 'Summer mosquito and tick yard protection package' },
      7: { urgencyTopic: 'Wasp and hornet nests peak in July — dangerous now', tipTopic: 'Why you should never try to remove a wasp nest yourself', promotionAngle: 'Wasp and hornet removal special — safe and guaranteed' },
      8: { urgencyTopic: 'Late summer ant invasion surge before fall', tipTopic: 'Why ants invade in August and how to stop them', promotionAngle: 'Late summer ant control special' },
      9: { urgencyTopic: 'Stink bug and spider invasion season — fall entry points', tipTopic: 'How to seal your home against fall pest invasion', promotionAngle: 'Fall pest prevention package — seal before the invasion' },
      10: { urgencyTopic: 'Rodent season begins again — mice looking for winter warmth', tipTopic: 'The 5 entry points mice use to get into your home every fall', promotionAngle: 'Fall rodent exclusion special — before they move in' },
      11: { urgencyTopic: 'Winter pest prevention — seal tight before the holidays', tipTopic: 'Holiday pest prevention — keeping your home pest-free for guests', promotionAngle: 'Pre-holiday pest treatment and exclusion package' },
      12: { urgencyTopic: 'Winter rodent activity — do not let them spend winter inside', tipTopic: 'Signs mice are in your walls this winter', promotionAngle: 'Holiday pest emergency service — we are always available' },
    },
    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],
    trustSignals: [
      'Licensed and certified pest control professionals',
      'Pet and family safe treatments',
      'Guaranteed results — free re-treatment if pests return',
      'Eco-friendly treatment options available',
      'State-licensed applicators',
      'Serving [city] since [year]',
      'Same-day service available',
      'No contracts required',
      'BBB accredited',
      'Over [X] homes protected in [city]',
    ],
    localKeywords: [
      '[city] pest control',
      'exterminator [city]',
      'termite inspection [city]',
      'mosquito control [city]',
      'rodent control [city]',
      'pest control near me [city]',
      'bed bug treatment [city]',
      'ant control [city]',
    ],
    hookFormulas: [
      'Did you know termite damage costs US homeowners over $5 billion per year — and most insurance does not cover it? 🐛',
      'Most homeowners do not realize mice can fit through a hole the size of a dime.',
      'With spring arriving, pest season is starting — are you protected?',
      'Just eliminated a severe termite infestation in a [city] home before it caused structural damage. 🏠',
      'If you have seen one mouse, there are likely 10 more you have not seen.',
      'Stop buying store-bought traps that never work. Here is what actually eliminates the problem.',
      'We protected this [city] family from a mosquito-borne illness risk this summer.',
      'Quick question for [city] homeowners: when did you last have a termite inspection?',
      'Those ant trails in your kitchen? Here is what they are actually telling you.',
      'Pro tip from a licensed exterminator: this one habit is why pests keep coming back.',
    ],
    ctaVariations: [
      'Save this pest prevention tip 🔖',
      'Tag a neighbor who has dealt with this same pest',
      'Comment your pest problem — our licensed techs respond',
      'Drop a 🐛 if ants invade your home every spring',
      'Call us for a free inspection: [phone]',
      'Book your pest inspection online — link in bio',
      'DM us your pest problem — we will tell you exactly what you are dealing with',
      'Call [phone] — same-day service available',
    ],
  },

  // ============================================================
  // GENERAL CONTRACTOR
  // ============================================================
  general_contractor: {
    customerPainPoints: [
      'Renovation project started by previous contractor left unfinished',
      'Cannot find a reliable contractor who shows up when they say they will',
      'Got three quotes and have no idea which to trust',
      'Home addition needs permits but do not know where to start',
      'Kitchen or bathroom gut renovation feeling overwhelming',
      'Storm damage requiring structural repairs',
      'Old home with outdated everything — do not know what to tackle first',
      'Investment property needs full renovation on a budget',
      'HOA requiring specific exterior updates with short deadline',
      'Basement finishing project stalled for years',
      'Home inspection revealed major issues before closing',
      'Contractor took deposit and disappeared',
      'Renovation going way over budget and still not done',
      'House flip with multiple trades to coordinate',
      'Aging parent is home needing accessibility modifications',
    ],
    seasonalContent: {
      1: { urgencyTopic: 'Interior renovation prime season — no outdoor distractions', tipTopic: 'How to plan a home renovation without losing your mind', promotionAngle: 'January interior renovation planning consultation' },
      2: { urgencyTopic: 'Spring exterior project planning and permitting', tipTopic: 'How long does a permit take and when to start the process', promotionAngle: 'Free spring project consultation — plan before the rush' },
      3: { urgencyTopic: 'Spring exterior work begins — additions and major work', tipTopic: 'How to vet a general contractor the right way', promotionAngle: 'Spring project kickoff special' },
      4: { urgencyTopic: 'Full renovation season open — book immediately', tipTopic: 'What to expect during a major home renovation timeline', promotionAngle: 'Spring renovation special — book now for summer completion' },
      5: { urgencyTopic: 'Exterior additions and major structural work prime season', tipTopic: 'How to live in your home during a major renovation', promotionAngle: 'Summer project special — complete before fall' },
      6: { urgencyTopic: 'Mid-renovation season — schedule is filling up', tipTopic: 'Change order management — how to keep your renovation on budget', promotionAngle: 'Summer renovation package — all trades coordinated by us' },
      7: { urgencyTopic: 'Outdoor living space construction peak season', tipTopic: 'ROI on home renovations — which projects pay you back?', promotionAngle: 'Outdoor living construction special' },
      8: { urgencyTopic: 'Back-to-school timing — get home improvements done now', tipTopic: 'Projects to complete before winter while weather allows', promotionAngle: 'Fall project kickoff — beat the winter rush' },
      9: { urgencyTopic: 'Fall is second peak season for exterior work', tipTopic: 'The renovation projects that add the most value before winter', promotionAngle: 'Fall renovation special — before the weather turns' },
      10: { urgencyTopic: 'Weatherproofing and structural repairs before winter', tipTopic: 'End of season exterior checklist for homeowners', promotionAngle: 'Pre-winter weatherproofing package' },
      11: { urgencyTopic: 'Interior renovation season begins again — book December-February work', tipTopic: 'Planning your 2026 renovation projects now', promotionAngle: 'Holiday booking special — lock in 2026 pricing now' },
      12: { urgencyTopic: 'Plan 2026 projects and secure your spot in our schedule', tipTopic: 'How to budget for a major home renovation', promotionAngle: 'Year-end consultation special — plan your 2026 renovation now' },
    },
    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],
    trustSignals: [
      'Licensed general contractor — [license number on request]',
      'Fully bonded and insured — $2M liability',
      'We pull all permits and handle all inspections',
      'Established relationships with all trades',
      'Written contracts with detailed scope of work',
      'No deposit over 10% — we earn your trust',
      'Serving [city] since [year]',
      'Over [X] completed projects in [city]',
      'References available from every recent project',
      'On-time and on-budget track record',
    ],
    localKeywords: [
      '[city] general contractor',
      'home renovation [city]',
      'home remodeling [city]',
      'contractor near me [city]',
      'kitchen remodel [city]',
      'bathroom renovation [city]',
      'home addition [city]',
      'licensed contractor [city]',
    ],
    hookFormulas: [
      'Did you know 60% of homeowners regret choosing the cheapest contractor bid? 🏠',
      'Most homeowners do not realize a permit-less renovation can void your homeowner is insurance.',
      'With spring approaching, now is the time to plan that renovation you have been putting off.',
      'Just completed this full home renovation in [city] — the transformation took 90 days. Before and after below. 🔨',
      'If a contractor asks for more than 10% upfront — walk away. Here is why.',
      'Stop putting off your renovation. Here is a realistic timeline and budget for the project you have been dreaming about.',
      'We took this [city] home from dated and tired to completely transformed.',
      'Quick question: how long have you been putting off that renovation project?',
      'That crack in your foundation wall? Here is when it is serious and when it is not.',
      'Pro tip from 20 years of general contracting: always do this before signing any contract.',
    ],
    ctaVariations: [
      'Save this renovation advice for when you need it 🔖',
      'Tag a homeowner who has been putting off their renovation',
      'Comment your renovation question — we answer everything honestly',
      'Drop a 🏡 if your home needs some serious love',
      'Call us for a free consultation: [phone]',
      'Book your free project consultation — link in bio',
      'DM us your project idea — we will give you a realistic ballpark for free',
      'Call [phone] — limited spring slots remaining',
    ],
  },

  // ============================================================
  // CLEANING
  // ============================================================
  cleaning: {
    customerPainPoints: [
      'Never enough time to keep the house consistently clean',
      'Previous cleaning service did a terrible, rushed job',
      'Moving out and need a spotless clean for deposit return',
      'Just moved in and previous owners left it filthy',
      'Airbnb or rental property needs professional turnover cleaning',
      'Post-renovation dust and debris covering everything',
      'Spring cleaning feels overwhelming — do not know where to start',
      'Holiday guests arriving and house is not ready',
      'Deep cleaning the kitchen — grease built up for years',
      'Bathroom grout black with mold despite regular cleaning',
      'Office or commercial space needs professional regular service',
      'Hoarding situation requiring specialty clean-out support',
      'Elderly parent is home needs regular help maintaining cleanliness',
      'Allergies made worse by dust and pet dander at home',
      'Toddler and pets making it impossible to stay on top of cleaning',
    ],
    seasonalContent: {
      1: { urgencyTopic: 'New Year deep clean and organization reset', tipTopic: 'How to do a proper deep clean to start the year fresh', promotionAngle: 'New Year deep clean special — fresh start for your home' },
      2: { urgencyTopic: 'Valentine is and pre-spring cleaning push', tipTopic: 'The rooms most people forget during regular cleaning', promotionAngle: 'February deep clean special — treat yourself' },
      3: { urgencyTopic: 'Spring cleaning season — the most in-demand month of the year', tipTopic: 'The ultimate spring cleaning checklist — room by room', promotionAngle: 'Spring deep clean special — book early before we fill up' },
      4: { urgencyTopic: 'Peak spring cleaning season — limited availability', tipTopic: 'How to maintain a clean home between professional cleanings', promotionAngle: 'April spring cleaning special — our most popular month' },
      5: { urgencyTopic: 'Pre-summer refresh as families spend more time home', tipTopic: 'How to keep a clean home with kids out of school for summer', promotionAngle: 'Pre-summer home refresh package' },
      6: { urgencyTopic: 'Summer maintenance cleaning — high traffic season', tipTopic: 'Summer cleaning hacks for busy families', promotionAngle: 'Summer recurring cleaning service — weekly or biweekly' },
      7: { urgencyTopic: 'Mid-summer deep clean — sand, sunscreen, and summer mess', tipTopic: 'How to get summer stains out of everything', promotionAngle: 'July mid-summer deep clean special' },
      8: { urgencyTopic: 'Pre-back-to-school whole-home reset', tipTopic: 'Back to school cleaning routine for busy families', promotionAngle: 'August home reset package before school starts' },
      9: { urgencyTopic: 'Fall deep clean before the home seals up for winter', tipTopic: 'Fall cleaning checklist — preparing your home for indoor season', promotionAngle: 'Fall deep clean special — get ready for indoor season' },
      10: { urgencyTopic: 'Pre-holiday cleaning push begins', tipTopic: 'How to get your home holiday-ready without the stress', promotionAngle: 'October pre-holiday cleaning package' },
      11: { urgencyTopic: 'Pre-Thanksgiving and holiday deep clean season', tipTopic: 'The areas guests always notice first — are they clean?', promotionAngle: 'Pre-holiday deep clean special — be guest-ready' },
      12: { urgencyTopic: 'Holiday hosting cleaning — before and after service', tipTopic: 'How to keep your home clean through the holiday chaos', promotionAngle: 'Holiday cleaning package — before and after events' },
    },
    contentThemes: ['before_after', 'educational_tip', 'customer_testimonial', 'team_spotlight', 'seasonal_warning', 'faq_busting', 'community_involvement', 'project_showcase'],
    trustSignals: [
      'Bonded and insured cleaning professionals',
      'Background-checked team members',
      'Eco-friendly and non-toxic products available',
      'Satisfaction guarantee — we come back if anything is missed',
      'Consistent team — same cleaners each visit',
      'Serving [city] homes since [year]',
      'Over [X] happy [city] clients',
      'Flexible scheduling — including weekends',
      'No long-term contracts required',
      'Locally owned — not a franchise',
    ],
    localKeywords: [
      '[city] cleaning service',
      'house cleaning [city]',
      'maid service [city]',
      'deep cleaning [city]',
      'move out cleaning [city]',
      'cleaning company near me [city]',
      'Airbnb cleaning [city]',
      'commercial cleaning [city]',
    ],
    hookFormulas: [
      'Did you know the average home collects 40 pounds of dust per year? 🧹',
      'Most homeowners do not realize how much time they spend each week trying to keep up with cleaning.',
      'With spring arriving, now is the perfect time for a full reset deep clean.',
      'Just completed a full move-in deep clean in [city] — this home went from this to that in one day. ✨',
      'If your cleaning service rushes through in under 2 hours — here is what they are skipping.',
      'Stop spending your weekends cleaning. Here is what professional service actually costs per month.',
      'We transformed this [city] home from post-renovation disaster to spotless in 4 hours.',
      'Quick question for [city] homeowners: when did your last truly clean your oven?',
      'That grout color is not supposed to be dark gray. Here is what it actually looks like clean.',
      'Pro tip: this is the one cleaning task that makes the biggest visual difference in any home.',
    ],
    ctaVariations: [
      'Save this cleaning tip for the weekend 🔖',
      'Tag someone whose house could use this',
      'Comment your biggest cleaning challenge — we have a solution',
      'Drop a 🧹 if you are overdue for a deep clean',
      'Call us for a free estimate: [phone]',
      'Book your cleaning online in 60 seconds — link in bio',
      'DM us your space size and we will give you an instant quote',
      'Call [phone] — first-time client discount available this week',
    ],
  },

};

module.exports = industryKnowledge;
