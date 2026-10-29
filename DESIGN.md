---
name: Khutbah Live
description: A quiet bilingual notice for live Arabic khutbah translated into Swedish.
colors:
  bg: "#F7F5EF"
  bg-elevated: "#ECEEE5"
  bg-inset: "#E3E8DD"
  fg: "#213F35"
  fg-secondary: "#536257"
  fg-tertiary: "#59665C"
  accent: "#8B7443"
  accent-soft: "#EDE7D8"
  border: "#D9D9CC"
  border-light: "#E6E6DB"
  success: "#2F6845"
  error: "#A1322C"
  error-soft: "#F5E9E3"
  control-border: "#A8B1A2"
  danger-border: "#BF8B7E"
  primary-hover: "#153027"
  primary-active: "#0E261D"
  qr-paper: "#FFFFFF"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "76px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(38px, 6vw, 52px)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  arabic:
    fontFamily: "Amiri, Times New Roman, serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  transcript:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.85
  wordmark:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.035em"
rounded:
  control: "4px"
spacing:
  compact: "8px"
  small: "12px"
  field: "14px"
  medium: "16px"
  group: "20px"
  section: "24px"
  section-gap: "26px"
  generous: "28px"
  page: "48px"
components:
  button-primary:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "13px 24px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
  button-primary-disabled:
    backgroundColor: "{colors.bg-inset}"
    textColor: "{colors.fg-secondary}"
  button-outline:
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "13px 24px"
    height: "50px"
  button-outline-hover:
    backgroundColor: "{colors.bg-elevated}"
  button-danger:
    textColor: "{colors.error}"
    rounded: "{rounded.control}"
    padding: "13px 24px"
    height: "50px"
  button-danger-hover:
    backgroundColor: "{colors.error-soft}"
  button-join:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    rounded: "{rounded.control}"
    padding: "20px 28px"
    height: "72px"
    width: "100%"
  input-field:
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "52px"
    width: "100%"
  input-field-disabled:
    backgroundColor: "{colors.bg-elevated}"
    textColor: "{colors.fg-secondary}"
---

# Design System: Khutbah Live

## Overview

**Creative North Star: "The Congregation Notice"**

A light, restrained Swedish congregation notice: warm paper, deep green ink, muted brass and fine rules. The service feels calm and legible in a Friday-prayer setting, with Swedish interface text and a distinct Arabic typographic voice.

The system is code-led and flat. Clear typography and deliberate space carry the identity across public listening, sign-in and broadcast administration. The approved direction uses self-hosted fonts and no decorative raster assets. PRODUCT.md supplies the durable language and identity constraints; individual screen composition belongs to the surface contract.

**Key Characteristics:**
- Warm paper with deep green text and actions.
- Serif headings, Arabic calligraphy and practical sans-serif controls.
- Fine rules and compact, subtly squared controls.
- Readable listening states and explicit broadcast feedback.

## Colors

The palette pairs paper-like neutrals with green ink and restrained brass.

### Primary
- **Deep Green Ink** (`fg`): body text, headings, primary actions, native range and checkbox accents, and selection background.
- **Primary Hover / Active** (`primary-hover`, `primary-active`): progressively darker primary-action feedback.
- **Live Green** (`success`): live status dots and configured connection states.

### Secondary
- **Muted Brass** (`accent`): Arabic heading, the lighter wordmark segment, waiting status dots and keyboard focus.
- **Brass Wash** (`accent-soft`): declared companion token; the sampled components currently do not use it.

### Neutral
- **Warm Paper** (`bg`): the page canvas and reversed text on primary actions.
- **Sage Paper / Inset Sage** (`bg-elevated`, `bg-inset`): outline hover, disabled fields and disabled primary actions.
- **Secondary / Tertiary Ink** (`fg-secondary`, `fg-tertiary`): secondary text; tertiary is declared but not currently consumed by the sampled components.
- **Fine Rule / Light Rule** (`border`, `border-light`): structural separators and connection-list rows.
- **Control Stroke** (`control-border`): input, select and outline-button borders; also the transcript scrollbar.
- **QR Paper** (`qr-paper`): the white scanning surface around the QR code.

Error feedback uses **Error Red**, **Error Wash** and **Danger Stroke** (`error`, `error-soft`, `danger-border`). Red identifies missing setup, error messages and the destructive broadcast action.

**The Ink and Paper Rule.** Use green for text and primary actions, brass for restrained emphasis, and semantic green or red for operational state. Status always includes words alongside color.

## Typography

**Display Font:** Instrument Serif, with Georgia and serif fallbacks.
**Body Font:** DM Sans, with system-ui and sans-serif fallbacks.
**Arabic Font:** Amiri, with Times New Roman and serif fallbacks.

All three families are self-hosted through CSS font-face declarations with swap loading. DM Sans ships regular, medium and semibold; Instrument Serif ships regular and italic; Amiri ships regular. The current screen does not require a separate mono face.

**Character:** Instrument Serif provides a gentle notice-like heading voice. DM Sans keeps controls and long Swedish captions easy to follow; Amiri gives Arabic its own script-appropriate proportions.

