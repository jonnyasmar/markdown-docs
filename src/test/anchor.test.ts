import * as assert from 'assert';
import { AnchorService, AnchorInfo } from '../services/anchor';

suite('AnchorService Test Suite', () => {
    
    test('findAllAnchors - should return empty map for document with no anchors', () => {
        const documentContent = '# Test Document\n\nThis is a test document without anchors.';
        const result = AnchorService.findAllAnchors(documentContent);
        
        assert.strictEqual(result.size, 0);
    });
    
    test('findAllAnchors - should find single anchor pair', () => {
        const documentContent = `# Test Document

<!-- markdown-docs-start:test-id-1 -->This is anchored text<!-- markdown-docs-end:test-id-1 -->

More content here.`;
        
        const result = AnchorService.findAllAnchors(documentContent);
        
        assert.strictEqual(result.size, 1);
        assert.ok(result.has('test-id-1'));
        
        const anchor = result.get('test-id-1')!;
        assert.strictEqual(anchor.id, 'test-id-1');
        assert.strictEqual(anchor.content, 'This is anchored text');
    });
    
    test('findAllAnchors - should find multiple anchor pairs', () => {
        const documentContent = `# Test Document

<!-- markdown-docs-start:anchor-1 -->First anchored text<!-- markdown-docs-end:anchor-1 -->

Some content in between.

<!-- markdown-docs-start:anchor-2 -->Second anchored text<!-- markdown-docs-end:anchor-2 -->`;
        
        const result = AnchorService.findAllAnchors(documentContent);
        
        assert.strictEqual(result.size, 2);
        assert.ok(result.has('anchor-1'));
        assert.ok(result.has('anchor-2'));
        
        const anchor1 = result.get('anchor-1')!;
        assert.strictEqual(anchor1.content, 'First anchored text');
        
        const anchor2 = result.get('anchor-2')!;
        assert.strictEqual(anchor2.content, 'Second anchored text');
    });
    
    test('findAllAnchors - should handle orphaned start tags gracefully', () => {
        const documentContent = `# Test Document

<!-- markdown-docs-start:orphaned -->This has no end tag

<!-- markdown-docs-start:complete -->This is complete<!-- markdown-docs-end:complete -->`;
        
        const result = AnchorService.findAllAnchors(documentContent);
        
        // Should only find the complete anchor
        assert.strictEqual(result.size, 1);
        assert.ok(result.has('complete'));
        assert.ok(!result.has('orphaned'));
    });
    
    test('wrapSelection - should wrap text with anchor tags', () => {
        const documentContent = '# Test Document\n\nThis is some text to wrap.';
        const startIndex = documentContent.indexOf('some text');
        const endIndex = startIndex + 'some text'.length;
        
        const result = AnchorService.wrapSelection(documentContent, startIndex, endIndex, 'test-wrap');
        
        assert.ok(result.includes('<!-- markdown-docs-start:test-wrap -->some text<!-- markdown-docs-end:test-wrap -->'));
    });
    
    test('wrapSelection - should throw error for invalid indices', () => {
        const documentContent = 'Test content';
        
        // Negative start index
        assert.throws(() => {
            AnchorService.wrapSelection(documentContent, -1, 5, 'test');
        }, /Invalid selection indices/);
        
        // End index beyond content length
        assert.throws(() => {
            AnchorService.wrapSelection(documentContent, 0, 100, 'test');
        }, /Invalid selection indices/);
        
        // Start index >= end index
        assert.throws(() => {
            AnchorService.wrapSelection(documentContent, 5, 5, 'test');
        }, /Invalid selection indices/);
    });
    
    test('wrapSelection - should throw error for duplicate ID', () => {
        const documentContent = `# Test

<!-- markdown-docs-start:existing -->Existing anchor<!-- markdown-docs-end:existing -->

New text to wrap.`;
        
        const startIndex = documentContent.indexOf('New text');
        const endIndex = startIndex + 'New text'.length;
        
        assert.throws(() => {
            AnchorService.wrapSelection(documentContent, startIndex, endIndex, 'existing');
        }, /Anchor with ID 'existing' already exists/);
    });
    
    test('removeAnchor - should remove anchor tags while preserving content', () => {
        const documentContent = `# Test Document

<!-- markdown-docs-start:remove-me -->Text to keep<!-- markdown-docs-end:remove-me -->

More content.`;
        
        const result = AnchorService.removeAnchor(documentContent, 'remove-me');
        
        assert.ok(result.includes('Text to keep'));
        assert.ok(!result.includes('<!-- markdown-docs-start:remove-me -->'));
        assert.ok(!result.includes('<!-- markdown-docs-end:remove-me -->'));
    });
    
    test('removeAnchor - should throw error for non-existent anchor', () => {
        const documentContent = '# Test Document\n\nNo anchors here.';
        
        assert.throws(() => {
            AnchorService.removeAnchor(documentContent, 'non-existent');
        }, /Anchor with ID 'non-existent' not found/);
    });
    
    test('wrapSelection and removeAnchor roundtrip - should preserve document integrity', () => {
        const originalContent = '# Test Document\n\nThis is some text that will be wrapped and unwrapped.';
        const textToWrap = 'some text';
        const startIndex = originalContent.indexOf(textToWrap);
        const endIndex = startIndex + textToWrap.length;
        
        // Wrap the text
        const wrappedContent = AnchorService.wrapSelection(originalContent, startIndex, endIndex, 'roundtrip-test');
        
        // Verify it was wrapped
        const anchors = AnchorService.findAllAnchors(wrappedContent);
        assert.strictEqual(anchors.size, 1);
        assert.ok(anchors.has('roundtrip-test'));
        
        // Remove the anchor
        const unwrappedContent = AnchorService.removeAnchor(wrappedContent, 'roundtrip-test');
        
        // Should be back to original content
        assert.strictEqual(unwrappedContent, originalContent);
    });
});