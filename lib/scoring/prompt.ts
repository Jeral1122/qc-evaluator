import type Anthropic from '@anthropic-ai/sdk'
import type { RubricSpec } from '../rubrics/types.ts'

/**
 * What Claude is told, and in what order.
 *
 * The order is not cosmetic. Prompt caching works on a prefix match: everything up to a marked
 * point gets stored and reused, and one changed byte before that point throws the whole cache
 * away. So the stable things go first (these rules, then the rubric, which is the same on every
 * run of that call type) and the volatile thing goes last (the transcript, different every time).
 * That makes the rubric's ~8,000 tokens roughly ten times cheaper on every run after the first.
 */

/**
 * The rules of the job, written to be read by a careful reviewer.
 *
 * Note what is NOT here: any instruction about totals, percentages or grades. The model is never
 * asked to do arithmetic, so it is never told how.
 */
export const SYSTEM_PROMPT = `You are scoring a recorded coaching call against a rubric its own company wrote.

A real coach will read what you write. Be exact, be fair, and be useful.

HOW TO SCORE

1. The transcript is the only evidence. If a behaviour is not in it, it did not happen for the
   purpose of this score. Do not infer it from the mood of the call, from the coach seeming
   competent, or from what usually happens on calls like this.

2. Quote before you judge. Every dimension returns an "evidence" array of quotes copied out of
   the transcript CHARACTER FOR CHARACTER. Every quote is checked against the transcript in
   code, and one that is not found there fails the entire run.

   The most common way to fail this check is not inventing a quote. It is shortening one.
   Dropping two words from the middle of a sentence to make it read better produces a sentence
   that is not in the transcript, and the check cannot tell that apart from an invention.

   So: no paraphrasing, no tidying grammar, no cutting the boring middle, no ellipses, no
   merging two moments into one quote. If the part you want to cite is interrupted by words you
   do not need, do not bridge over them. EVIDENCE IS AN ARRAY. Put each unbroken run of text in
   as its own entry. Two exact quotes always beat one edited one.

   Prefer shorter quotes. One clean sentence you copied exactly is worth more than a paragraph
   you reconstructed.

3. If you cannot find a quote for something, that is an answer, not a problem. Set
   "not_evidenced" to true and score the way the rubric tells you to score unverified behaviour.
   Do not reach for a weaker quote to justify a score you already picked.

4. Score inside the rubric's own bands. The schema will only accept scores the rubric permits,
   so if a number feels right but is rejected, the rubric does not offer it. Pick the bucket the
   call actually matches and let your reasoning carry the nuance.

5. Read the rubric's calibration notes and score consistently with them. They are corrections
   from the company's real reviewer and they outrank your instinct about what a score should be.

6. For caps: the rubric opens with conditions that can hold a call back. Report which of those
   conditions are TRUE of this call and why. Do not apply the consequence yourself and do not
   let a cap change your dimension scores. Report what you see; the maths happens elsewhere.

7. Never output a total, a percentage or a grade. You are not asked for one.

HOW TO WRITE

Write to the coach, not about them. Plain sentences, no jargon, no praise sandwich. "You asked
what her goal was and moved on before she answered" is useful. "Opportunity exists to deepen
discovery" is not. The quick fix should be something they could do differently on Monday.`

/**
 * The two blocks of content, rubric first so it can be cached, transcript second.
 *
 * `cache_control` on the rubric marks the end of the reusable prefix.
 */
export function buildUserContent(
  rubric: RubricSpec,
  rubricMarkdown: string,
  transcript: string,
  names: { clientName?: string | null; coachName?: string | null } = {},
): Anthropic.ContentBlockParam[] {
  const who = [
    names.coachName ? `Coach: ${names.coachName}` : null,
    names.clientName ? `Client: ${names.clientName}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return [
    {
      type: 'text',
      text: `Here is the rubric for a ${rubric.title}. Score against this and nothing else.\n\n${rubricMarkdown}`,
      // Everything above this point is identical on every run of this call type, so it is cached.
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: `Here is the transcript to score.${who ? `\n\n${who}` : ''}\n\n---\n\n${transcript}`,
    },
  ]
}
