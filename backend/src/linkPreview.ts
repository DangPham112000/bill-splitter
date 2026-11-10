import type { Request, Response } from 'express';
import { formatDateRange } from '@bill-splitter/shared';
import { countMembers, findByInviteToken } from './graphql/splitters.js';

// Absolute URLs for the preview image, since chat apps fetch it from their own servers.
const appUrl = (process.env.APP_URL || 'https://bills.dantepham.site').replace(/\/$/, '');

const TYPE_LABELS: Record<string, string> = {
  trip: 'Trip',
  party: 'Party',
  project: 'Project',
  other: 'Splitter',
};

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

function metaTags(title: string, description: string, url: string): string {
  const tags = {
    'og:type': 'website',
    'og:site_name': 'Bill Splitter',
    'og:title': title,
    'og:description': description,
    'og:url': url,
    'og:image': `${appUrl}/og-image.png`,
    'og:image:width': '1200',
    'og:image:height': '630',
  };
  return [
    ...Object.entries(tags).map(
      ([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`,
    ),
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="description" content="${escapeHtml(description)}" />`,
  ].join('\n    ');
}

/**
 * Link preview tags for a join link (DAN-36). Zalo and Messenger read the page without running
 * JavaScript, so the frontend nginx pulls this fragment into index.html with SSI when it serves
 * /join/<token>. Unknown tokens and links with joining turned off get a generic preview.
 */
export async function joinLinkPreview(req: Request, res: Response) {
  const token = String(req.params.token);
  const url = `${appUrl}/join/${encodeURIComponent(token)}`;
  let title = 'Join a splitter on Bill Splitter';
  let description = 'Split the costs of a trip, project or party. No account needed.';

  try {
    const splitter = await findByInviteToken(token);
    if (splitter?.joiningEnabled) {
      const emoji = splitter.coverEmoji ? `${splitter.coverEmoji} ` : '';
      const members = await countMembers(splitter._id);
      title = `${emoji}${splitter.name}`;
      description = [
        TYPE_LABELS[splitter.type],
        formatDateRange(
          splitter.startDate?.toISOString().slice(0, 10) ?? null,
          splitter.endDate?.toISOString().slice(0, 10) ?? null,
        ),
        `${members} ${members === 1 ? 'member' : 'members'}`,
      ]
        .filter(Boolean)
        .join(' · ');
      description += '. Join to add what you paid and see who owes whom.';
    }
  } catch (error) {
    // A preview is nice to have; the page itself must still load.
    console.error('Link preview failed', error);
  }

  res
    .type('text/html; charset=utf-8')
    .set('Cache-Control', 'no-store')
    .send(metaTags(title, description, url));
}
