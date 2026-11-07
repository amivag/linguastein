import type { MissionSpine } from '../../domain/missions';

/**
 * The curriculum, with the language taken out of it.
 *
 * What each mission is for, the order they build in, the capabilities each
 * gathers evidence for, and the transfer arc that takes a learner from a scripted
 * exchange to an unscripted one. None of it is a fact about Spanish, which is why
 * it is not filed with Spanish: a second language chooses passages against these
 * spines rather than re-deriving the sequencing. See `./es.ts` for that half.
 *
 * The prose is neutral about the target language and still English — a learner who
 * does not read English needs it translated, which is the UI-chrome problem rather
 * than this one.
 */
export const MISSION_SPINES: readonly MissionSpine[] = [
  {
    id: 'greet-and-respond',
    order: 0,
    title: 'Meet someone and keep talking',
    goal: 'Greet someone, say where you are from and what you do, ask them back, and keep the conversation going.',
    scenarioPartner: 'the other person',
    estimatedMinutes: 18,
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
    ladder: [
      {
        support: 'guided',
        brief: 'A friend you do not know well yet — work, the weekend, and where you are from.',
      },
      { support: 'guided', brief: 'The same conversation at work, formal throughout.' },
      {
        support: 'independent',
        brief: 'Meet a new neighbour and do the asking yourself, from intention cues.',
      },
    ],
  },
  {
    id: 'make-yourself-understood',
    order: 1,
    title: 'Make yourself understood',
    goal: 'Say you have not understood, ask for it again or slower, find the word you need, and check you got it right.',
    scenarioPartner: 'the other person',
    estimatedMinutes: 14,
    capabilities: [
      'say-you-did-not-understand',
      'ask-to-repeat',
      'ask-to-slow-down',
      'check-you-were-understood',
    ],
    ladder: [
      {
        support: 'guided',
        brief: 'Directions you cannot follow. Slow the other person down instead of guessing.',
      },
      { support: 'guided', brief: 'In class, informal, where the word itself is the problem.' },
      {
        support: 'independent',
        brief: 'An address you cannot afford to get wrong. Get it in writing.',
      },
    ],
  },
  {
    id: 'cafe-order',
    order: 2,
    title: 'Order at a café',
    goal: 'Order a drink, add something else and understand the price.',
    scenarioPartner: 'the waiter',
    estimatedMinutes: 10,
    capabilities: [
      'order-food-drink',
      'handle-add-on',
      'ask-understand-price',
      'close-service-exchange',
    ],
    ladder: [
      {
        support: 'guided',
        brief: 'Order a different drink and respond when the waiter suggests an extra.',
      },
      {
        support: 'guided',
        brief: 'Change the order, decline one option and ask for the new total.',
      },
      {
        support: 'independent',
        brief: 'Handle a breakfast order from intention cues, without a line-by-line script.',
      },
    ],
  },
  {
    id: 'ask-directions',
    order: 3,
    title: 'Ask for directions',
    goal: 'Ask where a place is and follow a short answer.',
    scenarioPartner: 'a local person',
    estimatedMinutes: 9,
    capabilities: [
      'ask-for-directions',
      'follow-simple-directions',
      'check-distance',
      'thank-for-help',
    ],
    ladder: [
      { support: 'guided', brief: 'Find a different place and check how far away it is.' },
      { support: 'guided', brief: 'Ask for the museum and follow a route with two landmarks.' },
      {
        support: 'independent',
        brief: 'Find a bus stop from intention cues and confirm the distance.',
      },
    ],
  },
  {
    id: 'shop-clothes',
    order: 4,
    title: 'Shop for clothes',
    goal: 'Ask for help, choose an item and handle the fitting-room exchange.',
    scenarioPartner: 'the shop assistant',
    estimatedMinutes: 11,
    capabilities: [
      'seek-clothing-item',
      'handle-clothing-size',
      'ask-to-try-on',
      'choose-clothing-purchase',
      'ask-understand-item-price',
    ],
    ladder: [
      { support: 'guided', brief: 'Choose a different item, size and colour.' },
      { support: 'guided', brief: 'Ask for trousers, try them on and decide whether to buy them.' },
      {
        support: 'independent',
        brief: 'Handle a shoe purchase from intention cues, including size and price.',
      },
    ],
  },
  {
    id: 'hotel-check-in',
    order: 5,
    title: 'Check into a hotel',
    goal: 'Confirm a reservation and understand the essential check-in details.',
    scenarioPartner: 'the receptionist',
    estimatedMinutes: 10,
    capabilities: [
      'confirm-hotel-reservation',
      'give-stay-details',
      'ask-whats-included',
      'understand-hotel-schedule',
      'locate-hotel-facility',
    ],
    ladder: [
      {
        support: 'guided',
        brief: 'Check in for a different stay and locate another hotel facility.',
      },
      {
        support: 'guided',
        brief: 'Confirm a single room, breakfast times and where to find reception services.',
      },
      {
        support: 'independent',
        brief: 'Complete a late check-in from intention cues and ask for essential details.',
      },
    ],
  },
  {
    id: 'make-plans',
    order: 6,
    title: 'Make evening plans',
    goal: 'Suggest an activity, respond and agree on what to do.',
    scenarioPartner: 'a friend',
    estimatedMinutes: 10,
    capabilities: [
      'open-social-planning',
      'suggest-social-activity',
      'respond-to-suggestion',
      'coordinate-plan-time',
      'confirm-social-plan',
    ],
    ladder: [
      { support: 'guided', brief: 'Make a different plan for the afternoon.' },
      {
        support: 'guided',
        brief: 'Suggest dinner, respond to an alternative and agree on a time.',
      },
      {
        support: 'independent',
        brief: 'Arrange a weekend activity from intention cues and settle the details.',
      },
    ],
  },
  {
    id: 'morning-routine',
    order: 7,
    title: 'Describe your morning',
    goal: 'Tell someone the main events in your morning in a connected sequence.',
    scenarioPartner: 'a new friend',
    estimatedMinutes: 9,
    capabilities: [
      'anchor-routine-in-time',
      'describe-routine-actions',
      'add-context-to-routine',
      'sequence-routine-events',
      'connect-routine-to-destination',
    ],
    ladder: [
      {
        support: 'guided',
        brief: 'Describe a slower Saturday morning with a different destination.',
      },
      {
        support: 'guided',
        brief: 'Describe a busy weekday morning with clear sequence and times.',
      },
      { support: 'independent', brief: 'Build a connected Sunday routine from intention cues.' },
    ],
  },
  {
    id: 'doctor-visit',
    order: 8,
    title: 'Say what hurts',
    goal: 'Describe a symptom, say how long you have had it, and follow the advice you are given.',
    scenarioPartner: 'the doctor',
    estimatedMinutes: 8,
    capabilities: [
      'describe-a-symptom',
      'say-since-when',
      'answer-health-questions',
      'follow-health-advice',
    ],
    ladder: [
      {
        support: 'guided',
        brief: 'Ask a pharmacist for something for a headache, and take the dosage in.',
      },
      {
        support: 'guided',
        brief: 'A different symptom and a different doctor: your back, and how many days.',
      },
      {
        support: 'independent',
        brief: 'Phone a health centre for an appointment from intention cues alone.',
      },
    ],
  },
  {
    id: 'your-work',
    order: 9,
    title: 'Talk about your work',
    goal: 'Say what you do, take someone through a working day, and say how it left you.',
    scenarioPartner: 'someone you have just met',
    estimatedMinutes: 9,
    capabilities: [
      'say-what-you-do',
      'walk-through-a-workday',
      'talk-about-work-meetings',
      'say-how-the-day-went',
    ],
    ladder: [
      { support: 'guided', brief: 'The same day from home: a different place, the same shape.' },
      {
        support: 'guided',
        brief: 'A different job entirely — a shop, with opening and closing times.',
      },
      {
        support: 'independent',
        brief: 'Recount one particular busy day, in the past, from intention cues.',
      },
    ],
  },
  {
    id: 'your-home',
    order: 10,
    title: 'Describe where you live',
    goal: 'Say where you live, what the rooms are like, what is nearby, and how you feel about it.',
    scenarioPartner: 'a new neighbour',
    estimatedMinutes: 8,
    capabilities: [
      'say-where-you-live',
      'describe-the-rooms',
      'say-what-is-nearby',
      'say-how-you-feel-about-home',
    ],
    ladder: [
      {
        support: 'guided',
        brief: "Someone else's home: a village house, with a garden and a river.",
      },
      { support: 'guided', brief: 'A much smaller home, and what it is missing.' },
      {
        support: 'independent',
        brief: 'A home you do not have yet — say what you are looking for.',
      },
    ],
  },
  {
    id: 'buy-a-ticket',
    order: 11,
    title: 'Buy a ticket',
    goal: 'Ask for a ticket, choose the fare, and find out when and where it leaves.',
    scenarioPartner: 'the person at the counter',
    estimatedMinutes: 9,
    capabilities: ['ask-for-a-ticket', 'ask-about-departure', 'choose-a-fare', 'find-the-platform'],
    ladder: [
      { support: 'guided', brief: 'A bus rather than a train, and a stop rather than a platform.' },
      {
        support: 'guided',
        brief: 'A return for two people, with a choice between two departures.',
      },
      {
        support: 'independent',
        brief: 'A metro machine: single or ten journeys, from intention cues.',
      },
    ],
  },
  {
    id: 'market-shopping',
    order: 12,
    title: 'Shop at the market',
    goal: 'Ask for an amount, find out what it costs by weight, change your order and pay.',
    scenarioPartner: 'the stallholder',
    estimatedMinutes: 9,
    capabilities: [
      'ask-for-a-quantity',
      'ask-price-by-weight',
      'change-what-you-asked-for',
      'pay-and-leave',
    ],
    ladder: [
      {
        support: 'guided',
        brief: 'A bakery: counted loaves rather than a weight, and a change of mind.',
      },
      { support: 'guided', brief: 'A fishmonger, a higher price per kilo, and card or cash.' },
      {
        support: 'independent',
        brief: 'They are out of what you wanted. Take the substitute and re-price it.',
      },
    ],
  },
  {
    id: 'introduce-your-family',
    order: 13,
    title: 'Introduce your family',
    goal: 'Say who someone is, what they do, and give a detail — then react to what you hear.',
    scenarioPartner: 'a friend looking at your photos',
    estimatedMinutes: 9,
    capabilities: [
      'introduce-a-person',
      'say-what-they-do',
      'give-family-details',
      'react-with-interest',
    ],
    ladder: [
      { support: 'guided', brief: 'A cousin at a party, and how often he visits.' },
      { support: 'guided', brief: 'A sister with a different job, and her children.' },
      {
        support: 'independent',
        brief: 'Your own household now: who you live with, and a baby’s age.',
      },
    ],
  },
  {
    id: 'handle-a-complaint',
    order: 14,
    title: 'Say something is wrong, and get it put right',
    goal: 'Explain what has gone wrong, say what you want done about it, and stay polite while holding the line.',
    scenarioPartner: 'someone on the other side of a counter',
    estimatedMinutes: 12,
    capabilities: ['make-a-complaint', 'ask-someone-to-do', 'express-a-hope'],
    ladder: [
      {
        support: 'guided',
        brief:
          'The same complaint down a phone line, about a bill that is twice what it should be.',
      },
      {
        support: 'guided',
        brief:
          'A parcel that never came — and they offer a replacement when what you want is the money.',
      },
      {
        support: 'independent',
        brief:
          'A neighbour rather than a shop: no counter to stand at, and nobody paid to be patient with you.',
      },
    ],
  },
  {
    id: 'share-a-flat',
    order: 15,
    title: 'Sort something out with the person you live with',
    goal: 'Raise something that is bothering you at home, propose a change, and reach an agreement neither of you resents.',
    scenarioPartner: 'the person you share a flat with',
    estimatedMinutes: 11,
    capabilities: ['ask-someone-to-do', 'react-to-news', 'concede-a-point'],
    ladder: [
      {
        support: 'guided',
        brief:
          'The same conversation about money, where the bills went up and neither of you caused it.',
      },
      { support: 'guided', brief: 'Who cleans what — and the fix is a rota rather than a favour.' },
      {
        support: 'independent',
        brief: 'You are the one asking this time, and the answer is not a foregone conclusion.',
      },
    ],
  },
  {
    id: 'ask-for-advice',
    order: 16,
    title: 'Ask for advice, weigh it, and decide',
    goal: 'Lay out a choice you cannot settle alone, take advice without taking orders, and say what you have decided.',
    scenarioPartner: 'a friend who has been through it',
    estimatedMinutes: 12,
    capabilities: ['give-advice', 'express-doubt'],
    ladder: [
      {
        support: 'guided',
        brief:
          'The same weighing-up about a course, where the cheaper option is not obviously the worse one.',
      },
      {
        support: 'guided',
        brief: 'Money — and the first rung where you push back on the advice instead of taking it.',
      },
      {
        support: 'independent',
        brief: 'A worry rather than a decision, and advice you would rather not have been given.',
      },
    ],
  },
];
