/**
 * MDXEditor/Lexical plugin that converts emoji shortcodes (e.g., :smile:) to unicode emoji
 * inline as the user types. Uses Lexical's text node transform system so cursor position
 * is preserved naturally.
 */
import { createRootEditorSubscription$, realmPlugin } from '@mdxeditor/editor';
import { $getSelection, $isRangeSelection, TextNode } from 'lexical';

import * as nodeEmoji from 'node-emoji';

// Regex to match emoji shortcodes like :smile:, :rocket:, :+1:
const EMOJI_SHORTCODE_REGEX = /:([a-zA-Z0-9_+\-]+):/g;

/**
 * Find and replace emoji shortcodes in text, returning replacement details
 * so we can adjust cursor position correctly.
 */
function findEmojiReplacements(text: string): { newText: string; changed: boolean; offsetShift: number; lastReplacementEnd: number } {
  let changed = false;
  let offsetShift = 0;
  let lastReplacementEnd = -1;

  const newText = text.replace(EMOJI_SHORTCODE_REGEX, (match, name: string, matchOffset: number) => {
    const emoji = nodeEmoji.get(name);
    if (emoji && emoji !== match) {
      changed = true;
      // Track where this replacement ends in the NEW string
      lastReplacementEnd = matchOffset + offsetShift + emoji.length;
      // Track cumulative offset shift (emoji is shorter than shortcode)
      offsetShift += emoji.length - match.length;
      return emoji;
    }
    return match;
  });

  return { newText, changed, offsetShift, lastReplacementEnd };
}

/**
 * MDXEditor realm plugin that registers a Lexical text node transform
 * to convert emoji shortcodes to unicode characters as the user types.
 */
export const emojiShortcodePlugin = realmPlugin({
  init(realm) {
    realm.pub(createRootEditorSubscription$, (editor) => {
      return editor.registerNodeTransform(TextNode, (textNode) => {
        const text = textNode.getTextContent();
        if (!text.includes(':')) return;

        const { newText, changed, lastReplacementEnd } = findEmojiReplacements(text);
        if (!changed) return;

        // Get current selection before making changes
        const selection = $getSelection();
        const isSelected = $isRangeSelection(selection) &&
          selection.anchor.key === textNode.getKey();

        // Replace the text content
        textNode.setTextContent(newText);

        // Restore cursor position after the emoji
        if (isSelected && lastReplacementEnd >= 0) {
          // Place cursor right after the last replaced emoji
          selection.anchor.set(textNode.getKey(), lastReplacementEnd, 'text');
          selection.focus.set(textNode.getKey(), lastReplacementEnd, 'text');
        }
      });
    });
  },
});
