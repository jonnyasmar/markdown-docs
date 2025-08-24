import { FrontmatterService } from '../services/frontmatter';
import { CommentFrontmatter } from '../common/types';

// Test basic parsing and stringifying
const testDoc = `---
title: "Test Document"
---
# Hello World

This is a test.`;

const parsed = FrontmatterService.parse(testDoc);
console.log('Parsed:', JSON.stringify(parsed, null, 2));

const frontmatter: CommentFrontmatter = {
    aiDocReviewerComments: [
        {
            id: "test-1",
            author: "Test User",
            timestamp: new Date().toISOString(),
            content: "This is a test comment"
        }
    ]
};

const stringified = FrontmatterService.stringify(testDoc, frontmatter);
console.log('Stringified:', stringified);