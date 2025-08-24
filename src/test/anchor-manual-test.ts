import { AnchorService } from '../services/anchor';

// Test wrapping and finding anchors
const testDoc = `# Test Document

This is some text that we want to anchor.

More content here.`;

console.log('Original document:');
console.log(testDoc);
console.log('\n---\n');

// Wrap some text
const startIndex = testDoc.indexOf('some text');
const endIndex = startIndex + 'some text'.length;
const wrappedDoc = AnchorService.wrapSelection(testDoc, startIndex, endIndex, 'test-anchor-1');

console.log('After wrapping "some text":');
console.log(wrappedDoc);
console.log('\n---\n');

// Find all anchors
const anchors = AnchorService.findAllAnchors(wrappedDoc);
console.log('Found anchors:');
for (const [id, anchor] of anchors) {
    console.log(`ID: ${id}, Content: "${anchor.content}"`);
}
console.log('\n---\n');

// Remove anchor
const unwrappedDoc = AnchorService.removeAnchor(wrappedDoc, 'test-anchor-1');
console.log('After removing anchor:');
console.log(unwrappedDoc);
console.log('\n---\n');

console.log('Roundtrip successful:', unwrappedDoc === testDoc);