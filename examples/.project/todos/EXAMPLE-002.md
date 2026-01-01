---
id: EXAMPLE-002
title: Add rate limiting to API endpoints
project: EXAMPLE
priority: P2
status: todo
owner: unassigned
depends_on:
  - EXAMPLE-001
blocked_by: []
tags:
  - api
  - security
  - performance
created: '2026-01-01'
updated: '2026-01-01'
estimate: 2h
---

# EXAMPLE-002: Add rate limiting to API endpoints

## Description

Implement rate limiting middleware to prevent API abuse and ensure fair usage across all users.

**Acceptance Criteria:**

- Rate limits applied per user/API key
- Configurable limits per endpoint
- Returns proper 429 status codes
- Includes rate limit headers in responses

## Subtasks

- [ ] Create rate limiting middleware
- [ ] Configure per-endpoint limits
- [ ] Add rate limit headers
- [ ] Write tests

## Notes
