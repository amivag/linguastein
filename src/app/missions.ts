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
    challengePassage: '700015',
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
    spotlight: 0,
    estimatedMinutes: 9,
    scenarioPartner: 'a new friend',
  },
] as const;
