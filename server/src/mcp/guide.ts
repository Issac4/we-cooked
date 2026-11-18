import type { RecipeInput } from '@wecooked/shared';

/** Sent automatically when an agent connects (MCP server instructions). Kept short. */
export function instructions(houseRules: string): string {
  return [
    'We Cooked is a household recipe book. You act for the member who owns this API key.',
    'Workflow for adding a recipe:',
    '1. search_recipes first. If it already exists, use get_recipe + update_recipe instead of creating a copy.',
    '2. list_tags and use only existing tag ids. Do not invent tags; only call create_tag if one is clearly missing and the user agreed.',
    '3. Show the user the recipe you are about to add (title, tags, ingredients, steps) and wait for their OK before calling create_recipe. Skip this only if the user has clearly said to import directly without review.',
    '4. create_recipe with steps split into "preparation" and "cooking", and structured ingredients (numeric quantity, short unit, name, note).',
    'Ingredient notes are only a short description of the item ("diced", "about 1.4 kg"). Anything to DO (wash, soak, cut, reserve) goes in a preparation step. If a result has warnings, fix them with update_recipe.',
    'Notes and ratings: the Notes under a recipe are for tips, how it turned out and what to change next time. get_recipe shows them; read them first. Add one with add_comment. Add a rating (hearts, 1–5) only when the person told you theirs, never a guess. A fix to the method itself goes in update_recipe, not in a note.',
    'To suggest what to cook, search_recipes shows rating, times cooked and last cooked, and can sort by highest_rated or not_cooked_lately.',
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
- Let the user review first. Show the draft recipe in plain language (title, tags, servings, ingredients, preparation and cooking steps, source link) and ask if it is good to add. Only call create_recipe after they agree, applying any changes they ask for. The exception: the user clearly said to import directly with no review (e.g. "just import it", "no need to check"). One such instruction covers that request only, not later ones, unless they say it applies to all.
- search_recipes with the dish name (English and the other language). If a match exists, update it instead.
- list_tags and pick tag ids from the existing groups (e.g. Protein, Meal, Cuisine). Never invent ids.
- Only call create_tag when a tag is clearly missing AND the user agreed. It refuses near-duplicates unless confirmNew is true.
- create_recipe refuses a recipe whose name or source link looks like an existing one; pass confirmNew: true only if it is really different.

## Fields
- title: the main name. otherName: optional second name (e.g. Chinese), searched too.
- servings: whole number the amounts are for. prepMins / cookMins: whole minutes.
- ingredients: sections; use one section with name "" for the main list, and extra named sections for "Marinade", "Sauce", etc.
  Each item: quantity as a number (0.5, not "1/2"; null when not measured), unit short ("g", "ml", "tbsp", "tsp", "cloves", "slices", "pcs"; "a pinch" goes in unit with quantity null), name (the ingredient only), note (see below).
- ingredient notes: a few words that describe the item: its size, state or brand ("about 1.4 kg", "diced", "Lee Kum Kee", "room temperature").
  Never put an instruction there. Anything the cook has to DO (wash, soak, drain, peel, cut, "keep the white part for the soup", "start with this much water") is a step.
  - Wrong: { name: "glutinous rice", note: "rinse, soak 1 hour then drain" } and { name: "spring onion", note: "keep 1 stalk for the soup, chop the rest" }
  - Right: note "dry weight" on the rice and no note on the spring onion; then a preparation step "Rinse the rice, soak for 1 hour (timerMins: 60) and drain" and another "Separate the white of 1 spring onion for the soup; chop the rest".
  Every item in a recipe's ingredients should also appear in a step, so the steps alone can be followed.
- steps: every step has section "preparation" (before heat: washing, cutting, marinating, mixing sauces) or "cooking" (on the heat, resting, assembling, serving).
  Keep each step to one stage. Put waiting or cooking times in timerMins (minutes; fractions allowed, e.g. 0.5 = 30 seconds). Markdown (**bold**, lists) is allowed in text.
- links: the original source URL(s) with a short title.
- description: one or two sentences, optional.

## Photos
- After create_recipe, add a cover photo if you have one:
  - from a web page or video: set_recipe_photo_from_url (YouTube: https://i.ytimg.com/vi/<videoId>/maxresdefault.jpg);
  - from a file on the user's computer: get_photo_upload_link, then run the curl command it returns with the real file path.

## After creating
- If the result has "warnings", fix them with update_recipe before telling the user you are done.
- Tell the user what you added and that it shows "Added by AI · needs review" until a member checks it.

## Notes and ratings
Every recipe has Notes (a thread of "notes from the kitchen"). get_recipe returns them as "notes": author, date, rating and text.
- Where does it belong?
  - A step is wrong, missing or unclear → update_recipe (read the whole recipe with get_recipe, send it back changed; drop the "notes" field).
  - A tip, a brand, how it turned out, "less sugar next time", "kids loved it" → add_comment.
  - A recipe said to be wrong in a note and the person asks you to apply it → update_recipe, and say so.
- Read the existing notes first so you do not repeat or contradict one.
- Notes are posted as the key's owner, so write them as that person would. Use the person's own words; do not invent opinions or experiences they did not tell you.
- Rating: add_comment takes rating 1–5 (shown as hearts). Include it only when the person gave one ("it was a 4", "we loved it" is not a number, so ask). The note text may then be empty. Each member's latest rating counts once, so rating again replaces their earlier vote in the score.
- Do not leave a note just to say you created or edited the recipe.

## Suggesting what to cook
- search_recipes returns rating (hearts and votes), timesCooked and lastCooked for each recipe. sort: "highest_rated" for family favourites, "not_cooked_lately" for dishes not made for a while (never-cooked first).
- Check get_meal_plan before suggesting, and do not suggest what is already planned or an "away" day. Use add_plan_entry only when the person agreed.
${houseRules.trim() ? `\n## House rules from the household (these override the above)\n${houseRules.trim()}\n` : ''}
## Worked example (tag ids are placeholders; use list_tags)
\`\`\`json
${JSON.stringify(EXAMPLE, null, 2)}
\`\`\`
`;
}
