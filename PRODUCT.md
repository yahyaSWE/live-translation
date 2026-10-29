# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One broadcaster and an open audience of up to 200 simultaneous listeners, primarily on phones. Confirmed by the user on 2026-10-29.

## Product Purpose

Let an audience listen to live Arabic speech translated into Swedish, without visitor accounts or language configuration.

## Operating Context

One active broadcast at a time. A stable public home page has a large join button. A password-protected admin creates, broadcasts, pauses and ends the session. Swedish is selected automatically. The user confirmed this flow on 2026-10-29.

## Capabilities and Constraints

Next.js, Gemini Live Translate and LiveKit. One shared Swedish translation stream per broadcast. Production deployment uses a single application instance. Target capacity is 200 listeners and must be verified with real-service load testing. Gemini and LiveKit credentials belong in server environment variables. The user has a Gemini key and is creating a LiveKit project.

## Brand Commitments

Existing product name: Live Translate. Preserve the existing visual identity while adapting the operational interface. Interface language: Swedish.

## Open Decisions

Public domain, final hosting account and public broadcast title are not yet supplied. No recordings or visitor accounts are requested.
