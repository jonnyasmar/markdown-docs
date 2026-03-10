import * as nodeEmoji from 'node-emoji';

/**
 * Convert emoji shortcodes (e.g., :smile:, :rocket:) to unicode emoji characters.
 * Respects code contexts — shortcodes inside inline code (`...`) or fenced code blocks (```...```)
 * are left untouched.
 *
 * Uses the same shortcode set as GitHub, Slack, and other popular tools via the `node-emoji` library.
 *
 * NOTE: A parallel implementation exists in src/extension.ts for the extension build target.
 * Keep both in sync when making changes.
 *
 * @param markdown - The markdown string to process
 * @returns The markdown with emoji shortcodes replaced by unicode emoji characters
 */
export const convertEmojiShortcodes = (markdown: string): string => {
  if (!markdown) {
    return markdown;
  }

  // Process the markdown while respecting code contexts.
  // We split the text into segments: code blocks, inline code, and regular text.
  // Only regular text segments get emoji shortcode conversion.
  const result: string[] = [];
  let i = 0;

  while (i < markdown.length) {
    // Check for fenced code block (``` or ~~~)
    if (
      (markdown[i] === '`' && markdown.slice(i, i + 3) === '```') ||
      (markdown[i] === '~' && markdown.slice(i, i + 3) === '~~~')
    ) {
      const fence = markdown.slice(i, i + 3);
      const endIndex = markdown.indexOf('\n' + fence, i + 3);
      if (endIndex !== -1) {
        // Find the end of the closing fence line
        let closeEnd = endIndex + 1 + fence.length;
        while (closeEnd < markdown.length && markdown[closeEnd] !== '\n') {
          closeEnd++;
        }
        result.push(markdown.slice(i, closeEnd));
        i = closeEnd;
      } else {
        // No closing fence found — treat rest as code block
        result.push(markdown.slice(i));
        i = markdown.length;
      }
      continue;
    }

    // Check for inline code (backtick)
    if (markdown[i] === '`') {
      const endIndex = markdown.indexOf('`', i + 1);
      if (endIndex !== -1) {
        result.push(markdown.slice(i, endIndex + 1));
        i = endIndex + 1;
      } else {
        // No closing backtick — treat rest as-is
        result.push(markdown.slice(i));
        i = markdown.length;
      }
      continue;
    }

    // Regular text — collect until the next code boundary
    let textEnd = i;
    while (textEnd < markdown.length && markdown[textEnd] !== '`' && !(markdown[textEnd] === '~' && markdown.slice(textEnd, textEnd + 3) === '~~~')) {
      textEnd++;
    }

    // Apply emoji conversion to this text segment
    const textSegment = markdown.slice(i, textEnd);
    result.push(nodeEmoji.emojify(textSegment));
    i = textEnd;
  }

  return result.join('');
};
