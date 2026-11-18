import type { RecipeInput } from '@wecooked/shared';

type AgentRecipe = Omit<RecipeInput, 'coverPhoto'>;

/** CJK characters carry about twice the meaning of a Latin letter, so they count double. */
const weight = (s: string) => [...s].reduce((n, ch) => n + (/[⺀-鿿]/.test(ch) ? 2 : 1), 0);

// Words that turn a short description ("diced", "去皮") into an instruction (soak, then drain, reserve the white part).
const INSTRUCTION = /(\bthen\b|\buntil\b|\bset aside\b|\breserve\b|\bsoak\b|\bdrain\b|\bpreheat\b|\bkeep\b.*\bfor\b|浸|瀝乾|留|其餘|然後|之後|煮至|備用|起始)/i;

/** True when an ingredient note reads like a step rather than a short description of the item. */
export function noteLooksLikeStep(note: string): boolean {
  const n = note.trim();
  if (!n) return false;
  return weight(n) > 28 || /。/.test(n) || /\.\s+\S/.test(n) || INSTRUCTION.test(n);
}

/**
 * Soft checks on a saved recipe. They never block the save; the agent sees them in the result
 * and is expected to fix the recipe with update_recipe.
 */
export function recipeWarnings(recipe: AgentRecipe): string[] {
  const out: string[] = [];
  for (const section of recipe.ingredients) {
    for (const item of section.items) {
      if (noteLooksLikeStep(item.note)) {
        out.push(
          `The note on "${item.name}" ("${item.note}") reads like an instruction. Notes only describe the item (size, brand, "diced"). Move what to DO into a "preparation" step, keep at most a few words in the note, then call update_recipe.`,
        );
      }
    }
  }
  if (!recipe.steps.some((s) => s.section === 'preparation') && recipe.ingredients.some((s) => s.items.length > 1)) {
    out.push('There is no "preparation" step. Washing, cutting, soaking, marinating and mixing sauces belong in preparation steps, before the heat goes on.');
  }
  if (!recipe.steps.some((s) => s.section === 'cooking')) {
    out.push('There is no "cooking" step.');
  }
  return out;
}
