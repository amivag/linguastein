import type { VariationPattern } from '../domain/exercises';

/**
 * The first compositional layer over mission language.
 *
 * Patterns live beside curriculum sequencing rather than inside content items:
 * they generate transient study phrases and never pretend each combination is
 * a stable, schedulable item. The ordinary response-palette sentences remain
 * the evidence-bearing material.
 */
export const MISSION_VARIATIONS: Readonly<Record<string, readonly VariationPattern[]>> = {
  'greet-and-respond': [
    {
      id: 'build-wellbeing-answer',
      title: 'Answer for how you really feel',
      cue: 'Choose your state, then decide whether to return the question.',
      targetTemplate: '{state}{followup}',
      referenceTemplate: '{state}{followup}',
      slots: [
        {
          id: 'state',
          label: 'How you feel',
          choices: [
            { id: 'great', target: 'Estoy genial', reference: "I'm doing great" },
            { id: 'well', target: 'Estoy bien', reference: "I'm fine" },
            { id: 'quite-well', target: 'Bastante bien', reference: 'Quite well' },
            { id: 'so-so', target: 'Más o menos', reference: 'So-so' },
            { id: 'not-great', target: 'Regular', reference: 'Not great' },
            { id: 'tired-m', target: 'Estoy cansado', reference: "I'm tired" },
            { id: 'tired-f', target: 'Estoy cansada', reference: "I'm tired" },
            {
              id: 'sad',
              target: 'Estoy un poco triste',
              reference: "I'm a little sad",
            },
          ],
        },
        {
          id: 'followup',
          label: 'Return the question',
          choices: [
            { id: 'none', target: '.', reference: '.' },
            { id: 'tu', target: '. ¿Y tú?', reference: '. And you?' },
            { id: 'usted', target: '. ¿Y usted?', reference: '. And you?' },
          ],
        },
      ],
    },
  ],
  'cafe-order': [
    {
      id: 'build-cafe-order',
      title: 'Build your café order',
      cue: 'Change who is ordering, the drink and how politely you finish.',
      targetTemplate: '{lead} {drink}{finish}',
      referenceTemplate: '{lead} {drink}{finish}',
      slots: [
        {
          id: 'lead',
          label: 'How to begin',
          choices: [
            { id: 'quiero', target: 'Quiero', reference: "I'd like" },
            { id: 'voy-a-tomar', target: 'Voy a tomar', reference: "I'll have" },
            { id: 'para-mi', target: 'Para mí,', reference: 'For me,' },
          ],
        },
        {
          id: 'drink',
          label: 'Drink',
          choices: [
            { id: 'cafe-solo', target: 'un café solo', reference: 'a black coffee' },
            {
              id: 'cafe-con-leche',
              target: 'un café con leche',
              reference: 'a coffee with milk',
            },
            { id: 'te', target: 'un té', reference: 'a tea' },
            {
              id: 'zumo-naranja',
              target: 'un zumo de naranja',
              reference: 'an orange juice',
            },
            { id: 'agua', target: 'un agua', reference: 'a water' },
          ],
        },
        {
          id: 'finish',
          label: 'Finish',
          choices: [
            { id: 'please', target: ', por favor.', reference: ', please.' },
            { id: 'plain', target: '.', reference: '.' },
          ],
        },
      ],
    },
  ],
  'ask-directions': [
    {
      id: 'build-direction-question',
      title: 'Build your directions question',
      cue: 'Change the polite opener and the place you need to find.',
      targetTemplate: '{opener} ¿dónde está {place}?',
      referenceTemplate: '{opener} where is {place}?',
      slots: [
        {
          id: 'opener',
          label: 'Polite opener',
          choices: [
            { id: 'perdon', target: 'Perdón,', reference: 'Excuse me,' },
            { id: 'disculpe', target: 'Disculpe,', reference: 'Excuse me,' },
            { id: 'perdone', target: 'Perdone,', reference: 'Excuse me,' },
          ],
        },
        {
          id: 'place',
          label: 'Destination',
          choices: [
            { id: 'farmacia', target: 'la farmacia', reference: 'the pharmacy' },
            { id: 'estacion', target: 'la estación', reference: 'the station' },
            { id: 'museo', target: 'el museo', reference: 'the museum' },
            { id: 'banco', target: 'el banco', reference: 'the bank' },
            { id: 'hotel', target: 'el hotel', reference: 'the hotel' },
            {
              id: 'parada',
              target: 'la parada de autobús',
              reference: 'the bus stop',
            },
          ],
        },
      ],
    },
  ],
  'shop-clothes': [
    {
      id: 'build-clothing-request',
      title: 'Build a clothing request',
      cue: 'Change how strongly you ask, the item and what you need it for.',
      targetTemplate: '{lead} {item}{purpose}',
      referenceTemplate: '{lead} {item}{purpose}',
      slots: [
        {
          id: 'lead',
          label: 'What you need',
          choices: [
            { id: 'busco', target: 'Busco', reference: "I'm looking for" },
            { id: 'quiero', target: 'Quiero', reference: "I'd like" },
            { id: 'necesito', target: 'Necesito', reference: 'I need' },
          ],
        },
        {
          id: 'item',
          label: 'Item',
          choices: [
            { id: 'shirt', target: 'una camisa blanca', reference: 'a white shirt' },
            { id: 'jacket', target: 'una chaqueta azul', reference: 'a blue jacket' },
            {
              id: 'trousers',
              target: 'unos pantalones negros',
              reference: 'some black trousers',
            },
            { id: 'dress', target: 'un vestido rojo', reference: 'a red dress' },
            { id: 'shoes', target: 'unos zapatos cómodos', reference: 'comfortable shoes' },
          ],
        },
        {
          id: 'purpose',
          label: 'Purpose',
          choices: [
            { id: 'none', target: '.', reference: '.' },
            { id: 'work', target: ' para el trabajo.', reference: ' for work.' },
            { id: 'party', target: ' para una fiesta.', reference: ' for a party.' },
          ],
        },
      ],
    },
  ],
  'hotel-check-in': [
    {
      id: 'build-hotel-stay',
      title: 'Build your hotel details',
      cue: 'Combine the booking, room, duration and one useful extra detail.',
      targetTemplate: '{lead} {room} para {nights}{detail}',
      referenceTemplate: '{lead} {room} for {nights}{detail}',
      slots: [
        {
          id: 'lead',
          label: 'Confirm the booking',
          choices: [
            { id: 'yes', target: 'Sí,', reference: 'Yes,' },
            {
              id: 'reservation',
              target: 'Tengo una reserva:',
              reference: 'I have a reservation:',
            },
          ],
        },
        {
          id: 'room',
          label: 'Room',
          choices: [
            { id: 'single', target: 'una habitación individual', reference: 'a single room' },
            { id: 'double', target: 'una habitación doble', reference: 'a double room' },
            {
              id: 'two-people',
              target: 'una habitación familiar',
              reference: 'a family room',
            },
          ],
        },
        {
          id: 'nights',
          label: 'Duration',
          choices: [
            { id: 'one', target: 'una noche', reference: 'one night' },
            { id: 'two', target: 'dos noches', reference: 'two nights' },
            { id: 'three', target: 'tres noches', reference: 'three nights' },
            { id: 'four', target: 'cuatro noches', reference: 'four nights' },
          ],
        },
        {
          id: 'detail',
          label: 'Extra detail',
          choices: [
            { id: 'none', target: '.', reference: '.' },
            {
              id: 'name',
              target: ', a nombre de García.',
              reference: ', under the name García.',
            },
            { id: 'breakfast', target: ', con desayuno.', reference: ', with breakfast.' },
          ],
        },
      ],
    },
  ],
  'make-plans': [
    {
      id: 'build-plan-acceptance',
      title: 'Accept and shape the plan',
      cue: 'Choose your reaction, activity and timing.',
      targetTemplate: '{reaction} {activity}{time}',
      referenceTemplate: '{reaction} {activity}{time}',
      slots: [
        {
          id: 'reaction',
          label: 'Reaction',
          choices: [
            { id: 'yes', target: 'Sí,', reference: 'Yes,' },
            { id: 'okay', target: 'Vale,', reference: 'Okay,' },
            { id: 'perfect', target: 'Perfecto,', reference: 'Perfect,' },
          ],
        },
        {
          id: 'activity',
          label: 'Activity',
          choices: [
            { id: 'cinema', target: 'vamos al cine', reference: "let's go to the cinema" },
            { id: 'park', target: 'vamos al parque', reference: "let's go to the park" },
            { id: 'dinner', target: 'vamos a cenar', reference: "let's go for dinner" },
            { id: 'museum', target: 'vamos al museo', reference: "let's go to the museum" },
          ],
        },
        {
          id: 'time',
          label: 'Time',
          choices: [
            { id: 'none', target: '.', reference: '.' },
            { id: 'afternoon', target: ' esta tarde.', reference: ' this afternoon.' },
            { id: 'eight', target: ' a las ocho.', reference: ' at eight.' },
          ],
        },
      ],
    },
    {
      id: 'build-plan-counteroffer',
      title: 'Decline without ending the conversation',
      cue: 'Give an honest reason, then keep the door open with another option.',
      targetTemplate: '{decline} {alternative}',
      referenceTemplate: '{decline} {alternative}',
      slots: [
        {
          id: 'decline',
          label: 'Your response',
          choices: [
            { id: 'cannot', target: 'Hoy no puedo, pero', reference: "I can't today, but" },
            {
              id: 'not-feel-like',
              target: 'No me apetece mucho, pero',
              reference: "I don't really feel like it, but",
            },
            {
              id: 'plans',
              target: 'Ya tengo planes, pero',
              reference: 'I already have plans, but',
            },
          ],
        },
        {
          id: 'alternative',
          label: 'Alternative',
          choices: [
            { id: 'tomorrow', target: 'podemos ir mañana.', reference: 'we can go tomorrow.' },
            {
              id: 'another-day',
              target: 'podemos quedar otro día.',
              reference: 'we can meet another day.',
            },
            {
              id: 'weekend',
              target: 'podemos hacer otra cosa el fin de semana.',
              reference: 'we can do something else at the weekend.',
            },
          ],
        },
      ],
    },
  ],
  'morning-routine': [
    {
      id: 'build-morning-sequence',
      title: 'Build a real morning sequence',
      cue: 'Change the sequence marker, action and time to match your morning.',
      targetTemplate: '{sequence} {action}{time}',
      referenceTemplate: '{sequence} {action}{time}',
      slots: [
        {
          id: 'sequence',
          label: 'Sequence',
          choices: [
            { id: 'first', target: 'Primero,', reference: 'First,' },
            { id: 'after', target: 'Después,', reference: 'Afterwards,' },
            { id: 'then', target: 'Luego,', reference: 'Then,' },
            { id: 'morning', target: 'Por la mañana,', reference: 'In the morning,' },
          ],
        },
        {
          id: 'action',
          label: 'Action',
          choices: [
            { id: 'wake', target: 'me despierto', reference: 'I wake up' },
            { id: 'shower', target: 'me ducho', reference: 'I take a shower' },
            { id: 'breakfast', target: 'desayuno', reference: 'I have breakfast' },
            { id: 'leave', target: 'salgo de casa', reference: 'I leave home' },
            { id: 'work', target: 'empiezo a trabajar', reference: 'I start work' },
          ],
        },
        {
          id: 'time',
          label: 'Time',
          choices: [
            { id: 'plain', target: '.', reference: '.' },
            { id: 'seven', target: ' a las siete.', reference: ' at seven.' },
            { id: 'eight', target: ' a las ocho.', reference: ' at eight.' },
            { id: 'early', target: ' temprano.', reference: ' early.' },
          ],
        },
      ],
    },
  ],
  /**
   * Two slots rather than three, and the reason is Spanish rather than taste.
   *
   * A degree belongs *before* the body part — `Me duele mucho el estómago`, which
   * is how the taught dialogue says it — and a flat template cannot drop one slot
   * inside the phrase another slot produced. A separate "how much" slot could
   * only append, which spells `Me duele la cabeza mucho`: understandable, and not
   * what anyone says. So the degree travels with the part.
   *
   * `doler` agrees with what hurts rather than with the speaker, which is the
   * trap this actually drills: `las piernas` can only ever take `me duelen`, and
   * keeping the verb in the choice is what makes that impossible to get wrong.
   */
  'doctor-visit': [
    {
      id: 'build-symptom-report',
      title: 'Say exactly what hurts',
      cue: 'Choose what hurts and how much, then whether to say since when.',
      targetTemplate: '{part}{since}',
      referenceTemplate: '{part}{since}',
      slots: [
        {
          id: 'part',
          label: 'What hurts',
          choices: [
            { id: 'cabeza', target: 'Me duele la cabeza', reference: 'My head hurts' },
            {
              id: 'cabeza-mucho',
              target: 'Me duele mucho la cabeza',
              reference: 'My head hurts a lot',
            },
            { id: 'estomago', target: 'Me duele el estómago', reference: 'My stomach hurts' },
            {
              id: 'estomago-mucho',
              target: 'Me duele mucho el estómago',
              reference: 'My stomach hurts a lot',
            },
            { id: 'garganta', target: 'Me duele la garganta', reference: 'My throat hurts' },
            {
              id: 'garganta-poco',
              target: 'Me duele un poco la garganta',
              reference: 'My throat hurts a little',
            },
            { id: 'espalda', target: 'Me duele la espalda', reference: 'My back hurts' },
            { id: 'piernas', target: 'Me duelen las piernas', reference: 'My legs hurt' },
            {
              id: 'piernas-poco',
              target: 'Me duelen un poco las piernas',
              reference: 'My legs hurt a little',
            },
            { id: 'cansado', target: 'Estoy muy cansado', reference: "I'm very tired" },
          ],
        },
        {
          id: 'since',
          label: 'Since when',
          choices: [
            { id: 'none', target: '.', reference: '.' },
            { id: 'hoy', target: ' desde hoy.', reference: ' since today.' },
            { id: 'ayer', target: ' desde ayer.', reference: ' since yesterday.' },
            { id: 'lunes', target: ' desde el lunes.', reference: ' since Monday.' },
          ],
        },
      ],
    },
  ],
  'your-work': [
    {
      id: 'build-work-answer',
      title: 'Answer “¿dónde trabajas?”',
      cue: 'Choose the place, then whether to add who with or how near.',
      targetTemplate: 'Trabajo en {place}{extra}',
      referenceTemplate: 'I work in {place}{extra}',
      slots: [
        {
          id: 'place',
          label: 'Where',
          choices: [
            { id: 'oficina', target: 'una oficina', reference: 'an office' },
            { id: 'tienda', target: 'una tienda', reference: 'a shop' },
            { id: 'restaurante', target: 'un restaurante', reference: 'a restaurant' },
            { id: 'hospital', target: 'un hospital', reference: 'a hospital' },
            { id: 'escuela', target: 'una escuela', reference: 'a school' },
            { id: 'casa', target: 'casa', reference: 'at home' },
          ],
        },
        {
          id: 'extra',
          label: 'Add a detail',
          choices: [
            { id: 'none', target: '.', reference: '.' },
            { id: 'centro', target: ', en el centro.', reference: ', in the centre.' },
            { id: 'cerca', target: ', cerca de mi casa.', reference: ', near my house.' },
            {
              id: 'companeros',
              target: ', con dos compañeros.',
              reference: ', with two colleagues.',
            },
          ],
        },
      ],
    },
  ],
  'your-home': [
    {
      id: 'build-home-answer',
      title: 'Answer “¿dónde vives?”',
      cue: 'Choose the kind of home, then who is in it, then how you feel about it.',
      targetTemplate: 'Vivo en {home}{company}{feeling}',
      referenceTemplate: 'I live in {home}{company}{feeling}',
      slots: [
        {
          id: 'home',
          label: 'Kind of home',
          choices: [
            { id: 'piso', target: 'un piso', reference: 'a flat' },
            { id: 'piso-pequeno', target: 'un piso pequeño', reference: 'a small flat' },
            { id: 'casa', target: 'una casa', reference: 'a house' },
            { id: 'habitacion', target: 'una habitación', reference: 'a room' },
          ],
        },
        {
          /*
           * Every choice says something. A "no answer" option would have to carry
           * an empty target, and a slot is rendered as a `<select>` — so an empty
           * target is a blank line in a dropdown, which reads as a rendering
           * fault rather than as a choice. `variations.test.ts` refuses one now.
           */
          id: 'company',
          label: 'Who with',
          choices: [
            { id: 'solo', target: ', solo', reference: ', alone' },
            { id: 'familia', target: ', con mi familia', reference: ', with my family' },
            { id: 'amigos', target: ', con dos amigos', reference: ', with two friends' },
          ],
        },
        {
          id: 'feeling',
          label: 'How you feel about it',
          choices: [
            { id: 'plain', target: '.', reference: '.' },
            { id: 'gusta', target: ', y me gusta mucho.', reference: ', and I like it a lot.' },
            {
              id: 'pequeno',
              target: ', y es un poco pequeño.',
              reference: ", and it's a little small.",
            },
          ],
        },
      ],
    },
  ],
  'buy-a-ticket': [
    {
      id: 'build-ticket-request',
      title: 'Build your ticket request',
      cue: 'Change how many, where to, and which fare.',
      targetTemplate: '{count} {destination}{fare}',
      referenceTemplate: '{count} {destination}{fare}',
      slots: [
        {
          id: 'count',
          label: 'How many',
          choices: [
            { id: 'uno', target: 'Un billete', reference: 'One ticket' },
            { id: 'dos', target: 'Dos billetes', reference: 'Two tickets' },
            { id: 'tres', target: 'Tres billetes', reference: 'Three tickets' },
          ],
        },
        {
          id: 'destination',
          label: 'Where to',
          choices: [
            { id: 'sevilla', target: 'para Sevilla', reference: 'to Seville' },
            { id: 'madrid', target: 'para Madrid', reference: 'to Madrid' },
            { id: 'centro', target: 'para el centro', reference: 'to the centre' },
            { id: 'aeropuerto', target: 'para el aeropuerto', reference: 'to the airport' },
          ],
        },
        {
          id: 'fare',
          label: 'Which fare',
          choices: [
            { id: 'plain', target: ', por favor.', reference: ', please.' },
            { id: 'ida', target: ', solo ida.', reference: ', one way.' },
            { id: 'vuelta', target: ', ida y vuelta.', reference: ', return.' },
            { id: 'hoy', target: ', para hoy.', reference: ', for today.' },
          ],
        },
      ],
    },
  ],
  'market-shopping': [
    {
      id: 'build-quantity-request',
      title: 'Build your order',
      cue: 'Change the amount, the produce, and how you finish.',
      targetTemplate: '{amount} {produce}{finish}',
      referenceTemplate: '{amount} {produce}{finish}',
      slots: [
        {
          id: 'amount',
          label: 'How much',
          choices: [
            { id: 'kilo', target: 'Un kilo de', reference: 'A kilo of' },
            { id: 'medio', target: 'Medio kilo de', reference: 'Half a kilo of' },
            { id: 'dos-kilos', target: 'Dos kilos de', reference: 'Two kilos of' },
            { id: 'poco', target: 'Un poco de', reference: 'A little' },
          ],
        },
        {
          id: 'produce',
          label: 'What',
          choices: [
            { id: 'manzanas', target: 'manzanas', reference: 'apples' },
            { id: 'tomates', target: 'tomates', reference: 'tomatoes' },
            { id: 'naranjas', target: 'naranjas', reference: 'oranges' },
            { id: 'patatas', target: 'patatas', reference: 'potatoes' },
            { id: 'queso', target: 'queso', reference: 'cheese' },
          ],
        },
        {
          id: 'finish',
          label: 'Finish',
          choices: [
            { id: 'please', target: ', por favor.', reference: ', please.' },
            { id: 'nada-mas', target: ', y nada más.', reference: ", and that's all." },
          ],
        },
      ],
    },
  ],
  'introduce-your-family': [
    {
      id: 'build-introduction',
      title: 'Introduce someone',
      cue: 'Change who they are, then add their name or what they do.',
      targetTemplate: '{lead} {relation}{detail}',
      referenceTemplate: '{lead} {relation}{detail}',
      slots: [
        {
          id: 'lead',
          label: 'How to begin',
          choices: [
            { id: 'este-es', target: 'Este es', reference: 'This is' },
            { id: 'esta-es', target: 'Esta es', reference: 'This is' },
            { id: 'es', target: 'Es', reference: "That's" },
          ],
        },
        {
          id: 'relation',
          label: 'Who they are',
          choices: [
            { id: 'hermano', target: 'mi hermano', reference: 'my brother' },
            { id: 'hermana', target: 'mi hermana', reference: 'my sister' },
            { id: 'madre', target: 'mi madre', reference: 'my mother' },
            { id: 'padre', target: 'mi padre', reference: 'my father' },
            { id: 'primo', target: 'mi primo', reference: 'my cousin' },
            { id: 'amiga', target: 'mi amiga', reference: 'my friend' },
          ],
        },
        {
          id: 'detail',
          label: 'Add a detail',
          choices: [
            { id: 'plain', target: '.', reference: '.' },
            { id: 'nombre', target: ', se llama Pablo.', reference: ', his name is Pablo.' },
            {
              id: 'trabajo',
              target: ', trabaja en un hospital.',
              reference: ', he works in a hospital.',
            },
            { id: 'estudia', target: ', estudia medicina.', reference: ', he studies medicine.' },
          ],
        },
      ],
    },
  ],
};
