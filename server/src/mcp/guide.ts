import type { RecipeInput } from '@wecooked/shared';

/** Sent automatically when an agent connects (MCP server instructions). Kept short. */
export function instructions(houseRules: string): string {
  return [
    'We Cooked is a household recipe book. You act for the member who owns this API key.',
    'Workflow for adding a recipe:',
    '1. search_recipes first. If it already exists, use get_recipe + update_recipe instead of creating a copy.',
    '2. list_tags and use only existing tag ids. Do not invent tags; only call create_tag if one is clearly missing and the user agreed.',
    '3. create_recipe with steps split into "preparation" and "cooking", and structured ingredients (numeric quantity, short unit, name, note).',
    'Call get_guide for the full format rules and a worked example. Everything you create or change is marked "needs review" for the household.',
    houseRules.trim() ? `House rules from the household (follow these):\n${houseRules.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const EXAMPLE: Omit<RecipeInput, 'coverPhoto'> = {
  title: 'Soy Sauce Chicken',
  otherName: '豉油雞',
  description: 'Cantonese braised whole chicken with a glossy soy glaze.',
  servings: 4,
  prepMins: 10,
  cookMins: 35,
  ingredients: [
    {
      name: '',
      items: [
        { quantity: 1, unit: 'whole', name: 'chicken', note: 'about 1.4 kg' },
        { quantity: 250, unit: 'ml', name: 'light soy sauce', note: '' },
        { quantity: 100, unit: 'ml', name: 'dark soy sauce', note: '' },
        { quantity: 60, unit: 'g', name: 'rock sugar', note: '' },
        { quantity: 4, unit: 'slices', name: 'ginger', note: '' },
        { quantity: 3, unit: 'stalks', name: 'spring onion', note: 'cut in half' },
      ],
    },
  ],
  steps: [
    { section: 'preparation', title: 'Bring to room temperature', text: 'Take the chicken out 30 minutes ahead. Pat dry inside and out.', timerMins: null },
    { section: 'preparation', title: 'Make the braising liquid', text: 'Combine both soy sauces, rock sugar, ginger and spring onion in a pot just big enough for the chicken.', timerMins: null },
    { section: 'cooking', title: 'Simmer', text: 'Bring to a boil, lower the chicken in breast-side down and simmer on **low** heat.', timerMins: 15 },
    { section: 'cooking', title: 'Rest in the pot', text: 'Flip, simmer 10 more minutes, then turn off the heat and leave covered.', timerMins: 20 },
    { section: 'cooking', title: 'Chop and serve', text: 'Chop and spoon some sauce over.', timerMins: null },
  ],
  links: [{ url: 'https://www.youtube.com/watch?v=EXAMPLE', title: 'Original video' }],
  tagIds: [1, 9, 15],
};

/** Full rules and an example, returned by the get_guide tool. */
export function guide(houseRules: string): string {
  return `# How to write recipes for We Cooked

## Before creating anything
- search_recipes with the dish name (English and the other language). If a match exists, update it instead.
- list_tags and pick tag ids from the existing groups (e.g. Protein, Meal, Cuisine). Never invent ids.
- Only call create_tag when a tag is clearly missing AND the user agreed. It refuses near-duplicates unless confirmNew is true.
- create_recipe refuses a recipe whose name or source link looks like an existing one; pass confirmNew: true only if it is really different.

## Fields
- title: the main name. otherName: optional second name (e.g. Chinese), searched too.
- servings: whole number the amounts are for. prepMins / cookMins: whole minutes.
- ingredients: sections; use one section with name "" for the main list, and extra named sections for "Marinade", "Sauce", etc.
  Each item: quantity as a number (0.5, not "1/2"; null when not measured), unit short ("g", "ml", "tbsp", "tsp", "cloves", "slices", "pcs"; "a pinch" goes in unit with quantity null), name (the ingredient only), note (preparation or brand advice).
- steps: every step has section "preparation" (before heat: washing, cutting, marinating, mixing sauces) or "cooking" (on the heat, resting, assembling, serving).
  Keep each step to one stage. Put waiting or cooking times in timerMins. Markdown (**bold**, lists) is allowed in text.
- links: the original source URL(s) with a short title.
- description: one or two sentences, optional.

## Photos
- After create_recipe, add a cover photo if you have one:
  - from a web page or video: set_recipe_photo_from_url (YouTube: https://i.ytimg.com/vi/<videoId>/maxresdefault.jpg);
  - from a file on the user's computer: get_photo_upload_link, then run the curl command it returns with the real file path.

## After creating
- Tell the user what you added and that it shows "Added by AI · needs review" until a member checks it.
- Use add_comment for tips that are opinions or experiences rather than steps.
${houseRules.trim() ? `\n## House rules from the household (these override the above)\n${houseRules.trim()}\n` : ''}
## Worked example (tag ids are placeholders; use list_tags)
\`\`\`json
${JSON.stringify(EXAMPLE, null, 2)}
\`\`\`
`;
}
