# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One broadcaster and an open audience of up to 200 simultaneous listeners, primarily on phones. Confirmed by the user on 2026-10-29.

## Product Purpose

Let a congregation follow a live Friday khutbah (the sermon associated with Muslim Friday prayer), translated from Arabic into Swedish, without visitor accounts or language configuration. This use and a visual redesign were explicitly requested by the user on 2026-10-29.

## Operating Context

One active broadcast at a time. A stable public home page has a large join button. A password-protected admin creates, broadcasts, pauses and ends the session. Swedish is selected automatically. The user confirmed this flow on 2026-10-29.

## Capabilities and Constraints

Next.js, Gemini Live Translate and LiveKit. One shared Swedish translation stream per broadcast. Production deployment uses a single application instance. Target capacity is 200 listeners and must be verified with real-service load testing. Gemini and LiveKit credentials belong in server environment variables. The user has a Gemini key and is creating a LiveKit project.

## Brand Commitments

Interface language: Swedish. The user has requested a new identity appropriate to a live khutbah and Friday prayer; this supersedes the earlier instruction to preserve the original Live Translate appearance. No mosque name or logo has been supplied. Do not invent prayer times, a congregation's name, scripture quotations or a recording library.

## Open Decisions

The app is deployed on Render and the user has confirmed that live translation works. The user selected the light, restrained khutbah direction on 2026-10-29 and authorized pushing the finished redesign. Final mosque identity is not supplied. No recordings or visitor accounts are requested.
