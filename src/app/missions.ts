import type { MissionDefinition } from '../domain/missions';

/**
 * The first authored communicative journey.
 *
 * These are sequencing records over passages the pack already owns. Adding a
 * mission never creates a second copy of a sentence and never stores an
 * exercise. A future pack-supplied curriculum can implement the same shape.
 */
export const MISSIONS: readonly MissionDefinition[] = [
  {
    id: 'cafe-order',
    language: 'es',
    level: 'a1',
    order: 1,
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
    spotlight: 1,
    estimatedMinutes: 10,
    learnerSpeaker: 'Cliente',
    scenarioPartner: 'the waiter',
  },
  {
    id: 'ask-directions',
    language: 'es',
    level: 'a1',
    order: 2,
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
    spotlight: 0,
    estimatedMinutes: 9,
    learnerSpeaker: 'Turista',
    scenarioPartner: 'a local person',
  },
  {
    id: 'shop-clothes',
    language: 'es',
    level: 'a1',
    order: 3,
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
    spotlight: 1,
    estimatedMinutes: 11,
    learnerSpeaker: 'Cliente',
    scenarioPartner: 'the shop assistant',
  },
  {
    id: 'hotel-check-in',
    language: 'es',
    level: 'a1',
    order: 4,
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
    spotlight: 1,
    estimatedMinutes: 10,
    learnerSpeaker: 'Cliente',
    scenarioPartner: 'the receptionist',
  },
  {
    id: 'make-plans',
    language: 'es',
    level: 'a1',
    order: 5,
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
    spotlight: 0,
    estimatedMinutes: 10,
    learnerSpeaker: 'Luis',
    scenarioPartner: 'a friend',
  },
  {
    id: 'morning-routine',
    language: 'es',
    level: 'a1',
    order: 6,
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
    spotlight: 0,
    estimatedMinutes: 9,
    scenarioPartner: 'a new friend',
  },
] as const;
