import { expect, test } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { newMember, shot } from './helpers';

test('AI agent: create a key, add a recipe over MCP, review it, revoke the key', async ({ browser, baseURL }) => {
  const page = (await newMember(browser, 'Agent owner')).page;
  await page.goto('/me');
  await page.getByLabel('Name', { exact: true }).fill('Claude on laptop');
  await page.getByRole('button', { name: 'Create key' }).click();
  const setup = page.getByRole('status').filter({ hasText: 'Key created' });
  const key = (await setup.locator('pre').first().textContent())!.trim();
  expect(key).toMatch(/^wc_/);
  await expect(setup.getByText(/claude mcp add --transport http wecooked .*\/mcp --header "Authorization: Bearer wc_/)).toBeVisible();
  await setup.getByRole('tab', { name: 'Codex CLI' }).click();
  await expect(setup.getByText(/bearer_token_env_var = "WECOOKED_KEY"/)).toBeVisible();
  await shot(page, 'api-key-created');

  // The real MCP client, as Claude Code would use it.
  const transport = new StreamableHTTPClientTransport(new URL(`${baseURL}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${key}` } } });
  const agent = new Client({ name: 'e2e-agent', version: '1.0.0' });
  await agent.connect(transport);
  expect(agent.getInstructions()).toMatch(/search_recipes first/);
  const result = (await agent.callTool({
    name: 'create_recipe',
    arguments: {
      recipe: {
        title: 'Tomato and Egg Stir-fry',
        otherName: '番茄炒蛋',
        servings: 2,
        ingredients: [{ name: '', items: [{ quantity: 3, unit: '', name: 'eggs', note: '' }, { quantity: 2, unit: '', name: 'tomatoes', note: 'cut in wedges' }] }],
        steps: [
          { section: 'preparation', text: 'Beat the eggs with a pinch of salt.' },
          { section: 'cooking', text: 'Scramble the eggs, add tomatoes, cook until saucy.', timerMins: 5 },
        ],
        tagIds: [],
      },
    },
  })) as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError).toBeFalsy();
  await agent.close();

  await page.goto('/');
  await expect(page.getByText(/1 recipe added or changed by an AI agent needs a quick check/)).toBeVisible();
  await page.getByRole('button', { name: 'Show them' }).click();
  await page.getByRole('link', { name: /Tomato and Egg Stir-fry/ }).click();
  await expect(page.getByText(/Added by AI \(key “Claude on laptop”\) · needs review/)).toBeVisible();
  await shot(page, 'ai-recipe');
  await page.getByRole('button', { name: 'Looks good' }).click();
  await expect(page.getByText(/needs review/)).toHaveCount(0);

  // Revoke: the agent is locked out at once.
  page.on('dialog', (d) => d.accept());
  await page.goto('/me');
  await page.getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText('No keys yet.')).toBeVisible();
  const res = await fetch(`${baseURL}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: '{}' });
  expect(res.status).toBe(401);
});
