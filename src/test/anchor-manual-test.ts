import { AnchorService } from '../services/anchor';

// Test wrapping and finding anchors
const testDoc = `# Test Document

This is some text that we want to anchor.

More content here.`;

logger.debug('Original document:');
logger.debug(testDoc);
logger.debug('\n---\n');

// Wrap some text
const startIndex = testDoc.indexOf('some text');
const endIndex = startIndex + 'some text'.length;
const wrappedDoc = AnchorService.wrapSelection(testDoc, startIndex, endIndex, 'test-anchor-1');

logger.debug('After wrapping "some text":');
logger.debug(wrappedDoc);
logger.debug('\n---\n');

// Find all anchors
const anchors = AnchorService.findAllAnchors(wrappedDoc);
logger.debug('Found anchors:');
for (const [id, anchor] of anchors) {
    logger.debug(`ID: ${id}, Content: "${anchor.content}"`);
}
logger.debug('\n---\n');

// Remove anchor
const unwrappedDoc = AnchorService.removeAnchor(wrappedDoc, 'test-anchor-1');
logger.debug('After removing anchor:');
logger.debug(unwrappedDoc);
logger.debug('\n---\n');

logger.debug('Roundtrip successful:', unwrappedDoc === testDoc);