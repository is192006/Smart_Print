// Result of a document processor: page/slide count where it can be
// determined reliably from static parsing, or null with an explanatory
// `note` where it genuinely cannot (see individual processors). Never a
// fabricated/guessed number.
export interface PageCountResult {
  pageCount: number | null;
  note?: string;
}
