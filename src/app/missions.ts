import type { MissionDefinition } from '../domain/missions';

/**
 * The first authored communicative journey.
 *
 * These are sequencing records over passages the pack already owns. Adding a
 * mission never creates a second copy of a sentence and never stores an
 * exercise. A future pack-supplied curriculum can implement the same shape.
 */
export const MISSIONS: readonly MissionDefinition[] = [
  /**
   * The first mission is the one an adult actually needs first, and "hello,
   * how are you, goodbye" is not it: that exchange is over in four turns and
   * leaves you standing there. So the four greeting dialogues carry on past
   * the wellbeing answer into the conversation that really happens — where you
   * are from, where you live now, whether you like it, what you do, what you
   * do with your time — and every one of those moves has a palette of natural
   * alternatives behind it rather than one prescribed sentence.
   *
   * The asking palettes are the half that makes it a conversation. A learner
   * who can only answer is still being interviewed.
   */
  {
    id: 'greet-and-respond',
    language: 'es',
    level: 'a1',
    order: 0,
    title: 'Meet someone and keep talking',
    goal: 'Greet someone, say where you are from and what you do, ask them back, and keep the conversation going.',
    passage: '700033',
    transfers: [
      {
        passage: '700034',
        support: 'guided',
        brief: 'A friend you do not know well yet — work, the weekend, and where you are from.',
      },
      {
        passage: '700035',
        support: 'guided',
        brief: 'The same conversation at work, in usted throughout.',
      },
      {
        passage: '700036',
        support: 'independent',
        brief: 'Meet a new neighbour and do the asking yourself, from intention cues.',
      },
    ],
    capabilities: [
      'greet-someone',
      'respond-to-wellbeing',
      'ask-about-origin',
      'say-where-youre-from',
      'say-where-you-are-based',
      'say-if-you-like-a-place',
      'ask-what-someone-does',
      'say-what-you-do',
      'ask-about-free-time',
      'talk-about-free-time',
      'close-friendly-exchange',
    ],
    responsePalettes: [
      {
        id: 'wellbeing-answer',
        capability: 'respond-to-wellbeing',
        title: 'More than “I’m fine”',
        cue: 'Answer naturally according to how you feel. Add “¿Y tú?” or “¿Y usted?” when it fits.',
        initiallyVisible: 3,
        responses: [
          { item: '000709', nuance: 'Neutral and dependable' },
          { item: '000728', nuance: 'Enthusiastic and very positive' },
          { item: '000729', nuance: 'Casual and concise' },
          { item: '000730', nuance: 'Positive, but understated' },
          { item: '000731', nuance: 'So-so; neither good nor bad' },
          { item: '000732', nuance: 'Things could be better' },
          { item: '000791', nuance: 'A little tired · masculine speaker' },
          { item: '000733', nuance: 'Tired · feminine speaker' },
          { item: '000734', nuance: 'A gently softened sad answer' },
          { item: '000735', nuance: 'Clearly not doing well' },
        ],
      },
      {
        id: 'origin-answer',
        capability: 'say-where-youre-from',
        title: 'Where you are from — and where you live',
        cue: 'Name the country, the city, or your nationality. Add where you live now when the two differ.',
        initiallyVisible: 3,
        responses: [
          { item: '001015', nuance: 'The shortest complete answer' },
          { item: '000986', nuance: 'From one place, living in another' },
          { item: '001016', nuance: 'Nationality first, then the city' },
          { item: '001017', nuance: 'Places an unknown town next to a known one' },
          { item: '001018', nuance: 'Your family’s origin, not your own' },
          { item: '001019', nuance: 'Where you were born, with nací' },
          { item: '001020', nuance: 'For when you have moved away' },
          { item: '001021', nuance: 'When the place needs no name' },
        ],
      },
      {
        id: 'living-here',
        capability: 'say-where-you-are-based',
        title: 'Do you live here?',
        cue: 'Say the country, the city, the area or how long — whichever the question is really asking.',
        initiallyVisible: 3,
        responses: [
          { item: '001022', nuance: 'How long, with desde hace' },
          { item: '001023', nuance: 'Living here, working elsewhere' },
          { item: '001024', nuance: 'Only visiting' },
          { item: '001025', nuance: 'Answers with a distance' },
          { item: '000862', nuance: 'Living here, from somewhere else' },
          { item: '000857', nuance: 'The area and the kind of home' },
          { item: '000859', nuance: 'Outside the city' },
          { item: '000864', nuance: 'How long in the same place' },
        ],
      },
      {
        id: 'place-feelings',
        capability: 'say-if-you-like-a-place',
        title: 'Do you like it here?',
        cue: 'Say yes, no or partly — and give the reason. A bare “sí” ends the conversation.',
        initiallyVisible: 3,
        responses: [
          { item: '000988', nuance: 'Yes, with a reason about the people' },
          { item: '001026', nuance: 'Warmer than me gusta' },
          { item: '001027', nuance: 'Positive, with an honest reservation' },
          { item: '001028', nuance: 'Describes the place, not your feeling' },
          { item: '001029', nuance: 'Says what living there costs you' },
          { item: '001030', nuance: 'Honest and negative, without rudeness' },
          { item: '001031', nuance: 'A clear no, with a reason' },
          { item: '001032', nuance: 'Two concrete reasons' },
        ],
      },
      {
        id: 'what-you-do',
        capability: 'say-what-you-do',
        title: 'What you do',
        cue: 'Name the job, or the place, or who you do it with — whatever is true today.',
        initiallyVisible: 3,
        responses: [
          { item: '000990', nuance: 'The job, then where' },
          { item: '000849', nuance: 'The job before the place' },
          { item: '000850', nuance: 'Adds who you work with' },
          { item: '000851', nuance: 'For someone studying as well' },
          { item: '000852', nuance: 'Where rather than what' },
          { item: '000853', nuance: 'Honest, when you are between jobs' },
          { item: '000854', nuance: 'Adds how near it is' },
          { item: '000855', nuance: 'Says more than the question asked' },
          { item: '000856', nuance: 'A precise job · feminine speaker' },
        ],
      },
      {
        id: 'free-time',
        capability: 'talk-about-free-time',
        title: 'What you do with your time',
        cue: 'One activity is enough. Adding how often, when or who with is what keeps it going.',
        initiallyVisible: 3,
        responses: [
          { item: '000994', nuance: 'Two activities at once' },
          { item: '001033', nuance: 'Calm and dependable' },
          { item: '001034', nuance: 'Adds how often' },
          { item: '001035', nuance: 'Says who with, and when' },
          { item: '001036', nuance: 'A quiet answer, and a common one' },
          { item: '001037', nuance: 'Something you do for other people' },
          { item: '001038', nuance: 'Says where, and when' },
          { item: '001039', nuance: 'Honest, when the true answer is none' },
        ],
      },
      {
        id: 'asking-origin',
        capability: 'ask-about-origin',
        title: 'Asking where they are from',
        cue: 'Ask back. Pick the tú or usted form to match how they spoke to you.',
        initiallyVisible: 2,
        responses: [
          { item: '000008', nuance: 'The plain question' },
          { item: '001040', nuance: 'Returns the question' },
          { item: '001041', nuance: 'A yes-or-no opening' },
          { item: '001042', nuance: 'When you already know the country' },
          { item: '001043', nuance: 'The formal version' },
          { item: '001044', nuance: 'Where they live, not where they began' },
          { item: '001045', nuance: 'Asks how long' },
          { item: '001046', nuance: 'Widens it to their family' },
        ],
      },
      {
        id: 'asking-what-they-do',
        capability: 'ask-what-someone-does',
        title: 'Asking what they do',
        cue: 'Ask about the job, the place or the hours. Any of them opens the same subject.',
        initiallyVisible: 2,
        responses: [
          { item: '000989', nuance: 'The everyday question' },
          { item: '001047', nuance: 'The most common way to ask' },
          { item: '000105', nuance: 'The place rather than the job' },
          { item: '001048', nuance: 'Natural with someone younger' },
          { item: '001049', nuance: 'Moves to how they feel about it' },
          { item: '001050', nuance: 'The formal version' },
          { item: '001051', nuance: 'Asks about the schedule' },
          { item: '001052', nuance: 'Keeps it going without repeating yourself' },
        ],
      },
      {
        id: 'asking-free-time',
        capability: 'ask-about-free-time',
        title: 'Asking about their time',
        cue: 'The question that turns an exchange of facts into a conversation.',
        initiallyVisible: 2,
        responses: [
          { item: '000992', nuance: 'The open question' },
          { item: '001053', nuance: 'Open, and easy to answer' },
          { item: '001054', nuance: 'A yes-or-no that always goes somewhere' },
          { item: '001055', nuance: 'Anchored in time' },
          { item: '001056', nuance: 'For a livelier conversation' },
          { item: '001057', nuance: 'The formal version' },
          { item: '001058', nuance: 'Names one activity and asks about it' },
          { item: '001059', nuance: 'Offers two, so they can pick' },
        ],
      },
    ],
    spotlight: 6,
    estimatedMinutes: 18,
    learnerSpeaker: 'Luis',
    scenarioPartner: 'the other person',
  },
  /**
   * The mission that rescues all the others.
   *
   * Every other journey here assumes the exchange goes to plan. In a real one it
   * does not: the answer comes back at full speed, with a word you have never
   * met, and the learner's own three months of vocabulary are no help at all.
   * These are the moves that buy another attempt — and they are the same four
   * whether the room is a shop, a street, a classroom or a meeting, which is why
   * this sits second rather than in whichever domain it was written for.
   *
   * Five of its palette entries are phrases the pack already shipped and nothing
   * pointed at: `¿Puedes repetir, por favor?` has been in `sentences-core` since
   * the beginning. A mission is sequencing, so gathering them costs no content.
   */
  {
    id: 'make-yourself-understood',
    language: 'es',
    level: 'a1',
    order: 1,
    title: 'Make yourself understood',
    goal: 'Say you have not understood, ask for it again or slower, find the word you need, and check you got it right.',
    passage: '700058',
    transfers: [
      {
        passage: '700059',
        support: 'guided',
        brief: 'Directions you cannot follow. Slow the other person down instead of guessing.',
      },
      {
        passage: '700060',
        support: 'guided',
        brief: 'In class, in tú, where the word itself is the problem.',
      },
      {
        passage: '700061',
        support: 'independent',
        brief: 'An address you cannot afford to get wrong. Get it in writing.',
      },
    ],
    capabilities: [
      'say-you-did-not-understand',
      'ask-to-repeat',
      'ask-to-slow-down',
      'check-you-were-understood',
    ],
    responsePalettes: [
      {
        id: 'not-understanding',
        capability: 'say-you-did-not-understand',
        title: 'Say it before you nod',
        cue: 'Nodding buys you nothing. Say which part failed — the sentence, one word, or the speed.',
        initiallyVisible: 3,
        responses: [
          { item: '001114', nuance: 'Have this one ready before any other' },
          { item: '001115', nuance: 'Softer: you caught some of it' },
          { item: '001116', nuance: 'The shortest, and very common' },
          { item: '001117', nuance: 'Explains why, so they adjust' },
          { item: '001118', nuance: 'One word, not the whole sentence' },
          { item: '001119', nuance: 'Useful at the start of a conversation' },
          { item: '001120', nuance: 'Asks for patience without demanding it' },
          { item: '001067', nuance: 'The full move: name it, then ask' },
        ],
      },
      {
        id: 'asking-again',
        capability: 'ask-to-repeat',
        title: 'Ask for it again',
        cue: 'Ask for the part you missed rather than the whole thing — you will get a clearer answer.',
        initiallyVisible: 3,
        responses: [
          { item: '001121', nuance: 'The dependable formal one' },
          { item: '000014', nuance: 'The same request in tú' },
          { item: '000405', nuance: 'Short, and works everywhere' },
          { item: '001122', nuance: 'Formal, for the whole sentence' },
          { item: '001123', nuance: 'Asks for the part you missed' },
          { item: '001124', nuance: 'Numbers are what gets missed most' },
          { item: '001125', nuance: 'For a noisy street or a bad line' },
          { item: '001085', nuance: 'Names which part to repeat' },
        ],
      },
      {
        id: 'slower-please',
        capability: 'ask-to-slow-down',
        title: 'Ask them to slow down',
        cue: 'Speed is the usual problem, not vocabulary. Asking for less is easier to grant.',
        initiallyVisible: 3,
        responses: [
          { item: '000015', nuance: 'Three words, and the most useful three there are' },
          { item: '001126', nuance: 'A full formal request' },
          { item: '001127', nuance: 'The same in tú' },
          { item: '001128', nuance: 'Puts it on your ear, not their speech' },
          { item: '001129', nuance: 'Asks for less, so it is easier to grant' },
          { item: '001130', nuance: 'When the problem is thinking, not hearing' },
          { item: '001131', nuance: 'When a whole sentence is too much at once' },
          { item: '001069', nuance: 'Slower, plus the reason why' },
        ],
      },
      {
        id: 'finding-a-word',
        capability: 'ask-for-a-word',
        title: 'Find the word you are missing',
        cue: 'You do not need the word. You need a way to ask for it without leaving Spanish.',
        initiallyVisible: 3,
        responses: [
          { item: '000017', nuance: 'The question that gets you unstuck' },
          { item: '001132', nuance: 'While pointing at something written' },
          { item: '001133', nuance: 'Says what is missing, and invites help' },
          { item: '001134', nuance: 'Asks for a simpler word, not the same one' },
          { item: '001135', nuance: 'When you can point at it' },
          { item: '001136', nuance: 'Buys a moment and keeps your turn' },
          { item: '001137', nuance: 'Checks a word you have guessed' },
          { item: '001071', nuance: 'Names the word you are asking about' },
        ],
      },
      {
        id: 'what-does-it-mean',
        capability: 'ask-what-something-means',
        title: 'Ask what it means',
        cue: 'An example is usually clearer than a definition. Ask for whichever you can use.',
        initiallyVisible: 3,
        responses: [
          { item: '000016', nuance: 'The plain question' },
          { item: '001138', nuance: 'Bare, when the word is obvious from context' },
          { item: '001139', nuance: 'For a word they said, not one you can see' },
          { item: '001140', nuance: 'A statement, when a question would interrupt' },
          { item: '001141', nuance: 'Asks for an explanation, not a translation' },
          { item: '001142', nuance: 'Often clearer than a definition' },
          { item: '001143', nuance: 'Narrows it down when nothing else works' },
          { item: '001093', nuance: 'Points at it and asks in three words' },
        ],
      },
      {
        id: 'checking-you-got-it',
        capability: 'check-you-were-understood',
        title: 'Check before you act on it',
        cue: 'Say the detail back. A wrong day or a wrong number costs more than the question does.',
        initiallyVisible: 3,
        responses: [
          { item: '001144', nuance: 'Add it after repeating what you heard' },
          { item: '001145', nuance: 'Lighter, and very common' },
          { item: '001146', nuance: 'Puts the doubt on you rather than them' },
          { item: '001147', nuance: 'The other direction: did your Spanish land' },
          { item: '001148', nuance: 'Formal, and useful at work' },
          { item: '001149', nuance: 'Announces the read-back so it is not doubt' },
          { item: '001150', nuance: 'Reads back the detail that matters' },
          { item: '001111', nuance: 'The whole detail, then the check' },
        ],
      },
      {
        id: 'in-writing',
        capability: 'ask-it-in-writing',
        title: 'Get it in writing',
        cue: 'An address or a time heard once is lost. Reading is far easier than listening.',
        initiallyVisible: 3,
        responses: [
          { item: '001151', nuance: 'An address heard once is an address lost' },
          { item: '001152', nuance: 'For a phone number or a price' },
          { item: '001153', nuance: 'For an appointment' },
          { item: '001154', nuance: 'A street name is hard to hear, easy to read' },
          { item: '001155', nuance: 'You do the writing, and they wait' },
          { item: '001156', nuance: 'Prices in a foreign language go by fast' },
          { item: '001157', nuance: 'The tú version, for a friend or classmate' },
          { item: '001077', nuance: 'Names exactly which detail to write' },
        ],
      },
    ],
    spotlight: 1,
    estimatedMinutes: 14,
    learnerSpeaker: 'Luis',
    scenarioPartner: 'the other person',
  },
  {
    id: 'cafe-order',
    language: 'es',
    level: 'a1',
    order: 2,
    title: 'Order at a café',
    goal: 'Order a drink, add something else and understand the price.',
    passage: '700009',
    transfers: [
      {
        passage: '700015',
        support: 'guided',
        brief: 'Order a different drink and respond when the waiter suggests an extra.',
      },
      {
        passage: '700021',
        support: 'guided',
        brief: 'Change the order, decline one option and ask for the new total.',
      },
      {
        passage: '700022',
        support: 'independent',
        brief: 'Handle a breakfast order from intention cues, without a line-by-line script.',
      },
    ],
    capabilities: [
      'order-food-drink',
      'handle-add-on',
      'ask-understand-price',
      'close-service-exchange',
    ],
    responsePalettes: [
      {
        id: 'cafe-order-choice',
        capability: 'order-food-drink',
        title: 'Build the order you actually want',
        cue: 'Order a drink naturally. Change the drink, milk, sugar or quantity to fit your choice.',
        initiallyVisible: 3,
        responses: [
          { item: '000739', nuance: 'Short, polite and direct' },
          { item: '000740', nuance: 'A dependable full request with quiero' },
          { item: '000741', nuance: 'Natural when ordering in a group' },
          { item: '000742', nuance: 'A common way to make your choice' },
          { item: '000743', nuance: 'A minimal everyday order' },
          { item: '000744', nuance: 'Remove an ingredient with sin' },
          { item: '000745', nuance: 'Add a preference with pero' },
          { item: '000746', nuance: 'Leave room to order more later' },
        ],
      },
    ],
    spotlight: 1,
    estimatedMinutes: 10,
    learnerSpeaker: 'Cliente',
    scenarioPartner: 'the waiter',
  },
  {
    id: 'ask-directions',
    language: 'es',
    level: 'a1',
    order: 3,
    title: 'Ask for directions',
    goal: 'Ask where a place is and follow a short answer.',
    passage: '700011',
    transfers: [
      {
        passage: '700016',
        support: 'guided',
        brief: 'Find a different place and check how far away it is.',
      },
      {
        passage: '700023',
        support: 'guided',
        brief: 'Ask for the museum and follow a route with two landmarks.',
      },
      {
        passage: '700024',
        support: 'independent',
        brief: 'Find a bus stop from intention cues and confirm the distance.',
      },
    ],
    capabilities: [
      'ask-for-directions',
      'follow-simple-directions',
      'check-distance',
      'thank-for-help',
    ],
    responsePalettes: [
      {
        id: 'directions-destination',
        capability: 'ask-for-directions',
        title: 'More than one way to ask the way',
        cue: 'Ask for the place or route you need. Choose a direct, indirect or destination-first question.',
        initiallyVisible: 3,
        responses: [
          { item: '000747', nuance: 'Polite and direct' },
          { item: '000748', nuance: 'Slightly more formal with disculpe' },
          { item: '000749', nuance: 'Put the courtesy at the end' },
          { item: '000750', nuance: 'State what you are looking for' },
          { item: '000751', nuance: 'Soften the request with an indirect question' },
          { item: '000752', nuance: 'Ask for a route, not only a location' },
          { item: '000753', nuance: 'Check whether a known place is nearby' },
          { item: '000754', nuance: 'Explain the destination, then ask which way' },
        ],
      },
    ],
    spotlight: 0,
    estimatedMinutes: 9,
    learnerSpeaker: 'Turista',
    scenarioPartner: 'a local person',
  },
  {
    id: 'shop-clothes',
    language: 'es',
    level: 'a1',
    order: 4,
    title: 'Shop for clothes',
    goal: 'Ask for help, choose an item and handle the fitting-room exchange.',
    passage: '700010',
    transfers: [
      {
        passage: '700017',
        support: 'guided',
        brief: 'Choose a different item, size and colour.',
      },
      {
        passage: '700025',
        support: 'guided',
        brief: 'Ask for trousers, try them on and decide whether to buy them.',
      },
      {
        passage: '700026',
        support: 'independent',
        brief: 'Handle a shoe purchase from intention cues, including size and price.',
      },
    ],
    capabilities: [
      'seek-clothing-item',
      'handle-clothing-size',
      'ask-to-try-on',
      'choose-clothing-purchase',
      'ask-understand-item-price',
    ],
    responsePalettes: [
      {
        id: 'clothing-request',
        capability: 'seek-clothing-item',
        title: 'Shop by item, colour, fit or purpose',
        cue: 'Tell the assistant what you need—or politely say that you are only looking.',
        initiallyVisible: 3,
        responses: [
          { item: '000755', nuance: 'Name an item and colour' },
          { item: '000756', nuance: 'Use quiero for a direct choice' },
          { item: '000757', nuance: 'Use necesito when it is a need' },
          { item: '000758', nuance: 'Use estoy buscando for an ongoing search' },
          { item: '000759', nuance: 'Keep the item and change its colour' },
          { item: '000760', nuance: 'Ask for a different fit' },
          { item: '000761', nuance: 'Politely decline help' },
          { item: '000762', nuance: 'Describe quality and purpose instead of an item' },
        ],
      },
    ],
    spotlight: 1,
    estimatedMinutes: 11,
    learnerSpeaker: 'Cliente',
    scenarioPartner: 'the shop assistant',
  },
  {
    id: 'hotel-check-in',
    language: 'es',
    level: 'a1',
    order: 5,
    title: 'Check into a hotel',
    goal: 'Confirm a reservation and understand the essential check-in details.',
    passage: '700012',
    transfers: [
      {
        passage: '700018',
        support: 'guided',
        brief: 'Check in for a different stay and locate another hotel facility.',
      },
      {
        passage: '700027',
        support: 'guided',
        brief: 'Confirm a single room, breakfast times and where to find reception services.',
      },
      {
        passage: '700028',
        support: 'independent',
        brief: 'Complete a late check-in from intention cues and ask for essential details.',
      },
    ],
    capabilities: [
      'confirm-hotel-reservation',
      'give-stay-details',
      'ask-whats-included',
      'understand-hotel-schedule',
      'locate-hotel-facility',
    ],
    responsePalettes: [
      {
        id: 'hotel-stay-details',
        capability: 'give-stay-details',
        title: 'Give the details the receptionist needs',
        cue: 'Confirm the booking and add the detail that matters: room, nights, name, guests or breakfast.',
        initiallyVisible: 3,
        responses: [
          { item: '000763', nuance: 'The simplest confirmation' },
          { item: '000764', nuance: 'Give room type and duration together' },
          { item: '000765', nuance: 'Describe the stay without starting with sí' },
          { item: '000766', nuance: 'Give the reservation name' },
          { item: '000767', nuance: 'Answer only the duration question' },
          { item: '000768', nuance: 'Clarify the number of guests' },
          { item: '000769', nuance: 'Clarify an included option' },
          { item: '000770', nuance: 'Handle arriving without a booking' },
        ],
      },
    ],
    spotlight: 1,
    estimatedMinutes: 10,
    learnerSpeaker: 'Cliente',
    scenarioPartner: 'the receptionist',
  },
  {
    id: 'make-plans',
    language: 'es',
    level: 'a1',
    order: 6,
    title: 'Make evening plans',
    goal: 'Suggest an activity, respond and agree on what to do.',
    passage: '700014',
    transfers: [
      {
        passage: '700019',
        support: 'guided',
        brief: 'Make a different plan for the afternoon.',
      },
      {
        passage: '700029',
        support: 'guided',
        brief: 'Suggest dinner, respond to an alternative and agree on a time.',
      },
      {
        passage: '700030',
        support: 'independent',
        brief: 'Arrange a weekend activity from intention cues and settle the details.',
      },
    ],
    capabilities: [
      'open-social-planning',
      'suggest-social-activity',
      'respond-to-suggestion',
      'coordinate-plan-time',
      'confirm-social-plan',
    ],
    responsePalettes: [
      {
        id: 'plan-reaction',
        capability: 'respond-to-suggestion',
        title: 'Accept, adjust, counter or decline',
        cue: 'Respond honestly to the suggestion. You can accept it, change one detail, offer another idea or decline politely.',
        initiallyVisible: 3,
        responses: [
          { item: '000771', nuance: 'Simple positive acceptance' },
          { item: '000772', nuance: 'Warm and enthusiastic acceptance' },
          { item: '000773', nuance: 'Casual and decisive' },
          { item: '000774', nuance: 'Accept while changing the time' },
          { item: '000775', nuance: 'Offer a preferred alternative' },
          { item: '000776', nuance: 'Give a clear practical refusal' },
          { item: '000777', nuance: 'Decline politely with a reason' },
          { item: '000778', nuance: 'Keep the relationship open' },
          { item: '000779', nuance: 'Use a softer personal refusal' },
          { item: '000780', nuance: 'Respond with a different suggestion' },
        ],
      },
    ],
    spotlight: 0,
    estimatedMinutes: 10,
    learnerSpeaker: 'Luis',
    scenarioPartner: 'a friend',
  },
  {
    id: 'morning-routine',
    language: 'es',
    level: 'a1',
    order: 7,
    title: 'Describe your morning',
    goal: 'Tell someone the main events in your morning in a connected sequence.',
    passage: '700001',
    transfers: [
      {
        passage: '700020',
        support: 'guided',
        brief: 'Describe a slower Saturday morning with a different destination.',
      },
      {
        passage: '700031',
        support: 'guided',
        brief: 'Describe a busy weekday morning with clear sequence and times.',
      },
      {
        passage: '700032',
        support: 'independent',
        brief: 'Build a connected Sunday routine from intention cues.',
      },
    ],
    capabilities: [
      'anchor-routine-in-time',
      'describe-routine-actions',
      'add-context-to-routine',
      'sequence-routine-events',
      'connect-routine-to-destination',
    ],
    responsePalettes: [
      {
        id: 'real-morning-action',
        capability: 'describe-routine-actions',
        title: 'Make the routine yours',
        cue: 'Say something true about your morning. Add a time, sequence word, place or destination when you can.',
        initiallyVisible: 3,
        responses: [
          { item: '000781', nuance: 'Anchor a habit with frequency and time' },
          { item: '000782', nuance: 'Begin a sequence clearly' },
          { item: '000783', nuance: 'Add the next action' },
          { item: '000784', nuance: 'Personalise breakfast' },
          { item: '000785', nuance: 'Add another habitual activity' },
          { item: '000786', nuance: 'Combine an action with a place' },
          { item: '000787', nuance: 'Connect an action to a time' },
          { item: '000788', nuance: 'Add destination and transport' },
          { item: '000789', nuance: 'Contrast a weekend habit' },
          { item: '000790', nuance: 'Connect events with antes de' },
        ],
      },
    ],
    spotlight: 0,
    estimatedMinutes: 9,
    scenarioPartner: 'a new friend',
  },
  /**
   * The first A2 mission, and the first built on material that was already in
   * the pack: `En el médico` was the one dialogue no mission claimed.
   *
   * Health is the survival scenario the seven A1 missions leave out — a learner
   * can order a coffee and check into a hotel but cannot say what hurts. It sits
   * at A2 because its taught exchange does: `¿Desde cuándo?` wants a past
   * reference, which is exactly why it earns a level of its own rather than
   * being forced into A1.
   *
   * The transfer ladder deliberately leaves the surgery. Naming the symptom to a
   * pharmacist and to a receptionist on the phone is the same ability under
   * different pressure, which is what transfer is for — a second appointment
   * with a different doctor would mostly re-run the script.
   */
  {
    id: 'doctor-visit',
    language: 'es',
    level: 'a2',
    order: 8,
    title: 'Say what hurts',
    goal: 'Describe a symptom, say how long you have had it, and follow the advice you are given.',
    passage: '700013',
    transfers: [
      {
        passage: '700037',
        support: 'guided',
        brief: 'Ask a pharmacist for something for a headache, and take the dosage in.',
      },
      {
        passage: '700038',
        support: 'guided',
        brief: 'A different symptom and a different doctor: your back, and how many days.',
      },
      {
        passage: '700039',
        support: 'independent',
        brief: 'Phone a health centre for an appointment from intention cues alone.',
      },
    ],
    capabilities: [
      'describe-a-symptom',
      'say-since-when',
      'answer-health-questions',
      'follow-health-advice',
    ],
    responsePalettes: [
      {
        /*
         * Every option here is a sentence the pack already had — the symptoms
         * were authored long before this mission existed, scattered across the
         * body and health sheets. Pointing at them rather than writing ten near
         * copies is the same rule content follows everywhere else: describe what
         * exists, do not duplicate it. The build would have rejected the copies
         * anyway, since no two items may carry the same text.
         */
        id: 'symptom-report',
        capability: 'describe-a-symptom',
        title: 'Say what is actually wrong',
        cue: 'Name what hurts, or how you feel. Add where and how much when you can.',
        initiallyVisible: 3,
        responses: [
          { item: '000365', nuance: 'The most common complaint of all' },
          { item: '000366', nuance: 'A different part of the body' },
          { item: '000367', nuance: 'A symptom with tener rather than doler' },
          { item: '000145', nuance: 'Two places at once' },
          { item: '000148', nuance: 'Naming which side' },
          { item: '000150', nuance: 'Plural: doler agrees with what hurts' },
          { item: '000046', nuance: 'Not pain but a state · masculine speaker' },
          { item: '000047', nuance: 'The same state, stronger and today' },
          { item: '000368', nuance: 'Includes how long it has been' },
          { item: '000155', nuance: 'Asking for a remedy rather than reporting' },
        ],
      },
    ],
    spotlight: 1,
    estimatedMinutes: 8,
    learnerSpeaker: 'Paciente',
    scenarioPartner: 'the doctor',
  },
  /**
   * Built on `Un día en la oficina`, which had sat in the pack unclaimed.
   *
   * A monologue mission rather than a dialogue, like `morning-routine`: "what do
   * you do?" is answered in a paragraph, not an exchange, and the transfer is a
   * different *job* rather than a different interlocutor. The last rung moves
   * into the past tense on purpose — recounting a specific bad day is the point
   * at which describing work stops being a script.
   */
  {
    id: 'your-work',
    language: 'es',
    level: 'a1',
    order: 9,
    title: 'Talk about your work',
    goal: 'Say what you do, take someone through a working day, and say how it left you.',
    passage: '700003',
    transfers: [
      {
        passage: '700040',
        support: 'guided',
        brief: 'The same day from home: a different place, the same shape.',
      },
      {
        passage: '700041',
        support: 'guided',
        brief: 'A different job entirely — a shop, with opening and closing times.',
      },
      {
        passage: '700042',
        support: 'independent',
        brief: 'Recount one particular busy day, in the past, from intention cues.',
      },
    ],
    capabilities: [
      'say-what-you-do',
      'walk-through-a-workday',
      'talk-about-work-meetings',
      'say-how-the-day-went',
    ],
    responsePalettes: [
      {
        id: 'what-you-do',
        capability: 'say-what-you-do',
        title: 'Say what you actually do',
        cue: 'Name the job, or the place, or who you do it with — whatever is true.',
        initiallyVisible: 3,
        responses: [
          { item: '000849', nuance: 'The job before the place' },
          { item: '000850', nuance: 'Adds who you work with' },
          { item: '000851', nuance: 'For someone studying as well' },
          { item: '000852', nuance: 'Where rather than what' },
          { item: '000853', nuance: 'Honest, when you are between jobs' },
          { item: '000854', nuance: 'Adds how near it is' },
          { item: '000855', nuance: 'Says more than the question asked' },
          { item: '000856', nuance: 'A precise job · feminine speaker' },
        ],
      },
    ],
    spotlight: 0,
    estimatedMinutes: 9,
    scenarioPartner: 'someone you have just met',
  },
  /**
   * Built on `Mi piso`, the other text nothing pointed at.
   *
   * The transfers deliberately change *who is speaking about what home* rather
   * than only the rooms: your parents' house, a student room, a flat two people
   * are still looking for. The last one is in the future rather than the present,
   * which is where "describe your home" stops being a list of furniture.
   */
  {
    id: 'your-home',
    language: 'es',
    level: 'a1',
    order: 10,
    title: 'Describe where you live',
    goal: 'Say where you live, what the rooms are like, what is nearby, and how you feel about it.',
    passage: '700002',
    transfers: [
      {
        passage: '700043',
        support: 'guided',
        brief: "Someone else's home: a village house, with a garden and a river.",
      },
      {
        passage: '700044',
        support: 'guided',
        brief: 'A much smaller home, and what it is missing.',
      },
      {
        passage: '700045',
        support: 'independent',
        brief: 'A home you do not have yet — say what you are looking for.',
      },
    ],
    capabilities: [
      'say-where-you-live',
      'describe-the-rooms',
      'say-what-is-nearby',
      'say-how-you-feel-about-home',
    ],
    responsePalettes: [
      {
        id: 'where-you-live',
        capability: 'say-where-you-live',
        title: 'Say where you really live',
        cue: 'Say the kind of home, the area, or who you live with. Any of the three is an answer.',
        initiallyVisible: 3,
        responses: [
          { item: '000857', nuance: 'Area and kind of home' },
          { item: '000858', nuance: 'Who you live with' },
          { item: '000859', nuance: 'Away from the centre' },
          { item: '000860', nuance: 'Alone · masculine speaker' },
          { item: '000861', nuance: 'A landmark instead of a street' },
          { item: '000862', nuance: 'Separates where you live from where you are from' },
          { item: '000863', nuance: 'A detail that says how it feels' },
          { item: '000864', nuance: 'How long, with desde hace' },
        ],
      },
    ],
    spotlight: 0,
    estimatedMinutes: 8,
    scenarioPartner: 'a new neighbour',
  },
  /**
   * The largest gap in the seven A1 missions relative to what the pack already
   * knew: travel was its biggest topic and its only travel dialogues were asking
   * directions and checking into a hotel. A learner could find the station and
   * sleep near it without ever buying a ticket.
   *
   * The ladder changes the *mode* rather than the destination — bus, return fare,
   * metro — because the pressure in this exchange comes from the fare and the
   * platform, not from where you are going.
   */
  {
    id: 'buy-a-ticket',
    language: 'es',
    level: 'a1',
    order: 11,
    title: 'Buy a ticket',
    goal: 'Ask for a ticket, choose the fare, and find out when and where it leaves.',
    passage: '700046',
    transfers: [
      {
        passage: '700047',
        support: 'guided',
        brief: 'A bus rather than a train, and a stop rather than a platform.',
      },
      {
        passage: '700048',
        support: 'guided',
        brief: 'A return for two people, with a choice between two departures.',
      },
      {
        passage: '700049',
        support: 'independent',
        brief: 'A metro machine: single or ten journeys, from intention cues.',
      },
    ],
    capabilities: ['ask-for-a-ticket', 'ask-about-departure', 'choose-a-fare', 'find-the-platform'],
    responsePalettes: [
      {
        id: 'ticket-request',
        capability: 'ask-for-a-ticket',
        title: 'Ask for the ticket you need',
        cue: 'Say where you are going, or how many, or which fare — any of the three opens it.',
        initiallyVisible: 3,
        responses: [
          { item: '000961', nuance: 'Destination first, short and direct' },
          { item: '000962', nuance: 'Says how many at the same time' },
          { item: '000963', nuance: 'Names the fare instead of the place' },
          { item: '000964', nuance: 'Whatever leaves soonest' },
          { item: '000965', nuance: 'Puts the price question first' },
          { item: '000966', nuance: 'Says which day it is for' },
          { item: '000967', nuance: 'For a group, without the word billete' },
          { item: '000968', nuance: 'When you already have one and are unsure' },
        ],
      },
    ],
    spotlight: 1,
    estimatedMinutes: 9,
    learnerSpeaker: 'Viajero',
    scenarioPartner: 'the person at the counter',
  },
  /**
   * `En el mercado` existed as a monologue and nothing let a learner *buy*
   * anything in it. Shopping already had four clothes dialogues, and a market is
   * usefully different: quantities and weights rather than sizes, and a price per
   * kilo rather than per item.
   *
   * The independent rung is the one that matters here — the stall is out of what
   * you asked for, so the script cannot be followed and something has to be
   * changed on the spot.
   */
  {
    id: 'market-shopping',
    language: 'es',
    level: 'a1',
    order: 12,
    title: 'Shop at the market',
    goal: 'Ask for an amount, find out what it costs by weight, change your order and pay.',
    passage: '700050',
    transfers: [
      {
        passage: '700051',
        support: 'guided',
        brief: 'A bakery: counted loaves rather than a weight, and a change of mind.',
      },
      {
        passage: '700052',
        support: 'guided',
        brief: 'A fishmonger, a higher price per kilo, and card or cash.',
      },
      {
        passage: '700053',
        support: 'independent',
        brief: 'They are out of what you wanted. Take the substitute and re-price it.',
      },
    ],
    capabilities: [
      'ask-for-a-quantity',
      'ask-price-by-weight',
      'change-what-you-asked-for',
      'pay-and-leave',
    ],
    responsePalettes: [
      {
        id: 'quantity-request',
        capability: 'ask-for-a-quantity',
        title: 'Ask for how much you want',
        cue: 'Weigh it, count it, or leave it vague — all three are what people actually say.',
        initiallyVisible: 3,
        responses: [
          { item: '000969', nuance: 'The everyday weight request' },
          { item: '000970', nuance: 'Half, with a limit made clear' },
          { item: '000971', nuance: 'Counted rather than weighed' },
          { item: '000972', nuance: 'Vague on purpose, and perfectly natural' },
          { item: '000973', nuance: 'Adds which size' },
          { item: '000974', nuance: 'The question form a stall expects' },
          { item: '000975', nuance: 'Small, with the courtesy at the end' },
          { item: '000976', nuance: 'For a stall you go back to' },
        ],
      },
    ],
    spotlight: 1,
    estimatedMinutes: 9,
    learnerSpeaker: 'Cliente',
    scenarioPartner: 'the stallholder',
  },
  /**
   * `greet-and-respond` gets a learner as far as hello and how are you. This is
   * the next thing anyone is asked, and the pack had thirty-seven family items
   * with no exchange to use them in.
   *
   * It reuses the characters of the greetings mission on purpose — Luis, Marta,
   * Ana, Daniel, Elena — so the two missions read as the same person's life
   * rather than as two unrelated scripts. The learner is Luis in both.
   */
  {
    id: 'introduce-your-family',
    language: 'es',
    level: 'a1',
    order: 13,
    title: 'Introduce your family',
    goal: 'Say who someone is, what they do, and give a detail — then react to what you hear.',
    passage: '700054',
    transfers: [
      {
        passage: '700055',
        support: 'guided',
        brief: 'A cousin at a party, and how often he visits.',
      },
      {
        passage: '700056',
        support: 'guided',
        brief: 'A sister with a different job, and her children.',
      },
      {
        passage: '700057',
        support: 'independent',
        brief: 'Your own household now: who you live with, and a baby’s age.',
      },
    ],
    capabilities: [
      'introduce-a-person',
      'say-what-they-do',
      'give-family-details',
      'react-with-interest',
    ],
    responsePalettes: [
      {
        id: 'who-they-are',
        capability: 'introduce-a-person',
        title: 'Say who someone is',
        cue: 'Give the relationship, the name, or where you know them from.',
        initiallyVisible: 3,
        responses: [
          { item: '000977', nuance: 'Relationship first, then the name' },
          { item: '000978', nuance: 'Says where you know them from' },
          { item: '000979', nuance: 'The set phrase for an introduction' },
          { item: '000980', nuance: 'Two people at once, plus a detail' },
          { item: '000981', nuance: 'A more formal name for an older person' },
          { item: '000982', nuance: 'Distinguishes one child from another' },
          { item: '000983', nuance: 'Says what you share rather than who they are' },
          { item: '000984', nuance: 'Anticipates that they will not know them' },
        ],
      },
    ],
    spotlight: 1,
    estimatedMinutes: 9,
    learnerSpeaker: 'Luis',
    scenarioPartner: 'a friend looking at your photos',
  },
] as const;
