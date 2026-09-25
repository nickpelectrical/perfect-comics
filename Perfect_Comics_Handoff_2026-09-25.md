# Perfect Comics — handoff
25 September 2026

This file replaces the price, generation, and edit rules in the older handoffs (`v1.1`, `v1.2`, merged PDF). If those say $15 a book, 10 free pages, or “one generate inks the whole issue,” ignore them.

Code that matches this document:

- [src/components/comics/studio.tsx](/workspace/src/components/comics/studio.tsx)
- [src/lib/comics/types.ts](/workspace/src/lib/comics/types.ts)
- [src/lib/comics/ai.functions.ts](/workspace/src/lib/comics/ai.functions.ts)
- [src/lib/comics/ink-prompt.ts](/workspace/src/lib/comics/ink-prompt.ts)

Library key: `localStorage` `perfect-comics-v1`.

---

## What the user is building

A 10-page comic studio (cover + pages 1–9) for percfectai.com. One style per issue. Writing is free. The first picture of each page is a free watermarked draft. They pay to unlock the clean file and to get the two edits.

Tabs, in order:

1. Settings
2. Character Reference
3. Summary
4. Cover
5. Beginning (pages 1–3)
6. Middle (pages 4–6)
7. Ending (pages 7–9)
8. Final Review

Quick comic or page-by-page. Text rewrite is still the writer button. It does not spend an image edit.

---

## Money the customer pays

| Piece | Price |
|---|---|
| Cover | $2 |
| Beginning, 3 pages | $6 |
| Middle, 3 pages | $6 |
| Ending, 3 pages | $6 |
| Full comic | $20 |

They pay as they finish each comic. Not $80 up front.

Four comics are $80 over time. The 5th finished comic is free. Then it repeats (6–9 paid, 10 free).

A comic counts only when all four blocks are unlocked (paid, or claimed because it was the free 5th). A draft does not count. A half-paid book does not count.

One-shot vs series does not change the price. Genre and print style do not change the price. Settings says which number this comic is before they generate anything.

Credits are dollars. Unlocking a block deducts that block’s price. The free 5th deducts $0 and unlocks the whole book.

Watermark stays on a block until that block is unlocked. CSS overlay in `PageArt`. The raw image URL is still the clean file. `stamp()` exists and is not called. A watermark remover, or anyone reading the image URL, can still get the clean draft. That is an open hole.

---

## Three pictures per page. Not four.

This was argued until it was explicit.

| Picture | What it is | Model | When |
|---|---|---|---|
| 1 | Free draft. Watermarked. | `grok-imagine-image-2.0` | Before they pay |
| 2 | First edit | `grok-imagine-image-2.0` | After that page’s block is unlocked |
| 3 | Second edit | `grok-imagine-image-2.0` | After unlock, if an edit is left |

Unlocking a block sets `editsLeft` to **2** on each page in that block. The draft does not consume one of those 2. Draft + 2 edits = 3 pictures. Then the page stops.

Do not go back to “3 edits after the draft.” That made 4 pictures. The user said we only allowed 3, then confirmed: draft 1, draft 2, draft 3, and drafts 2 and 3 are the two edits.

They can ink every page’s first draft without paying. There is no “only 3 pages at a time” lock. That rule was added, then removed on purpose.

Edits (small change or “use an edit”) are refused until the block is paid. Copy on screen: pay to unlock, 2 edits left, three pictures total.

`Issue.editsLeft` (the block-shaped object) is leftover. The live counter is `ComicPage.editsLeft`. `rewritesLeft` (3) and `smallChangesLeft` (7) are no longer spent by image edits.

---

## References

Each call sends at most **3** images. The server slices to 3.

- First draft: character photos. If it is an interior and there are fewer than 3 character photos, the previous page is included first.
- An edit: the picture being fixed, then character photos, still capped at 3.

“3 refs if necessary” means send them when they exist. Do not send a fourth.

Character tab still lets them add up to five names and upload a photo on the cast card. Only three photos go out on a call. The older note “build the character on the character builder, no file upload here” was said, then the studio grew its own photo upload. Do not rip that out unless asked again.

---

## Model and what one call costs us

Every picture in the app is `grok-imagine-image-2.0`, `resolution: "1k"`, `quality: "medium"`.

xAI list prices, pricing page dated 21 September 2026. These are not a live invoice.

| | Price |
|---|---|
| 2.0 picture, 1K medium | 6¢ |
| 2.0 reference image | 1¢ each |
| Cheap model `grok-imagine-image` picture | 2¢ |
| Cheap-model reference | 0.2¢ each |
| `grok-imagine-image-quality` picture, 1K | 5¢ |
| Quality-model reference | 1¢ each |
| 2.0 picture, 2K medium | 8¢ |

A 2.0 call with 3 references is 6¢ + 3¢ = **9¢**.

Three pictures on one page, all with 3 references: 9¢ × 3 = **27¢**.

Three pages, same assumption: **81¢**.

If an edit only has the picture it is fixing (1 reference): that call is 7¢. Then one page is 9¢ + 7¢ + 7¢ = **23¢**, and 3 pages are **69¢**.

The 43¢ vs 44¢ argument was a counting error. 44¢ was 3 pages × **4** pictures. We do not do 4. Same job, 3 pictures, 3 pages, 3 refs on the first two and 1 ref on a 2.0 fix, is **36.6¢**. All three pictures on 2.0 with 3 refs is the **81¢** line above.

The user said they are not going to be cheap and to do it right. They then stopped to ask about something they had seen earlier, and never said what. **2K was not switched on.** The app is still 1K medium. Do not bump resolution unless they say so.

---

## Dropped ideas. Do not revive them.

- $1.50 or $2 per page, and a $15 issue.
- Every 9th and 10th comic free after 8 paid books. Replaced by every 5th free.
- Five cover tries, with tries 4 and 5 on `grok-imagine-image-quality`. Replaced by 3 pictures, all 2.0.
- Generate only one block of 3, and refuse the next block until those 3 are paid. Removed. First drafts of the whole book are allowed. Edits still wait for payment.
- One reference image on every call. Replaced by up to 3 when they exist.
- Using the cheap model for drafts 1 and 2. Replaced by 2.0 for all three.

---

## Asked for, not built

Pro members publish a comic, or a card, and set their own price. The site keeps 10%. Nothing in the studio does this yet. There is a Publish button that only opens the local reader.

The watermark is not baked into the file. `stamp()` is unused. `cleanUrl` is on the page type and is not what `ink()` writes. The image URL stored on the page is the clean model output.

---

## How a page is inked

`ink()` in `studio.tsx` calls `inkPage` in `ai.functions.ts`.

- Model is always `grok-imagine-image-2.0`.
- If the page already has an image and this call is an edit, the prompt kind is `small` (change the attached page).
- If there is no image yet, kind is `cover` or `interior`.
- Aspect 3:4. Response is a URL.
- Refs that are not `http` or `data:` are dropped. Then sliced to 3.
- Failed calls do not spend an edit. A successful edit decrements that page’s `editsLeft`.

`generateDrafts()` inks every page that has no image, in order. It does not check payment. The review button is “Generate drafts,” not “generate the next 3.”

---

## Safety

Prompts in `ink-prompt.ts` stay all-ages. No gore. No title lettering, logos, or readable words on the art. Empty balloons only. Do not put print-style color names into the page-style instructions. That rule came from the original writer spec and was not cancelled.
