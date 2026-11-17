import { photoUrl, type Recipe } from '@wecooked/shared';

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/**
 * Adds a title and Open Graph tags so a shared recipe link shows a proper
 * preview (title, line of text, photo) in WhatsApp, iMessage, Slack...
 */
export function withRecipePreview(indexHtml: string, recipe: Recipe, publicUrl: string): string {
  const title = recipe.otherName ? `${recipe.title} · ${recipe.otherName}` : recipe.title;
  const minutes = (recipe.prepMins ?? 0) + (recipe.cookMins ?? 0);
  const description =
    recipe.description.split('\n')[0]?.slice(0, 200) ||
    [minutes ? `${minutes} min` : '', recipe.servings ? `serves ${recipe.servings}` : '', recipe.tags.map((t) => t.name).join(', ')]
      .filter(Boolean)
      .join(' · ') ||
    'A recipe from We Cooked';
  const tags = [
    `<title>${escape(title)} · We Cooked</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="We Cooked" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:url" content="${escape(`${publicUrl}/recipes/${recipe.id}`)}" />`,
    ...(recipe.coverPhoto
      ? [`<meta property="og:image" content="${escape(publicUrl + photoUrl(recipe.coverPhoto))}" />`, `<meta name="twitter:card" content="summary_large_image" />`]
      : []),
  ].join('\n    ');
  return indexHtml.replace(/<title>[^<]*<\/title>/, '').replace('</head>', `    ${tags}\n  </head>`);
}
