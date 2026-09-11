import type { PlanDraft } from "../shared/types";

export type ParseResult =
  | { available: true; draft: PlanDraft }
  | { available: false; code: "AI_NOT_ENABLED" };
export interface PlanParser {
  parse(input: string): Promise<ParseResult>;
}

/** Phase 1 has no model transport, raw-plan storage, or fabricated interpretation. */
export const planParser: PlanParser = {
  async parse() {
    return { available: false, code: "AI_NOT_ENABLED" };
  },
};
export const AI_PRIVACY_PREVIEW = Object.freeze({
  enabled: false,
  fieldsSent: [] as readonly string[],
  rawInputRetained: false,
});