### Hierarchy
- **Display:** the large audience heading uses the display token. At the mobile breakpoint it becomes clamp(42px, 10.8vw, 58px).
- **Headline:** administrator page headings use the fluid headline token. The connection-error heading uses clamp(30px, 5vw, 38px).
- **Arabic:** the introductory Arabic line uses the Arabic token, then 30px on mobile. Mark Arabic content with its language and right-to-left direction.
- **Title:** section titles use the title token. Active broadcast names use 20px sans-serif text.
- **Body:** the body token is the base. Supporting body copy uses line-height 1.7; the audience description is 16px desktop and 15px mobile.
- **Label:** action labels use the label token; field labels are 14px regular. Header metadata is 13px desktop and 12px mobile. Fine print is 12px.
- **Transcript:** the transcript token becomes 18px with line-height 1.8 on mobile. Preserve whitespace and wrap long content.
- **Wordmark:** the wordmark token becomes 23px on mobile. “Live” uses regular weight and brass.
- **Connected audience:** Swedish display text reduces to 42px desktop and 34px mobile; Arabic reduces to 27px and 25px respectively.

**The Reading Priority Rule.** Reduce introductory type in the connected state so controls and Swedish captions become the main reading surface.

## Layout

The page has a minimum viewport height and a single centered content column. The audience shell is capped at 1004px; the admin shell at 680px. Outer gutters are 48px on desktop and 22px at or below the 640px breakpoint. The minimum document width is 280px.

Public introduction content is capped at 610px, with a 410px description measure. The connected reading column expands to 650px. Header and footer use horizontal flex alignment and thin separators; the footer moves to the bottom through the shell's flexible height. Public introductions are centered, while controls, transcripts and administrative work are left aligned.

Section spacing follows the extracted scale, with 26px section gaps and 24px transcript separation. Form rows use a 14px gap. Controls commonly span the column; action rows wrap with a 12px gap. The sharing section places text beside its QR code on desktop and stacks them on mobile.

The public header is at least 94px tall, reducing to 82px on mobile. Introductory vertical padding reduces from 60px/64px to 40px/38px. Connected top padding reduces to 34px desktop and 26px mobile. Transcript height is capped at 400px desktop and 340px mobile, with vertical scrolling.

## Elevation & Depth

There are no box shadows. Depth comes from fine borders and the warm paper, sage and error-wash fills. Sections remain part of one document rather than floating cards. Keyboard focus uses a brass 2px outline offset by 5px; fields use a closer 3px offset.

**The Flat Notice Rule.** Separate content with space, thin rules and state fills; retain the flat document character.

## Shapes

Controls and the QR wrapper have subtly squared corners using the control radius. Structural separators and control borders are 1px. The only recurring circular form is the small 7px status dot. Native range and checkbox affordances retain their platform geometry with green accents.

## Components

### Buttons

Quiet, substantial controls with clear operational hierarchy.
- **Primary:** green ink fill, paper text, medium sans-serif label, transparent 1px border and the extracted control radius. The token height represents the source's minimum height, not a fixed clipping box.
- **Hover / Active:** darker green fills. Color and border transitions use 180ms ease; disabled primary buttons use inset sage, a fine-rule border and secondary ink.
- **Outline:** transparent fill and control stroke; hover adds sage paper and green stroke. Disabled text and borders soften.
- **Danger:** transparent fill, error text and danger stroke; hover adds error wash. The end-broadcast flow supplies its own confirmation controls.
- **Join:** full-column width, 18px label and a 21px inline SVG arrow. Mobile minimum height is 66px with 18px/20px padding and 17px text.
- **Focus:** use the shared visible brass outline. Reduced-motion preference removes transitions and animation.

### Inputs / Fields

Transparent paper fields with a clear stroke, visible label and generous hit area.
- Text fields and selects share the input token; its height is a minimum.
- Placeholder text uses secondary ink. Disabled fields add sage paper.
- Volume ranges have a minimum 44px hit area. Checkbox rows also have a minimum 44px height, with 18px checkboxes.
- Field values and listener counts use tabular numerals where alignment matters.

### Navigation

A compact text wordmark anchors the header; a small page link or language pair occupies the opposite edge. Links inherit green and use a 4px underline offset. The footer repeats the fine rule and small secondary text. Mobile metadata shrinks and the language pair wraps within 110px.

### Broadcast Status

A 7px dot sits beside readable, wrapping status text. Brass indicates a waiting state and semantic green indicates live. The dot is hidden from assistive technology; the containing message uses status semantics. Do not animate the dot.

### Transcript

A fine top rule introduces a sans-serif section title and roomy Swedish text. The scrolling text preserves incoming whitespace, wraps long content and can receive keyboard focus. A small translation-accuracy note follows it.

### Error Message

An error-wash block with red text, 14px/16px padding, 14px text and line-height 1.65. Long messages wrap and remain left aligned. Errors use alert semantics.

### Sharing Surface

A compact text-and-QR row uses the same document rules. The QR code sits on white with 12px padding and the shared corner radius. Copy feedback changes the button label; it does not add a toast or decorative animation.

## Do's and Don'ts

### Do:
- **Do** use the existing paper, green and brass roles across public and admin screens.
- **Do** preserve the separate Arabic and Swedish type voices and correct script direction.
- **Do** keep status understandable through text, with color as supporting information.
- **Do** preserve roomy caption line-height and the smaller connected-state heading.
- **Do** carry the visible focus outline and reduced-motion behavior into new controls.

### Don't:
- **Don't** add floating shadows or decorative gradients to the flat notice system.
- **Don't** use serif display type for controls or long Swedish caption text.
- **Don't** turn the introductory bilingual composition into a requirement for every admin screen.
- **Don't** substitute an invented mosque logo, congregation identity or scripture ornament for the established text identity.
