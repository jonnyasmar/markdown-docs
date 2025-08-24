import * as assert from 'assert';
import { FrontmatterService } from '../services/frontmatter';
import { CommentFrontmatter, Comment } from '../common/types';

suite('FrontmatterService Test Suite', () => {
    
    test('parse - should handle document with no frontmatter', () => {
        const documentContent = '# Test Document\n\nThis is a test document without frontmatter.';
        const result = FrontmatterService.parse(documentContent);
        
        assert.deepStrictEqual(result, { aiDocReviewerComments: [] });
    });
    
    test('parse - should handle document with existing frontmatter containing comments', () => {
        const documentContent = `---
aiDocReviewerComments:
  - id: "test-id-1"
    author: "John Doe"
    timestamp: "2023-01-01T00:00:00.000Z"
    content: "Test comment"
---
# Test Document

Content here.`;
        
        const result = FrontmatterService.parse(documentContent);
        const expected: CommentFrontmatter = {
            aiDocReviewerComments: [
                {
                    id: "test-id-1",
                    author: "John Doe",
                    timestamp: "2023-01-01T00:00:00.000Z",
                    content: "Test comment"
                }
            ]
        };
        
        assert.deepStrictEqual(result, expected);
    });
    
    test('parse - should handle frontmatter without comment data', () => {
        const documentContent = `---
title: "Test Document"
author: "Jane Doe"
---
# Test Document

Content here.`;
        
        const result = FrontmatterService.parse(documentContent);
        const expected = {
            title: "Test Document",
            author: "Jane Doe",
            aiDocReviewerComments: []
        };
        
        assert.deepStrictEqual(result, expected);
    });
    
    test('parse - should handle malformed YAML frontmatter', () => {
        const documentContent = `---
invalid: yaml: content: [
---
# Test Document

Content here.`;
        
        const result = FrontmatterService.parse(documentContent);
        assert.deepStrictEqual(result, { aiDocReviewerComments: [] });
    });
    
    test('stringify - should add frontmatter to document without existing frontmatter', () => {
        const documentContent = '# Test Document\n\nThis is a test document.';
        const frontmatter: CommentFrontmatter = {
            aiDocReviewerComments: [
                {
                    id: "test-id-1",
                    author: "John Doe",
                    timestamp: "2023-01-01T00:00:00.000Z",
                    content: "Test comment"
                }
            ]
        };
        
        const result = FrontmatterService.stringify(documentContent, frontmatter);
        
        assert.ok(result.startsWith('---\n'));
        assert.ok(result.includes('aiDocReviewerComments:'));
        assert.ok(result.includes('# Test Document'));
    });
    
    test('stringify - should replace existing frontmatter', () => {
        const documentContent = `---
title: "Old Title"
---
# Test Document

Content here.`;
        
        const frontmatter: CommentFrontmatter = {
            aiDocReviewerComments: [
                {
                    id: "test-id-1", 
                    author: "John Doe",
                    timestamp: "2023-01-01T00:00:00.000Z",
                    content: "Test comment"
                }
            ]
        };
        
        const result = FrontmatterService.stringify(documentContent, frontmatter);
        
        assert.ok(result.startsWith('---\n'));
        assert.ok(result.includes('aiDocReviewerComments:'));
        assert.ok(!result.includes('title: "Old Title"'));
        assert.ok(result.includes('# Test Document'));
    });
    
    test('parse and stringify roundtrip - should preserve data integrity', () => {
        const originalFrontmatter: CommentFrontmatter = {
            aiDocReviewerComments: [
                {
                    id: "test-id-1",
                    author: "John Doe",
                    timestamp: "2023-01-01T00:00:00.000Z",
                    content: "First comment"
                },
                {
                    id: "test-id-2",
                    author: "Jane Smith",
                    timestamp: "2023-01-02T00:00:00.000Z",
                    content: "Second comment"
                }
            ]
        };
        
        const documentContent = '# Test Document\n\nContent here.';
        const stringified = FrontmatterService.stringify(documentContent, originalFrontmatter);
        const parsed = FrontmatterService.parse(stringified);
        
        assert.deepStrictEqual(parsed, originalFrontmatter);
    });
});